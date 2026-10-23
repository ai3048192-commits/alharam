/* Smart PPE Check station (/kiosk): a wall tablet or a portrait monitor + webcam next to the «PPE Corner» shelf.
   Hands-free loop: IDLE → someone stands on the sticker (~1.5 s) → DETECTING (live boxes + checklist, then ٣…٢…١)
   → RESULT (~8 s) → re-check if they stay and fix it, back to IDLE when nobody is there (~3 s).
   Reuses the personal mirror's camera, models, checks and calibration; no frame is stored or sent. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ar, errorText, KIOSK_SHELF, MIRROR_FIX, MIRROR_ITEMS, MIRROR_ITEMS_EN, MIRROR_LIMITS, MIRROR_MSG } from '../lib/content'
import { Confetti, Svg } from '../components/ui'
import { CFG, overall, type ItemId, type Verdict } from '../mirror/checks'
import { useMirror, type Live } from '../mirror/useMirror'
import { saveResult } from '../mirror/queue'
import { cacheToday, cachedToday, enabledItems, loadKiosk, type Rotate } from './settings'
import { PLAY_ICON, PPE_ICON, STEP_ICON } from './icons'
import './kiosk.css'

type Phase = 'idle' | 'detect' | 'result'
type Tone = 'ok' | 'bad' | 'warn' | 'wait'
const START_AFTER_MS = 1500   // a full-enough body this long → start checking
const LEAVE_AFTER_MS = 3000   // nobody in front this long → back to idle
const COUNT_MS = 3000         // «ثبت مكانك ٣… ٢… ١»
const RETRY_MS = 10000        // camera/model failure → retry this often
const FROZEN_MS = 10000       // no new analysed frame this long → reopen the camera
const CURSOR_MS = 3000
const IDLE_FPS = 5            // analyse slowly while nobody is there (the tablet stays cool)
const PRIVACY = 'الكاميرا بتتحلل على الجهاز ده بس، ومفيش أي صورة بتتحفظ'
const COLOR: Record<Tone, string> = { ok: '#1FB866', bad: '#E5383B', warn: '#FFC93C', wait: '#FFFFFF' }
const SYMBOL: Record<Tone, string> = { ok: '✓', bad: '✗', warn: '⚠', wait: '…' }
const tone = (v?: Verdict): Tone => !v || v.msg === 'waiting' ? 'wait' : v.state === 'ok' ? 'ok' : v.state === 'uncertain' ? 'warn' : 'bad'
const RESTART_KEYS = [' ', 'Enter', 'PageDown', 'PageUp', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']   // keyboard or presentation clicker

/** Camera preview turned/flipped exactly like the analysed frame, fitted inside its container. */
export function KioskCam({ video, rotate, flip, children }: { video: RefObject<HTMLVideoElement>; rotate: Rotate; flip: boolean; children?: ReactNode }) {
  const [ratio, setRatio] = useState(16 / 9)   // the camera's own width / height
  useEffect(() => {
    const v = video.current
    if (!v) return
    const fit = () => { if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight) }
    v.addEventListener('loadedmetadata', fit); v.addEventListener('resize', fit)
    return () => { v.removeEventListener('loadedmetadata', fit); v.removeEventListener('resize', fit) }
  }, [video])
  const side = rotate % 180 !== 0
  const r = side ? 1 / ratio : ratio   // what is shown: width / height
  const vs = {
    width: side ? `${100 / r}%` : '100%', height: side ? `${100 * r}%` : '100%',
    transform: `translate(-50%,-50%)${flip ? ' scaleX(-1)' : ''} rotate(${rotate}deg)`,
  }
  return (
    <div className="kcam" style={{ aspectRatio: String(r), width: `min(100cqw, calc(100cqh * ${r}))` }}>
      <video ref={video} style={vs} playsInline muted autoPlay />
      {children}
    </div>
  )
}

