import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ar, errorText, initial, MIRROR_ITEMS, MIRROR_MSG } from '../lib/content'
import { Confetti, ErrorBox, useCountdown } from '../components/ui'
import { CFG, ITEMS, overall, type ItemId, type Verdict } from '../mirror/checks'
import { useMirror } from '../mirror/useMirror'
import '../mirror/mirror.css'

const COUNT_SECONDS = 3
const MAX_WAIT_MS = 6000   // after the countdown, wait at most this long for a full window of frames

export const PRIVACY = 'الكاميرا بتتحلل على الجهاز ده بس، ومفيش أي صورة بتتحفظ أو بتتبعت.'
const N95_NOTE = 'الجهاز مش بيقدر يتأكد من إحكام الـ N95 ولا ربط الجاون من ورا. اتأكد منهم بنفسك أو مع المشرفة.'
const STATE_LABEL = { ok: 'صح', missing: 'ناقص', wrong: 'مش مظبوط', uncertain: 'مش متأكد' }
const icon = (v: Verdict) => v.msg === 'waiting' ? ['wait', '…'] : v.state === 'ok' ? ['ok', '✓'] : v.state === 'uncertain' ? ['half', '⚠'] : ['no', '✗']

export function Lock() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
}

/** Camera preview sized to the video's own aspect ratio (follows phone rotation), so overlays line up with the frame. */
export function CamBox({ video, mirrored = true, onSwitch, children }: { video: RefObject<HTMLVideoElement>; mirrored?: boolean; onSwitch?: () => void; children?: ReactNode }) {
  const [ratio, setRatio] = useState(3 / 4)
  useEffect(() => {
    const v = video.current
    if (!v) return
    const fit = () => { if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight) }
    v.addEventListener('loadedmetadata', fit); v.addEventListener('resize', fit)   // 'resize' fires when a phone/tablet rotates
    return () => { v.removeEventListener('loadedmetadata', fit); v.removeEventListener('resize', fit) }
  }, [video])
  return (
    <div className="mcam" style={{ aspectRatio: String(ratio), width: `min(100%, calc(68vh * ${ratio}))` }}>
      <video ref={video} className={mirrored ? 'flip' : undefined} playsInline muted autoPlay />
      {children}
      {onSwitch && <button type="button" className="mswitch" onClick={onSwitch} aria-label="غيّر الكاميرا"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 13a3 3 0 0 1 5-2.2M15 13a3 3 0 0 1-5 2.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M14 9v2h-2M10 17v-2h2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>}
    </div>
  )
}

/** Tap the element 5 times quickly → toggle. */
export function useSecretTaps(onToggle: () => void) {
  const taps = useRef<number[]>([])
  return () => {
    const now = Date.now()
    taps.current = [...taps.current.filter(t => now - t < 2500), now]
    if (taps.current.length >= 5) { taps.current = []; onToggle() }
  }
}

function Row({ k, v, big, first }: { k: ItemId; v: Verdict; big?: boolean; first?: boolean }) {
  const [cls, ch] = icon(v)
  return (
    <div className="fbr" style={first ? { borderTop: 0 } : undefined}>
      <div className={'ic ' + cls}>{ch}</div>
      <h4>{MIRROR_ITEMS[k]}</h4>
      <span className="pt small">{v.msg === 'waiting' ? '' : STATE_LABEL[v.state]}</span>
      {(big || v.state !== 'ok') && <div className="why">{MIRROR_MSG[v.msg]}</div>}
    </div>
  )
}

