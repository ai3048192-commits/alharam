import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../lib/session'
import { ar, errorText, MIRROR_ITEMS } from '../lib/content'
import { ErrorBox, Field } from '../components/ui'
import { CAL_KEY, CFG, ITEMS, MAX_COLORS, defaultCalibration, isSkinLike, medianColor, rgbToHex, sampleBox, type Calibration, type ItemId, type Rgb } from '../mirror/checks'
import { loadCalibration, useCamera } from '../mirror/useMirror'
import { CamBox, Lock, PRIVACY } from './Mirror'
import { isUnlocked as kioskUnlocked } from '../kiosk/settings'
import '../mirror/mirror.css'

const BOX = { x0: 0.35, y0: 0.35, x1: 0.65, y1: 0.65 }   // matches .mbox in mirror.css
const SAMPLES = 8                                       // frames averaged per recorded colour

function save(c: Calibration) { try { localStorage.setItem(CAL_KEY, JSON.stringify(c)) } catch { /* storage blocked: keeps working with this session's colours */ } }

export default function MirrorCalibrate() {
  const { manager } = useSession()
  const [cal, setCal] = useState<Calibration>(loadCalibration)
  const [unlocked, setUnlocked] = useState(false)
  const [pinTry, setPinTry] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [item, setItem] = useState<ItemId>('mask')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [pin, setPin] = useState(cal.pin || '')
  const video = useRef<HTMLVideoElement>(null)
  const fromKiosk = new URLSearchParams(location.search).get('from') === 'kiosk'   // opened from the station settings
  const open = !!manager || !cal.pin || unlocked || kioskUnlocked()   // the station PIN also opens it
  const cam = useCamera(video, open)
  const back = fromKiosk ? '/kiosk/settings' : '/mirror'

  const head = <div className="mhead"><h2>معايرة الألوان</h2><Link className="linkbtn" to={back}>رجوع</Link></div>

  if (!open) return (
    <div className="stack">
      {head}
      <form className="card stack" style={{ gap: 10 }} onSubmit={e => {
        e.preventDefault()
        if (pinTry === cal.pin) setUnlocked(true); else setPinErr(true)
      }}>
        <Field label="الرقم السري للمعايرة"><input type="password" inputMode="numeric" dir="ltr" value={pinTry} onChange={e => { setPinTry(e.target.value); setPinErr(false) }} autoFocus /></Field>
        {pinErr && <p className="err">الرقم السري غلط.</p>}
        <button className="btn">ادخل</button>
        <p className="small muted">أو ادخل كرئيس قسم من <Link to="/manager">صفحة رئيس القسم</Link>.</p>
      </form>
    </div>
  )

  const update = (c: Calibration, msg: string) => { setCal(c); save(c); setNote(msg) }

  const record = async () => {
    const v = video.current
    if (!v || !v.videoWidth || busy) return
    setBusy(true); setNote('')
    const s = Math.min(1, CFG.analysisSize / Math.max(v.videoWidth, v.videoHeight))
    const cv = document.createElement('canvas')
    cv.width = Math.round(v.videoWidth * s); cv.height = Math.round(v.videoHeight * s)
    const g = cv.getContext('2d', { willReadFrequently: true })!
    const got: Rgb[] = []
    for (let i = 0; i < SAMPLES; i++) {
      g.drawImage(v, 0, 0, cv.width, cv.height)
      got.push(sampleBox(g.getImageData(0, 0, cv.width, cv.height), BOX))
      await new Promise(r => setTimeout(r, 100))
    }
    cv.width = 0   // the frames are gone; only the average colour stays
    const c = medianColor(got)
    const list = [...cal[item], rgbToHex(c)].slice(-MAX_COLORS)
    update({ ...cal, [item]: list }, isSkinLike(c) ? 'اتسجل، بس اللون ده قريب من لون الجلد، فالفحص هيبقى أقل دقة.' : 'اتسجل اللون ✓')
    setBusy(false)
  }

  return (
    <div className="stack">
      {head}
      {!manager && !cal.pin && <div className="banner">أي حد معاه الجهاز ده يقدر يغيّر الألوان. حط رقم سري تحت، أو ادخل كرئيس قسم.</div>}
      <div className="mprivacy"><Lock /><span>{PRIVACY}</span></div>
      <div className="seg" role="group" aria-label="الواقي" style={{ gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)` }}>
        {ITEMS.map(k => <button key={k} type="button" aria-pressed={item === k} onClick={() => { setItem(k); setNote('') }}>{MIRROR_ITEMS[k]}</button>)}
      </div>
      {cam.error ? <ErrorBox text={errorText(cam.error)} retry={cam.retry} /> : null}
      <div hidden={!!cam.error}><CamBox video={video} mirrored={cam.mirrored} onSwitch={cam.canSwitch && !busy ? cam.switchCamera : undefined}>
        <div className={'mbox' + (busy ? ' busy' : '')} />
        {!cam.ready && <div className="mload"><div className="spin" aria-hidden="true" /><p>بنفتح الكاميرا...</p></div>}
      </CamBox></div>
      <p className="hint">امسك {MIRROR_ITEMS[item]} قدام الكاميرا لحد ما يملا المربع، في نفس النور اللي هيتعمل فيه الفحص.</p>
      <button className="btn mint" disabled={!cam.ready || busy || cal[item].length >= MAX_COLORS} onClick={record}>{busy ? 'بيسجّل...' : 'سجّل اللون'}</button>
      {note && <p className="saved">{note}</p>}

      <div className="card stack" style={{ gap: 10 }}>
        {ITEMS.map(k => (
          <div key={k}>
            <p style={{ fontWeight: 800, marginBottom: 4 }}>{MIRROR_ITEMS[k]} <span className="small muted">({ar(cal[k].length)} من {ar(MAX_COLORS)})</span></p>
            <div className="swatches">
              {cal[k].map((h, i) => <span className="sw" key={h + i}><i style={{ background: h }} />{h}
                <button type="button" aria-label="شيل اللون" disabled={cal[k].length <= 1} onClick={() => update({ ...cal, [k]: cal[k].filter((_, j) => j !== i) }, 'اتشال اللون')}>×</button></span>)}
            </div>
          </div>
        ))}
        <p className="small muted">لكل واقي لحد {ar(MAX_COLORS)} ألوان. لو المكان مليان، شيل لون الأول. لازم يفضل لون واحد على الأقل.</p>
        <button className="btn white sm" onClick={() => update({ ...defaultCalibration(), pin: cal.pin }, 'رجعت الألوان الأصلية')}>رجّع الألوان الأصلية</button>
      </div>

      <form className="card stack" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); update({ ...cal, pin: pin.trim() || undefined }, pin.trim() ? 'اتحفظ الرقم السري' : 'اتشال الرقم السري') }}>
        <Field label="رقم سري للمعايرة على الجهاز ده (اختياري)"><input type="password" inputMode="numeric" dir="ltr" value={pin} onChange={e => setPin(e.target.value)} autoComplete="new-password" /></Field>
        <button className="btn white sm">احفظ الرقم السري</button>
        <p className="small muted">الألوان والرقم السري متسجلين على الجهاز ده بس. لو فاضي، أي حد يقدر يفتح المعايرة.</p>
      </form>

      <Link className="btn" to={fromKiosk ? '/kiosk?test=1' : '/mirror'}>جرّب الفحص</Link>
    </div>
  )
}