/** Green / red / yellow rounded boxes around the head, face, each hand and the gown (on the analysed, upright frame). */
function drawBoxes(cv: HTMLCanvasElement, live: Live, items: ItemId[], mirrored: boolean) {
  const { w, h, face, hands, pose } = live.lm
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, w, h)
  const full = live.count >= CFG.vote.window
  const col = (k: ItemId) => COLOR[full ? tone(live.voted[k]) : 'wait']
  const lw = Math.max(3, w / 110), fs = Math.max(12, Math.round(w / 28))
  g.lineWidth = lw; g.font = `800 ${fs}px "Baloo Bhaijaan 2", system-ui, sans-serif`; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle'
  const bb = (ps: { x: number; y: number }[]) => ({ x0: Math.min(...ps.map(p => p.x)), y0: Math.min(...ps.map(p => p.y)), x1: Math.max(...ps.map(p => p.x)), y1: Math.max(...ps.map(p => p.y)) })
  const box = (b: { x0: number; y0: number; x1: number; y1: number }, pad: number, c: string, label: string) => {
    const nx0 = Math.max(0, b.x0 - pad), nx1 = Math.min(1, b.x1 + pad), ny0 = Math.max(0, b.y0 - pad), ny1 = Math.min(1, b.y1 + pad)
    const X0 = (mirrored ? 1 - nx1 : nx0) * w, X1 = (mirrored ? 1 - nx0 : nx1) * w, Y0 = ny0 * h, Y1 = ny1 * h
    g.strokeStyle = c; g.beginPath()
    if (g.roundRect) g.roundRect(X0, Y0, X1 - X0, Y1 - Y0, lw * 3); else g.rect(X0, Y0, X1 - X0, Y1 - Y0)
    g.stroke()
    const tw = g.measureText(label).width + fs * 0.8, th = fs * 1.35
    g.fillStyle = c; g.fillRect(X1 - tw, Math.max(0, Y0 - th), tw, th)
    g.fillStyle = '#0B1F44'; g.fillText(label, X1 - fs * 0.4, Math.max(0, Y0 - th) + th / 2)
  }
  const label = (k: ItemId) => `${MIRROR_ITEMS[k]} ${SYMBOL[full ? tone(live.voted[k]) : 'wait']}`
  if (pose && pose.length > 24 && items.includes('gown')) {
    const t = bb([11, 12, 23, 24].map(i => ({ x: pose[i].x, y: Math.min(1, pose[i].y) })))
    box(t, 0.02, col('gown'), label('gown'))
  }
  if (face && face.length > 454) {
    const f = bb(face), fh = f.y1 - f.y0
    if (items.includes('head')) box({ x0: f.x0, x1: f.x1, y0: face[10].y - 0.5 * fh, y1: face[10].y + 0.06 * fh }, 0.01, col('head'), label('head'))
    if (items.includes('mask')) box(f, 0.015, col('mask'), label('mask'))
  }
  if (items.includes('gloves')) hands.forEach((hd, i) => {
    const st = live.frame.hands[i]
    const c = full && live.voted.gloves.state === 'ok' ? COLOR.ok : COLOR[st === 'gloved' ? 'ok' : st === 'bare' ? 'bad' : 'warn']
    box(bb(hd), 0.015, c, MIRROR_ITEMS.gloves)
  })
}

