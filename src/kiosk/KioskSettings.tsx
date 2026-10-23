/* /kiosk/settings — protected by the station PIN (set on first open, stored only as a hash on this device). */
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorText, MIRROR_ITEMS } from '../lib/content'
import { Field } from '../components/ui'
import { ITEMS } from '../mirror/checks'
import { useCamera } from '../mirror/useMirror'
import { KioskCam } from './Kiosk'
import { KIOSK_DEFAULTS, RESOLUTIONS, ROTATIONS, checkPin, hasPin, isUnlocked, loadKiosk, saveKiosk, setPin, unlock, type KioskSettings as Settings, type Rotate } from './settings'
import './kiosk.css'

function PinGate({ onOpen }: { onOpen: () => void }) {
  const first = !hasPin()
  const [pin, setP] = useState('')
  const [again, setAgain] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form className="card stack" style={{ gap: 10 }} onSubmit={async e => {
      e.preventDefault(); setErr('')
      if (first) {
        if (!/^\d{4,8}$/.test(pin)) return setErr('الرقم السري لازم يكون من ٤ لـ ٨ أرقام.')
        if (pin !== again) return setErr('الرقمين مش زي بعض.')
      }
      setBusy(true)
      try {
        if (first) await setPin(pin)
        else if (!(await checkPin(pin))) { setErr('الرقم السري غلط.'); return }
        unlock(); onOpen()
      } catch { setErr('المتصفح مش بيدعم حفظ الرقم السري هنا. افتح المحطة من لينك https.') }
      finally { setBusy(false) }
    }}>
      <h3 style={{ fontFamily: 'var(--display)', fontSize: 20 }}>{first ? 'حط رقم سري للمحطة' : 'الرقم السري للمحطة'}</h3>
      {first && <p className="small muted">أول مرة: اختار رقم سري (٤ لـ ٨ أرقام). هيتطلب كل ما حد يفتح الإعدادات على الجهاز ده.</p>}
      <Field label="الرقم السري"><input id="kpin" type="password" inputMode="numeric" dir="ltr" value={pin} onChange={e => setP(e.target.value)} autoFocus autoComplete={first ? 'new-password' : 'current-password'} /></Field>
      {first && <Field label="اكتبه تاني"><input id="kpin2" type="password" inputMode="numeric" dir="ltr" value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" /></Field>}
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{first ? 'احفظ وادخل' : 'ادخل'}</button>
    </form>
  )
}

