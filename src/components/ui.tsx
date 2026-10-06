import { useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { STAR, HALFSTAR, GERM, SPARK, roomSVG, ROOM_IN, avatarSVG } from '../art'
import { SIGNS, signBG, signShadow, ar, DOOR_SECONDS, type SignId } from '../lib/content'
import { nativeShare, whatsappLink, copyText, type ShareData } from '../lib/share'

/** Render a trusted, static SVG string. */
export function Svg({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={{ display: 'contents', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export function Stars({ states, big }: { states: ('ok' | 'half' | 'no' | boolean)[]; big?: boolean }) {
  return (
    <div className="stars" style={big ? { marginTop: 10 } : undefined}
      dangerouslySetInnerHTML={{ __html: states.map(s => (s === 'half' ? HALFSTAR : STAR(s === 'ok' || s === true))).join('') }} />
  )
}

export function Loading({ text = 'لحظة...' }: { text?: string }) {
  return <div className="loading"><div className="spin" aria-hidden="true" /><p>{text}</p></div>
}

export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <p className="err" style={{ margin: 0 }}>{text}</p>
      {retry && <button className="btn white" onClick={retry}>جرب تاني</button>}
      <Link className="btn ghost dark" to="/">الرئيسية</Link>
    </div>
  )
}

export function Header({ title, back = '/' }: { title: string; back?: string }) {
  return <div className="mhead"><h2>{title}</h2><Link className="linkbtn" to={back}>رجوع</Link></div>
}

/* ---------------- confetti ---------------- */
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
export function Confetti({ fire, n = 70 }: { fire: number; n?: number }) {
  const [pieces, setPieces] = useState<JSX.Element[]>([])
  useEffect(() => {
    if (!fire || reduced()) return
    const cols = ['#FF9F1C', '#22C38E', '#FF5D6C', '#7CC6FF', '#8C8CFF', '#fff']
    setPieces(Array.from({ length: n }, (_, i) => (
      <i key={fire + '-' + i} style={{ left: Math.random() * 100 + '%', background: cols[i % cols.length], animationDuration: 1.8 + Math.random() * 1.6 + 's', animationDelay: Math.random() * 0.6 + 's', transform: `rotate(${Math.random() * 180}deg)` }} />
    )))
    const t = setTimeout(() => setPieces([]), 4200)
    return () => clearTimeout(t)
  }, [fire, n])
  return <div className="confetti" aria-hidden="true">{pieces}</div>
}

/* ---------------- timer ring ---------------- */
export function Ring({ left, total = DOOR_SECONDS }: { left: number; total?: number }) {
  const low = left < 10
  return (
    <div className={'ring' + (low ? ' low' : '')} aria-label={`فاضل ${Math.ceil(left)} ثانية`}>
      <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.25)" strokeWidth="5" />
        <circle cx="24" cy="24" r="20" fill="none" stroke={low ? '#FF5D6C' : '#FF9F1C'} strokeWidth="5" strokeLinecap="round" strokeDasharray="125.7" strokeDashoffset={125.7 * (1 - Math.max(0, left) / total)} /></svg>
      <b>{ar(Math.max(0, Math.ceil(left)))}</b>
    </div>
  )
}

/** Seconds left until `deadline` (ms), ticking 4x a second. */
export function useCountdown(deadline: number | null, onZero?: () => void) {
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)
  useEffect(() => { fired.current = false }, [deadline])
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [deadline])
  const left = deadline ? Math.max(0, (deadline - now) / 1000) : 0
  useEffect(() => {
    if (deadline && left <= 0 && !fired.current) { fired.current = true; onZero?.() }
  }, [left, deadline, onZero])
  return left
}

/* ---------------- room scene ---------------- */
export function Placard({ id }: { id: string }) {
  const s = SIGNS[id as SignId]
  return <div className="plac" style={{ background: signBG(id), color: s.fg, textShadow: signShadow(id) }}><b>{s.ar}</b><s>{s.en}</s></div>
}

export function Scene({ room, sign, layers = [], open, col = '#FF9F1C', fx }: {
  room: string; sign?: string | null; layers?: string[]; open?: boolean; col?: string; fx?: 'germs' | 'spark' | null
}) {
  const bg = useMemo(() => roomSVG(room), [room])
  const av = useMemo(() => avatarSVG(col), [col])
  const avRef = useRef<HTMLDivElement>(null)
  const [walk, setWalk] = useState(false)
  useEffect(() => {
    avRef.current?.querySelectorAll<SVGGElement>('.lay').forEach(g => g.classList.toggle('on', layers.includes(g.dataset.l || '')))
  }, [layers, av])
  useEffect(() => { if (open && !reduced()) { setWalk(true); const t = setTimeout(() => setWalk(false), 900); return () => clearTimeout(t) } }, [open])
  const fxItems = useMemo(() => {
    if (!fx) return []
    const n = fx === 'germs' ? 6 : 9
    return Array.from({ length: n }, (_, i) => ({ x: (fx === 'germs' ? 34 : 30) + Math.random() * (fx === 'germs' ? 30 : 44), y: (fx === 'germs' ? 16 : 8) + Math.random() * (fx === 'germs' ? 60 : 70), i }))
  }, [fx])
  return (
    <div className="scene">
      <Svg html={bg} />
      <div className="door-wrap">
        <div className="room-in"><Svg html={ROOM_IN} /></div>
        <div className={'door' + (open ? ' open' : '')}>
          <div className="glass" />
          <div className={'slot ' + (sign ? 'filled' : 'empty')}>{sign ? <Placard key={sign} id={sign} /> : '؟'}</div>
          <div className="lever" /><div className="kick" />
        </div>
      </div>
      <div className="avatar" ref={avRef} style={walk ? { transform: 'translateX(40%) scale(.9)' } : undefined} dangerouslySetInnerHTML={{ __html: av }} />
      <div className="fx">
        {fxItems.map(f => fx === 'germs'
          ? <div key={f.i} className="germ" style={{ left: f.x + '%', top: f.y + '%', animationDelay: `${f.i * 0.12}s,${0.5 + f.i * 0.12}s` }} dangerouslySetInnerHTML={{ __html: GERM(['#5BD06A', '#A6E35B', '#4CC9B0'][f.i % 3]) }} />
          : <div key={f.i} className="spark" style={{ left: f.x + '%', top: f.y + '%', animationDelay: `${f.i * 0.09}s` }} dangerouslySetInnerHTML={{ __html: SPARK }} />)}
      </div>
    </div>
  )
}

/* ---------------- share ---------------- */
export function ShareButton({ data, label = 'شارك', className = 'btn white' }: { data: ShareData; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const click = async () => { if (!(await nativeShare(data))) setOpen(o => !o) }
  return (
    <div className="share">
      <button type="button" className={className} onClick={click}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="18" cy="5" r="3" fill="currentColor" /><circle cx="6" cy="12" r="3" fill="currentColor" /><circle cx="18" cy="19" r="3" fill="currentColor" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" stroke="currentColor" strokeWidth="2" /></svg>
        {label}
      </button>
      {open && (
        <div className="share-menu">
          <a className="btn mint sm" href={whatsappLink(data)} target="_blank" rel="noreferrer">واتساب</a>
          <button type="button" className="btn white sm" onClick={async () => { setCopied(await copyText(`${data.text}\n${data.url}`)); setTimeout(() => setCopied(false), 2000) }}>{copied ? 'اتنسخ ✓' : 'انسخ اللينك'}</button>
          <input readOnly value={data.url} onFocus={e => e.currentTarget.select()} aria-label="اللينك" />
        </div>
      )}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="f">{label}{children}</label>
}
