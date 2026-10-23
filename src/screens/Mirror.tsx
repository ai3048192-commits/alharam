import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../lib/session'
import { errorText, initial, MIRROR_FIX, MIRROR_ITEMS, MIRROR_LIMITS, MIRROR_MSG, MIRROR_NEXT, MIRROR_ORDER } from '../lib/content'
import { Confetti, ErrorBox } from '../components/ui'
import { CFG, ITEMS, coach, overall, type ItemId, type Verdict } from '../mirror/checks'
import { useMirror } from '../mirror/useMirror'
import { saveResult, type SaveResult } from '../mirror/queue'
import '../mirror/mirror.css'

export const PRIVACY = 'الكاميرا بتتحلل على الجهاز ده بس، ومفيش أي صورة بتتحفظ أو بتتبعت.'
const SAVED_NOTE = { saved: 'النتيجة اتسجلت (من غير أي صورة).', queued: 'مفيش نت دلوقتي. النتيجة متحفظة على الجهاز وهتتبعت لوحدها لما النت يرجع.', failed: 'مقدرناش نحفظ النتيجة.' }
const STATE_LABEL = { ok: 'صح', missing: 'ناقص', wrong: 'غلط', uncertain: 'مش متأكد' }
const icon = (v: Verdict) => v.msg === 'waiting' ? ['wait', '…'] : v.state === 'ok' ? ['ok', '✓'] : v.state === 'uncertain' ? ['half', '⚠'] : ['no', '✗']

export function Lock() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
}