export default function KioskSettings() {
  const [open, setOpen] = useState(isUnlocked)
  const [s, setS] = useState<Settings>(loadKiosk)
  const [saved, setSaved] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pinNote, setPinNote] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const cam = useCamera(video, open, { width: s.width, height: s.height })
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS(x => ({ ...x, [k]: v })); setSaved(false) }

  const head = <div className="mhead"><h2>إعدادات المحطة</h2><Link className="linkbtn" to="/kiosk">المحطة</Link></div>
  if (!open) return <div className="stack">{head}<PinGate onOpen={() => setOpen(true)} /></div>

  const save = () => { saveKiosk(s); setSaved(true) }
  return (
    <div className="stack">
      {head}

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">الكاميرا</h3>
        <div className="kcamwrap" style={{ height: '46vh' }}>
          <KioskCam video={video} rotate={s.rotate} flip={s.flip} />
        </div>
        {cam.error && <p className="err">{errorText(cam.error)} <button type="button" className="linkbtn" style={{ color: '#fff' }} onClick={cam.retry}>جرب تاني</button></p>}
        <Field label="الكاميرا (مثلًا كاميرا USB)">
          <select id="kcam" value={cam.current || ''} onChange={e => cam.selectCamera(e.target.value)}>
            {!cam.cameras.length && <option value="">بنفتح الكاميرا...</option>}
            {cam.cameras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="الجودة">
          <select id="kres" value={s.width + 'x' + s.height} onChange={e => { const [w, h] = e.target.value.split('x').map(Number); setS(x => ({ ...x, width: w, height: h })); setSaved(false) }}>
            {RESOLUTIONS.map(([w, h]) => <option key={w} value={w + 'x' + h}>{w}×{h}{w === 1280 ? ' (الأنسب)' : ''}</option>)}
          </select>
        </Field>
        <Field label="لف الصورة (لو الشاشة أو الكاميرا متركبة بالطول)">
          <div className="seg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {ROTATIONS.map(r => <button key={r} type="button" aria-pressed={s.rotate === r} onClick={() => set('rotate', r as Rotate)}>{r}°</button>)}
          </div>
        </Field>
        <label className="opt" style={{ background: '#fff' }}><input id="kflip" type="checkbox" checked={s.flip} onChange={e => set('flip', e.target.checked)} /> اعرض الصورة زي المراية (اليمين يمين)</label>
        <label className="opt" style={{ background: '#fff' }}><input id="kmm" type="checkbox" checked={s.mirrorMode} onChange={e => set('mirrorMode', e.target.checked)} /> وضع المراية: من غير فيديو، مربعات وكلام بس على خلفية سودا (لمراية الاتجاهين)</label>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">اللي بيتفحص</h3>
        <div className="optgrid">
          {ITEMS.map(k => <label key={k} className={'opt' + (s.items[k] ? ' on' : '')}><input type="checkbox" checked={s.items[k]}
            onChange={e => { const items = { ...s.items, [k]: e.target.checked }; if (ITEMS.some(i => items[i])) set('items', items) }} /> {MIRROR_ITEMS[k]}</label>)}
        </div>
        <p className="small muted">النضارة وإحكام الـ N95 وربط الجاون من ورا مش بيتفحصوا: الكاميرا مش بتشوفهم.</p>
        <Field label="مدة عرض النتيجة (ثواني)"><input id="ksec" type="number" min={3} max={30} value={s.resultSeconds} onChange={e => set('resultSeconds', Math.min(30, Math.max(3, Number(e.target.value) || 8)))} /></Field>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">اسم المحطة</h3>
        <Field label="العنوان"><input id="ktitle" dir="auto" maxLength={40} value={s.title} onChange={e => set('title', e.target.value)} /></Field>
        <Field label="العنوان الفرعي"><input id="ksub" dir="auto" maxLength={80} value={s.subtitle} onChange={e => set('subtitle', e.target.value)} /></Field>
        <Field label="الشعار"><input id="ktag" dir="auto" maxLength={60} value={s.tagline} onChange={e => set('tagline', e.target.value)} /></Field>
        <Field label="اسم الحدث أو مكان المحطة (بيتسجل مع النتايج)"><input id="kevent" dir="auto" maxLength={80} value={s.event} placeholder="مثلًا: مدخل العناية المركزة" onChange={e => set('event', e.target.value)} /></Field>
        <button type="button" className="btn white sm" onClick={() => { setS(x => ({ ...KIOSK_DEFAULTS, event: x.event })); setSaved(false) }}>رجّع الإعدادات الأصلية</button>
      </div>

      <button className="btn mint" onClick={save}>{saved ? 'اتحفظ ✓' : 'احفظ'}</button>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Link className="btn white" to="/kiosk">افتح المحطة</Link>
        <Link className="btn white" to="/kiosk?test=1" title="بيعرض النقط والألوان اللي بيتفحص بيها">اختبار</Link>
      </div>
      <Link className="btn white" to="/mirror/calibrate?from=kiosk">معايرة ألوان الواقيات الأربعة</Link>
      <Link className="btn ghost" to="/kiosk/print">اطبع لافتات المحطة</Link>

      <form className="card stack" style={{ gap: 8 }} onSubmit={async e => {
        e.preventDefault()
        if (!/^\d{4,8}$/.test(newPin)) return setPinNote('الرقم السري لازم يكون من ٤ لـ ٨ أرقام.')
        await setPin(newPin); setNewPin(''); setPinNote('اتغيّر الرقم السري ✓')
      }}>
        <Field label="غيّر الرقم السري"><input id="knewpin" type="password" inputMode="numeric" dir="ltr" value={newPin} onChange={e => setNewPin(e.target.value)} autoComplete="new-password" /></Field>
        {pinNote && <p className="small" style={{ fontWeight: 700 }}>{pinNote}</p>}
        <button className="btn white sm">غيّر</button>
      </form>
    </div>
  )
}