export default function Mirror() {
  const { player } = useSession()
  const [phase, setPhase] = useState<'intro' | 'live' | 'done'>('intro')
  const [debug, setDebug] = useState(false)
  const tapTitle = useSecretTaps(() => setDebug(d => !d))
  const video = useRef<HTMLVideoElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const m = useMirror(video, overlay, phase === 'live', debug)
  const { reset, snapshot } = m
  const [deadline, setDeadline] = useState<number | null>(null)
  const [waitSince, setWaitSince] = useState<number | null>(null)
  const [result, setResult] = useState<{ v: Record<ItemId, Verdict>; saved: boolean | null } | null>(null)

  const start = () => { setDeadline(null); setWaitSince(null); setResult(null); setPhase('live'); window.scrollTo({ top: 0 }) }

  // the countdown starts as soon as someone is in front of the camera
  const seen = !!m.live?.frame.seen
  useEffect(() => {
    if (phase === 'live' && seen && !deadline && !waitSince) { reset(); setDeadline(Date.now() + COUNT_SECONDS * 1000) }
  }, [phase, seen, deadline, waitSince, reset])
  const countdownDone = useCallback(() => { setDeadline(null); setWaitSince(Date.now()) }, [])
  const left = useCountdown(phase === 'live' ? deadline : null, countdownDone)

  const finish = useCallback(() => {
    const { verdicts } = snapshot()
    setResult({ v: verdicts, saved: null }); setPhase('done'); setWaitSince(null); window.scrollTo({ top: 0 })
    rpc('save_mirror_check', { p_mask: verdicts.mask.state, p_gown: verdicts.gown.state, p_gloves: verdicts.gloves.state })
      .then(() => true, () => false).then(saved => setResult(r => (r ? { ...r, saved } : r)))
  }, [snapshot])
  // after the countdown, finish once a full window is collected (or give up waiting: missing frames count as not-ok)
  const count = m.live?.count ?? 0
  useEffect(() => {
    if (phase !== 'live' || !waitSince) return
    if (count >= CFG.vote.window) { finish(); return }
    const t = setTimeout(finish, Math.max(0, waitSince + MAX_WAIT_MS - Date.now()))
    return () => clearTimeout(t)
  }, [phase, waitSince, count, finish])

  const title = <div className="mhead"><h2 onClick={tapTitle}>المراية الذكية{debug && <span className="small"> · debug</span>}</h2><Link className="linkbtn" to="/">رجوع</Link></div>

  if (phase === 'intro') return (
    <div className="stack">
      {title}
      <div className="mprivacy"><Lock /><span>{PRIVACY}</span></div>
      <div className="card stack" style={{ gap: 8 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 20 }}>إزاي تتفحص</h3>
        <ol className="msteps">
          <li>البس الماسك والجاون والجوانتي.</li>
          <li>حط الجهاز على مستوى صدرك واقف قدامه على بعد متر ونص تقريبًا.</li>
          <li>خلي وشك وكتافك ودراعاتك يبانوا، وارفع إيديك الاتنين جنب كتافك وكفوفك ناحية الكاميرا.</li>
          <li>ثبت مكانك لحد ما العد يخلص.</li>
        </ol>
        <p className="small muted" style={{ fontWeight: 600 }}>ده تدريب ومساعدة بس، مش قرار سلامة نهائي. أول مرة بيحمّل ملفات الفحص (حوالي {ar(30)} ميجا)، وبعد كده بيشتغل من غير إنترنت.</p>
      </div>
      <button className="btn mint" onClick={start}>افتح الكاميرا</button>
      <Link className="linkbtn" to="/mirror/calibrate" style={{ alignSelf: 'center' }}>معايرة ألوان الواقيات</Link>
    </div>
  )

  if (phase === 'done' && result) {
    const o = overall(result.v)
    const head = { pass: 'لابس الواقيات صح!', fail: 'فيه حاجة ناقصة', uncertain: 'مش متأكد من كل حاجة' }[o]
    return (
      <div className="stack">
        <Confetti fire={o === 'pass' ? 1 : 0} />
        {title}
        <div className="bigscore"><h1 className="white" style={{ fontFamily: 'var(--display)', fontSize: 34 }}>{head}</h1></div>
        <div className="card mres" style={{ paddingTop: 6 }}>{ITEMS.map((k, i) => <Row key={k} k={k} v={result.v[k]} big first={i === 0} />)}</div>
        <div className="banner">{N95_NOTE}</div>
        <p className="saved">{result.saved === null ? 'بنسجل النتيجة...' : result.saved ? 'النتيجة اتسجلت (من غير أي صورة).' : 'مقدرناش نحفظ النتيجة. اتأكد من الإنترنت.'}</p>
        <button className="btn mint" onClick={start}>افحص تاني</button>
        <Link className="btn ghost" to="/">الرئيسية</Link>
      </div>
    )
  }

  const v = m.live?.voted
  return (
    <div className="stack">
      {title}
      <div className="hud"><div className="chipx"><div className="av" style={{ background: '#B8F0DC' }}>{initial(player?.name)}</div><span className="nm">{player?.name}</span></div></div>
      {m.error && <ErrorBox text={errorText(m.error)} retry={m.retry} />}
      {/* the video stays mounted on errors so a retry has somewhere to attach the stream */}
      <div hidden={!!m.error}><CamBox video={video} mirrored={m.mirrored} onSwitch={m.canSwitch && !m.loading ? m.switchCamera : undefined}>
        <canvas ref={overlay} />
        {m.loading ? <div className="mload"><div className="spin" aria-hidden="true" /><p>بنجهّز الكاميرا والفحص...</p><p className="small" style={{ opacity: .85 }}>{PRIVACY}</p></div> : <>
          <div className="mcount" aria-live="polite">
            {deadline ? <><span>ثبت مكانك</span><b key={Math.ceil(left)}>{ar(Math.min(COUNT_SECONDS, Math.max(1, Math.ceil(left))))}</b></>
              : waitSince ? <span>لحظة...</span>
              : <span>{v ? 'اقف قدام الكاميرا' : 'بيفحص...'}</span>}
          </div>
          {v && <div className="card mrows">{ITEMS.map((k, i) => <Row key={k} k={k} v={v[k]} first={i === 0} />)}</div>}
        </>}
      </CamBox></div>
      {!m.error && <p className="hint">ارفع إيديك الاتنين جنب كتافك وكفوفك ناحية الكاميرا</p>}
      {!m.error && <button className="btn ghost" onClick={() => setPhase('intro')}>وقف الكاميرا</button>}
    </div>
  )
}