/** Camera preview sized to the video's own aspect ratio (follows phone rotation), so overlays line up with the frame. */
export function CamBox({ video, mirrored = true, onSwitch, maxVh = 68, children }: { video: RefObject<HTMLVideoElement>; mirrored?: boolean; onSwitch?: () => void; maxVh?: number; children?: ReactNode }) {
  const [ratio, setRatio] = useState(3 / 4)
  useEffect(() => {
    const v = video.current
    if (!v) return
    const fit = () => { if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight) }
    v.addEventListener('loadedmetadata', fit); v.addEventListener('resize', fit)   // 'resize' fires when a phone/tablet rotates
    return () => { v.removeEventListener('loadedmetadata', fit); v.removeEventListener('resize', fit) }
  }, [video])
  return (
    <div className="mcam" style={{ aspectRatio: String(ratio), width: `min(100%, calc(${maxVh}vh * ${ratio}))` }}>
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

/** One PPE item: state, what's wrong, and «اعمل كده» (how to fix it) for ✗ results. */
function Row({ k, v, first }: { k: ItemId; v: Verdict; first?: boolean }) {
  const [cls, ch] = icon(v)
  const fix = v.state === 'missing' || v.state === 'wrong' ? MIRROR_FIX[v.msg] : undefined
  return (
    <div className="fbr" style={first ? { borderTop: 0, paddingTop: 0 } : undefined}>
      <div className={'ic ' + cls}>{ch}</div>
      <h4>{MIRROR_ITEMS[k]}</h4>
      <span className="pt small">{v.msg === 'waiting' ? '' : STATE_LABEL[v.state]}</span>
      {v.state !== 'ok' && <div className="why">{MIRROR_MSG[v.msg]}</div>}
      {fix && <div className="mfix"><b>اعمل كده:</b> {fix}</div>}
    </div>
  )
}

/* Live coaching: put the PPE on in front of the camera; every item is checked continuously, no timer and no sign-in. */
export default function Mirror() {
  const { player } = useSession()
  const [on, setOn] = useState(false)
  const [debug, setDebug] = useState(false)
  const tapTitle = useSecretTaps(() => setDebug(d => !d))
  const video = useRef<HTMLVideoElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const m = useMirror(video, overlay, on, debug)
  const [party, setParty] = useState(0)
  const [saved, setSaved] = useState<SaveResult | null>(null)
  const savedRun = useRef(false)   // one saved result per camera session

  const v = m.live?.voted
  const full = (m.live?.count ?? 0) >= CFG.vote.window
  const o = v && full ? overall(v) : null
  const c = v && full ? coach(v) : null
  const pass = o === 'pass'

  // saved for the department head only when this device has a name + department (the server checks); offline results wait on the device
  const save = useCallback((r: Record<ItemId, Verdict>) => {
    if (savedRun.current) return
    savedRun.current = true
    saveResult({ head: r.head.state, mask: r.mask.state, gown: r.gown.state, gloves: r.gloves.state }).then(setSaved)
  }, [])

  const latest = useRef(v)
  latest.current = v
  useEffect(() => { if (pass && latest.current) { setParty(p => p + 1); save(latest.current) } }, [pass, save])

  const start = () => { savedRun.current = false; setSaved(null); setOn(true); window.scrollTo({ top: 0 }) }
  const stop = () => { if (v && o && o !== 'uncertain') save(v); setOn(false) }
  const savedNote = saved && saved !== 'skipped' && <p className="saved">{SAVED_NOTE[saved]}</p>

  const title = <div className="mhead"><h2 onClick={tapTitle}>المراية الذكية{debug && <span className="small"> · debug</span>}</h2><Link className="linkbtn" to="/">رجوع</Link></div>

  if (!on) return (
    <div className="stack">
      {title}
      <div className="mprivacy"><Lock /><span>{PRIVACY}</span></div>
      <div className="card stack" style={{ gap: 8 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 20 }}>إزاي تستخدمها</h3>
        <ol className="msteps">
          <li>افتح الكاميرا واقف قدامها على بعد متر ونص تقريبًا، بحيث راسك وكتافك ودراعاتك يبانوا.</li>
          <li>البس الواقيات قدامها بالترتيب: غطا الراس، بعده الماسك، بعده الجاون، والجوانتي آخر حاجة.</li>
          <li>وانت بتلبس، هتقولك على طول كل حاجة لابسها صح ولا غلط، ولو غلط تصلحها إزاي.</li>
          <li>للجوانتي: ارفع إيديك الاتنين جنب كتافك وكفوفك ناحية الكاميرا.</li>
        </ol>
        <p className="small muted" style={{ fontWeight: 600 }}>ده تدريب ومساعدة بس، مش قرار سلامة نهائي. أول مرة بيحمّل ملفات الفحص (حوالي ٣٠ ميجا)، وبعد كده بيشتغل من غير إنترنت.</p>
      </div>
      {savedNote}
      <button className="btn mint" onClick={start}>افتح الكاميرا</button>
      <Link className="linkbtn" to="/mirror/calibrate" style={{ alignSelf: 'center' }}>معايرة ألوان الواقيات</Link>
    </div>
  )

  const headline = !v || !full ? 'بيفحص... اقف قدام الكاميرا'
    : pass ? '✓ كده لابس كل حاجة صح. تقدر تدخل.'
    : o === 'fail' ? 'فيه حاجة محتاجة تتصلح'
    : c?.next ? MIRROR_NEXT[c.next] : 'ثبت مكانك شوية'
  return (
    <div className="stack">
      <Confetti fire={party} />
      {title}
      {player && <div className="hud"><div className="chipx"><div className="av" style={{ background: '#B8F0DC' }}>{initial(player.name)}</div><span className="nm">{player.name}</span></div></div>}
      {m.error && <ErrorBox text={errorText(m.error)} retry={m.retry} />}
      {/* the video stays mounted on errors so a retry has somewhere to attach the stream */}
      <div hidden={!!m.error} className="stack">
        <CamBox video={video} mirrored={m.mirrored} maxVh={52} onSwitch={m.canSwitch && !m.loading ? m.switchCamera : undefined}>
          <canvas ref={overlay} />
          {m.loading && <div className="mload"><div className="spin" aria-hidden="true" /><p>بنجهّز الكاميرا والفحص...</p><p className="small" style={{ opacity: .85 }}>{PRIVACY}</p></div>}
          {pass && <div className="mpass" aria-hidden="true">✓</div>}
        </CamBox>
        {!m.loading && <div className={'card mlive' + (pass ? ' pass' : o === 'fail' ? ' fail' : '')} aria-live="polite">
          <h3>{headline}</h3>
          {c?.order && <p className="morder">{MIRROR_ORDER}</p>}
          {ITEMS.map((k, i) => <Row key={k} k={k} v={v && full ? v[k] : { state: 'uncertain', msg: 'waiting' }} first={i === 0} />)}
        </div>}
        <div className="banner">{MIRROR_LIMITS}</div>
        {savedNote}
      </div>
      <button className="btn ghost" onClick={stop}>وقف الكاميرا</button>
    </div>
  )
}