export default function Kiosk() {
  const cfg = useMemo(loadKiosk, [])
  const items = useMemo(() => enabledItems(cfg), [cfg])
  const test = useMemo(() => new URLSearchParams(location.search).has('test'), [])
  const { ready } = useSession()
  const video = useRef<HTMLVideoElement>(null)
  const dbgCv = useRef<HTMLCanvasElement>(null)
  const boxCv = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ v: Record<ItemId, Verdict>; o: 'pass' | 'fail' | 'uncertain' } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [party, setParty] = useState(0)
  const [cursor, setCursor] = useState(true)
  const [today, setToday] = useState<number | null>(cachedToday)
  const m = useMirror(video, dbgCv, true, test, {
    size: { width: cfg.width, height: cfg.height }, rotate: cfg.rotate, mirrored: cfg.flip,
    fps: phase === 'idle' ? IDLE_FPS : undefined,
  })
  const s = useRef({ presentSince: 0, lastSeen: 0, needLeave: false, deadline: 0, resultUntil: 0, restartedAt: 0 })
  const event = cfg.event || cfg.title

  // presence: a full-enough body (face + both shoulders) starts a check; any face/body keeps it going
  useEffect(() => {
    const f = m.live?.frame
    if (!f) return
    const t = Date.now(), st = s.current
    if (f.body) st.presentSince ||= t; else st.presentSince = 0
    if (f.seen) st.lastSeen = t
    if (boxCv.current && m.live && phase !== 'idle') drawBoxes(boxCv.current, m.live, items, cfg.flip)
  }, [m.live, phase, items, cfg.flip])

  const refreshCount = useCallback(() => {
    rpc<number>('kiosk_today_count', { p_event: event }).then(n => { setToday(n); cacheToday(n) }, () => {})
  }, [event])
  useEffect(() => {
    if (!ready) return
    refreshCount()
    const id = setInterval(refreshCount, 5 * 60_000)
    return () => clearInterval(id)
  }, [ready, refreshCount])

  const start = useCallback(() => {
    // counts as "someone is here" for a moment, so a clicker press shows the guidance even if nobody is detected yet
    m.reset(); s.current.deadline = 0; s.current.needLeave = false; s.current.lastSeen = Date.now()
    setResult(null); setPhase('detect')
  }, [m.reset])   // eslint-disable-line react-hooks/exhaustive-deps
  const toIdle = useCallback(() => { s.current.deadline = 0; setResult(null); setPhase('idle') }, [])

  const finish = () => {
    const { verdicts } = m.snapshot()
    const o = overall(verdicts, items)
    s.current.deadline = 0
    s.current.resultUntil = Date.now() + cfg.resultSeconds * 1000
    setResult({ v: verdicts, o }); setPhase('result')
    if (o === 'pass') setParty(p => p + 1)
    const st = (k: ItemId) => (items.includes(k) ? verdicts[k].state : null)
    saveResult({ head: st('head'), mask: st('mask'), gown: st('gown'), gloves: st('gloves'), source: 'kiosk', event }).then(r => {
      if (r === 'saved') refreshCount()
      else if (r === 'queued') setToday(n => { const v = (n ?? 0) + 1; cacheToday(v); return v })   // offline: counted now, sent later
    })
  }

  // the station's clock: 4 times a second, decide what comes next
  const step = useRef<() => void>(() => {})
  step.current = () => {
    const t = Date.now(), st = s.current, live = m.live
    setNow(t)
    if (m.error || m.loading) return
    if (live && t - live.at > FROZEN_MS && t - st.restartedAt > FROZEN_MS) { st.restartedAt = t; m.restart(); return }   // frozen video
    const absent = t - st.lastSeen
    if (phase === 'idle') {
      if (st.needLeave && absent >= START_AFTER_MS) st.needLeave = false   // after a GO, wait for that person to leave
      if (!st.needLeave && st.presentSince && t - st.presentSince >= START_AFTER_MS) start()
    } else if (phase === 'detect') {
      if (absent >= LEAVE_AFTER_MS) return toIdle()
      if (!st.deadline && (live?.count ?? 0) >= CFG.vote.window) st.deadline = t + COUNT_MS
      if (st.deadline && t >= st.deadline) finish()
    } else {
      if (absent >= LEAVE_AFTER_MS) return toIdle()
      if (t >= st.resultUntil) {
        if (result?.o === 'pass') { st.needLeave = true; toIdle() }
        else if (absent < 1000) start()   // still here (fixing it) → check again
        else toIdle()
      }
    }
  }
  useEffect(() => { const id = setInterval(() => step.current(), 250); return () => clearInterval(id) }, [])

  // auto-recover: camera or model failure → retry every 10 s, never a frozen error screen
  const retry = useRef(m.retry)
  retry.current = m.retry
  useEffect(() => {
    if (!m.error) return
    const id = setInterval(() => retry.current(), RETRY_MS)
    return () => clearInterval(id)
  }, [m.error])

  // keyboard / presentation clicker: start a check now
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (RESTART_KEYS.includes(e.key)) { e.preventDefault(); start() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start])

  // wall-station reliability: keep the screen on, hide the mouse, reload once a day at 4 AM
  useEffect(() => {
    let lock: { release?: () => Promise<void> } | null = null
    const wake = async () => { try { lock = await (navigator as any).wakeLock?.request('screen') } catch { /* not supported or refused: ignore */ } }
    const onVis = () => { if (document.visibilityState === 'visible') wake() }
    wake(); document.addEventListener('visibilitychange', onVis)
    let hide = setTimeout(() => setCursor(false), CURSOR_MS)
    const onMove = () => { setCursor(true); clearTimeout(hide); hide = setTimeout(() => setCursor(false), CURSOR_MS) }
    window.addEventListener('mousemove', onMove)
    const at4 = new Date(); at4.setHours(4, 0, 0, 0); if (at4.getTime() <= Date.now()) at4.setDate(at4.getDate() + 1)
    const reload = setTimeout(() => location.reload(), at4.getTime() - Date.now())
    return () => {
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('mousemove', onMove)
      clearTimeout(hide); clearTimeout(reload); lock?.release?.().catch(() => {})
    }
  }, [])

  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}) }

  const live = m.live
  const full = (live?.count ?? 0) >= CFG.vote.window
  const left = s.current.deadline ? Math.max(1, Math.ceil((s.current.deadline - now) / 1000)) : 0
  const frameHint = live && items.map(k => live.frame[k]).find(v => v.state === 'uncertain' && v.msg !== 'waiting')
  const guide = phase !== 'detect' ? '' : frameHint ? MIRROR_MSG[frameHint.msg] : full ? '' : 'خليك واقف قدام الكاميرا'
  const problems = result ? items.filter(k => result.v[k].state !== 'ok') : []

  return (
    <div className={'kiosk' + (cfg.mirrorMode ? ' mm' : '') + (cursor ? '' : ' nocursor')} dir="rtl" lang="ar">
      <Confetti fire={party} n={60} />
      <header className="khead">
        <div className="kbrand"><b>{cfg.title}</b>{cfg.subtitle && <span>{cfg.subtitle}</span>}</div>
        {cfg.tagline && <span className="ktag">{cfg.tagline}</span>}
      </header>

      <main className="kmain">
        <div className="kcamwrap" style={{ opacity: phase === 'idle' ? 0 : 1 }}>{/* still running while idle: it detects who steps in */}
          <KioskCam video={video} rotate={cfg.rotate} flip={cfg.flip}>
            <canvas ref={boxCv} style={{ visibility: phase === 'idle' ? 'hidden' : 'visible' }} />
            <canvas ref={dbgCv} />
            {guide && <div className="kguide">{guide}</div>}
            {phase === 'detect' && left > 0 && <div className="kcount"><div><span>ثبت مكانك</span><b key={left}>{ar(left)}</b></div></div>}
          </KioskCam>
        </div>

        <div className="klist">
          {items.map(k => {
            const tn: Tone = phase === 'result' && result ? tone(result.v[k]) : full && live ? tone(live.voted[k]) : 'wait'
            return (
              <div key={k} className={'krow ' + tn}>
                <span className="ki"><Svg html={PPE_ICON[k]} /></span>
                <span className="kn"><b>{MIRROR_ITEMS[k]}</b><small>{MIRROR_ITEMS_EN[k]}</small></span>
                <span className="ks" aria-label={tn}>{SYMBOL[tn]}</span>
              </div>
            )
          })}
          <p className="klimits">{MIRROR_LIMITS}</p>
        </div>

        {phase === 'result' && result && (
          <section className={'kresult ' + (result.o === 'pass' ? 'pass' : result.o === 'fail' ? 'fail' : 'unsure')} aria-live="assertive">
            {result.o === 'pass' ? <>
              <h1>PPE CORRECT ✓</h1>
              <p className="kgo">اتفضل ادخل · Safe patients</p>
            </> : <>
              <h1>PPE INCOMPLETE</h1>
              {problems.map(k => {
                const v = result.v[k]
                const fix = v.state === 'missing' || v.state === 'wrong' ? MIRROR_FIX[v.msg] : undefined
                return (
                  <div className="kfix" key={k}>
                    <span className="ki"><Svg html={PPE_ICON[k]} /></span>
                    <b>{MIRROR_ITEMS[k]}</b>
                    <span>{MIRROR_MSG[v.msg]}</span>
                    {v.state === 'missing' ? <i className="shelf">{KIOSK_SHELF[k]}{fix ? ' · ' + fix : ''}</i> : fix ? <i>{fix}</i> : <i>{' '}</i>}
                  </div>
                )
              })}
              <p className="kagain">صلّح وخليك واقف، وهنفحص تاني على طول</p>
            </>}
          </section>
        )}

        {phase === 'idle' && (
          <section className="kidle">
            <span className="kplay"><Svg html={PLAY_ICON} /></span>
            <h1>Stand &amp; Check</h1>
            <p>قف على العلامة اللي على الأرض</p>
            <div className="ksteps">
              <div><Svg html={STEP_ICON.stand} /><b>STAND</b><span>قف</span></div><i>→</i>
              <div><Svg html={STEP_ICON.check} /><b>CHECK</b><span>افحص</span></div><i>→</i>
              <div><Svg html={STEP_ICON.go} /><b>GO</b><span>ادخل</span></div>
            </div>
            {today !== null && <span className="kcounter">اتفحص النهارده: {ar(today)}</span>}
            <span className="kprivacy">{PRIVACY}</span>
          </section>
        )}

        {(m.error || m.loading) && (
          <section className="krecover" aria-live="polite">
            <div className="kspin" aria-hidden="true" />
            <b>{m.error ? 'بنعيد التشغيل…' : 'بنجهّز الكاميرا والفحص…'}</b>
            <span>{m.error ? errorText(m.error) + ' (بنحاول تاني كل ١٠ ثواني)' : 'أول مرة بس بياخد وقت لحد ما ملفات الفحص تتحمّل.'}</span>
          </section>
        )}
      </main>

      <footer className="kfoot">
        <span>{cfg.event}{test && ' · TEST'}</span>
        <nav>
          <button type="button" onClick={start}>ابدأ</button>
          <button type="button" onClick={fullscreen}>ملء الشاشة</button>
          <Link to="/kiosk/settings">الإعدادات</Link>
        </nav>
      </footer>
    </div>
  )
}
