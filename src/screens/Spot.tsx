import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ar, initial } from '../lib/content'
import { appUrl } from '../lib/share'
import { Confetti, Ring, ShareButton, Stars, Svg, useCountdown } from '../components/ui'
import { HEART } from '../art'
import { SPOT_H, SPOT_SECONDS, SPOT_W } from '../art'
import { nextScene, type Diff as SpotDef, type SpotRound } from '../spotScenes'

type Reason = 'all' | 'time' | 'hearts' | 'giveup'

function Mark({ d, num, miss }: { d: SpotDef; num: number; miss?: boolean }) {
  return (
    <div className={'mark' + (miss ? ' miss' : '')} style={{ left: ((d.cx - d.r) / SPOT_W) * 100 + '%', top: ((d.cy - d.r) / SPOT_H) * 100 + '%', width: ((2 * d.r) / SPOT_W) * 100 + '%', height: ((2 * d.r) / SPOT_H) * 100 + '%' }}>
      <i>{ar(num)}</i>
    </div>
  )
}

export default function Spot() {
  const { player } = useSession()
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro')
  const [scene, setScene] = useState<SpotRound>(() => nextScene())
  const [found, setFound] = useState<string[]>([])
  const [hearts, setHearts] = useState(3)
  const [last, setLast] = useState<SpotDef | null>(null)
  const [miss, setMiss] = useState<{ pic: string; x: number; y: number; k: number } | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [result, setResult] = useState<{ reason: Reason; score: number; saved: boolean } | null>(null)
  const lock = useRef(false)
  const total = scene.diffs.length

  const start = (fresh: boolean) => {
    lock.current = false
    if (fresh) setScene(nextScene())   // a brand-new picture every game
    setFound([]); setHearts(3); setLast(null); setMiss(null); setResult(null)
    setDeadline(Date.now() + SPOT_SECONDS * 1000); setPhase('play'); window.scrollTo({ top: 0 })
  }

  const end = useCallback(async (reason: Reason, f: string[], h: number) => {
    if (phase !== 'play' || result) return
    lock.current = true
    const left = deadline ? Math.max(0, (deadline - Date.now()) / 1000) : 0
    const score = f.length * 100 + (reason === 'all' ? Math.round(left) * 5 + h * 20 : 0)
    setDeadline(null); setPhase('done'); window.scrollTo({ top: 0 })
    const saved = await rpc('save_spot', { p_scene: scene.id, p_found: f, p_reason: reason, p_score: score, p_shown: scene.shown }).then(() => true, () => false)
    setResult({ reason, score, saved })
  }, [phase, result, deadline, scene])

  const left = useCountdown(phase === 'play' ? deadline : null, () => end('time', found, hearts))

  const tap = (pic: string) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (lock.current || phase !== 'play') return
    const svg = e.currentTarget.querySelector('svg')!; const rc = svg.getBoundingClientRect()
    const x = ((e.clientX - rc.left) / rc.width) * SPOT_W, y = ((e.clientY - rc.top) / rc.height) * SPOT_H
    const hit = scene.diffs.find(d => !found.includes(d.id) && Math.hypot(d.cx - x, d.cy - y) <= d.r + 6)
    if (hit) {
      const f = [...found, hit.id]; setFound(f); setLast(hit)
      if (f.length === total) { lock.current = true; setTimeout(() => end('all', f, hearts), 700) }
      return
    }
    if (scene.diffs.some(d => found.includes(d.id) && Math.hypot(d.cx - x, d.cy - y) <= d.r + 6)) return
    const h = hearts - 1; setHearts(h); setMiss({ pic, x, y, k: Date.now() })
    if (h <= 0) { lock.current = true; setTimeout(() => end('hearts', found, 0), 800) }
  }

  const marks = (all: boolean) => scene.diffs.map((d, i) => {
    const k = found.indexOf(d.id)
    return k >= 0 ? <Mark key={d.id} d={d} num={all ? i + 1 : k + 1} /> : all ? <Mark key={d.id} d={d} num={i + 1} miss /> : null
  })
  const pic = (id: string, label: string, html: string, b?: boolean, all?: boolean) => (
    <div className={'pic' + (all ? '' : ' tap') + (miss?.pic === id ? ' shake' : '')} key={id + scene.key + (miss?.pic === id ? miss.k : '')} onClick={all ? undefined : tap(id)}>
      <span className={'lbl' + (b ? ' b' : '')}>{label}</span>
      <Svg html={html} />
      {marks(!!all)}
      {!all && miss?.pic === id && <div className="xm" key={miss.k} style={{ left: (miss.x / SPOT_W) * 100 + '%', top: (miss.y / SPOT_H) * 100 + '%' }}>✗</div>}
    </div>
  )
  const good = useMemo(() => scene.svg(false), [scene])
  const bad = useMemo(() => scene.svg(true), [scene])

  if (phase === 'intro') return (
    <div className="stack">
      <div className="mhead"><h2>طلّع الغلطات</h2><Link className="linkbtn" to="/">رجوع</Link></div>
      <div className="pic"><span className="lbl b">{scene.name}</span><Svg html={bad} /></div>
      <div className="card stack" style={{ gap: 6 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 20 }}>إزاي تلعب</h3>
        <p className="small muted" style={{ fontWeight: 600 }}>هتشوف صورتين لنفس الأوضة. التانية فيها {ar(total)} غلطات في مكافحة العدوى. دوس على الغلطة في أي صورة. معاك {ar(SPOT_SECONDS)} ثانية و٣ قلوب، وكل دوسة غلط بتخسّرك قلب. كل مرة بتلعب بتطلعلك أوضة وغلطات مختلفة.</p>
      </div>
      <button className="btn mint" onClick={() => start(false)}>ابدأ</button>
    </div>
  )

  if (phase === 'done') {
    const f = found.length, nst = f >= 7 ? 3 : f >= 5 ? 2 : f >= 3 ? 1 : 0
    const title = { all: 'لقيت كل الغلطات!', time: 'الوقت خلص', hearts: 'القلوب خلصت', giveup: 'دي كانت الغلطات' }[result?.reason || 'giveup']
    return (
      <div className="stack">
        <Confetti fire={f >= 6 ? 1 : 0} />
        <Stars big states={[0, 1, 2].map(i => i < nst)} />
        <div className="bigscore"><h1 className="white" style={{ fontFamily: 'var(--display)', fontSize: 34 }}>{title}</h1><div className="v num">{ar(f)}/{ar(total)}</div>{result && <p className="white" style={{ fontWeight: 700 }}>{ar(result.score)} نقطة</p>}</div>
        {pic('b', 'الغلطات كلها', bad, true, true)}
        <div className="card">{scene.diffs.map((d, i) => {
          const ok = found.includes(d.id)
          return <div key={d.id} className="fbr" style={i === 0 ? { borderTop: 0, paddingTop: 0 } : undefined}><div className={'ic ' + (ok ? 'ok' : 'no')}>{ar(i + 1)}</div><h4>{d.t}</h4><span className="pt small">{ok ? 'لقيتها' : 'فاتتك'}</span><div className="why">{d.w}</div></div>
        })}</div>
        {result && <p className="saved">{result.saved ? 'النتيجة اتسجلت عند رئيس القسم.' : 'مقدرناش نحفظ النتيجة. اتأكد من الإنترنت.'}</p>}
        <ShareButton label="شارك نتيجتك" data={{ title: 'حارب العدوى', text: `لقيت ${ar(f)} من ${ar(total)} غلطات عدوى في أوضة المريض 🔍 تقدر تلاقي أكتر؟`, url: appUrl('/spot') }} />
        <button className="btn" onClick={() => start(true)}>العب أوضة جديدة</button>
        <Link className="btn ghost" to="/">الرئيسية</Link>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="hud">
        <div className="chipx"><div className="av" style={{ background: '#FFB3BD' }}>{initial(player?.name)}</div><span className="nm">{player?.name}</span></div>
        <div className="pill num">{ar(found.length)}/{ar(total)}</div>
        <div className="hearts" aria-label={`فاضل ${hearts} قلوب`} dangerouslySetInnerHTML={{ __html: [0, 1, 2].map(i => HEART(i < hearts)).join('') }} />
        <Ring left={left} total={SPOT_SECONDS} />
      </div>
      {pic('a', scene.name + ' · الصح', good)}
      {pic('b', `فيها ${ar(total)} غلطات`, bad, true)}
      {last ? <div className="toast" key={last.id}><span className="n">{ar(found.length)}</span><b>لقيتها! {last.t}</b><span>{last.w}</span></div>
        : <p className="hint">دوس على أي غلطة تلاقيها في الصورة التانية أو الأولى</p>}
      <button className="btn ghost" onClick={() => end('giveup', found, hearts)}>مش لاقي؟ اعرض الإجابات</button>
    </div>
  )
}
