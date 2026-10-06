import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ar, errorText, initial, pct, PCOL } from '../lib/content'
import { appUrl } from '../lib/share'
import { Confetti, ErrorBox, Loading, ShareButton, Stars, Svg } from '../components/ui'
import { TROPHY } from '../art'
import DoorGame from './DoorGame'

export type DoorPub = { idx: number; case_id: string; room: string; title: string; who: string; file: string[]; task: string; order: string[] }
export type SetPlayer = {
  player_id: string; name: string; dept: string; role: string; is_me: boolean; finished: boolean; progress: number
  score: number | null; base: number | null
  doors: { idx: number; iso: string; ppe: string; hand: string; iso_pts: number; ppe_pts: number; hand_pts: number }[] | null
}
export type GameSet = {
  id: string; code: string; mode: 'duel' | 'solo'; level: string; n: number; doors: DoorPub[]; owner_is_me: boolean
  my_attempt: { id: string; next_door: number; score: number; base: number; finished: boolean } | null
  players: SetPlayer[]; prev_best: number | null
}

export default function Game() {
  const { code = '' } = useParams()
  const { player } = useSession()
  const [set, setSet] = useState<GameSet | null>(null)
  const [err, setErr] = useState('')
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setSet(await rpc<GameSet>('get_set', { p_code: code })); setErr('') } catch (e) { setErr(errorText(e)) }
  }, [code])
  useEffect(() => { load() }, [load])

  // while waiting for the other player, refresh every few seconds
  const waiting = !!set && set.mode === 'duel' && !!set.my_attempt?.finished && !(set.players.length === 2 && set.players.every(p => p.finished))
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [waiting, load])

  if (err) return <ErrorBox text={err} retry={load} />
  if (!set) return <Loading />

  const myIdx = Math.max(0, set.players.findIndex(p => p.is_me))
  const col = PCOL[myIdx] || PCOL[0]
  const link = appUrl('/g/' + set.code)

  if (playing && set.my_attempt && !set.my_attempt.finished) {
    return <DoorGame set={set} attempt={set.my_attempt} name={player!.name} col={col} onDone={async () => { await load(); setPlaying(false) }} />
  }

  /* ---- invited to someone else's duel ---- */
  if (!set.my_attempt) {
    const host = set.players[0]
    if (set.mode !== 'duel') return <ErrorBox text="ده تدريب خاص بحد تاني." />
    if (set.players.length >= 2) return <ErrorBox text="المبارزة دي اتلعبت خلاص بين اتنين. اعمل مبارزة جديدة." />
    return (
      <div className="hand-off">
        <p style={{ fontWeight: 800 }}>جالك تحدي!</p>
        <div className="bigav" style={{ background: PCOL[0] }}>{initial(host?.name)}</div>
        <h1>{host?.name} بيتحداك</h1>
        <p style={{ maxWidth: 320, fontWeight: 600 }}>{host?.dept} · {ar(set.n)} أوض. هتلعب نفس الحالات بالظبط، واللي يحمي المرضى أكتر يكسب.</p>
        <div style={{ width: '100%' }} className="stack">
          <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { setSet(await rpc('join_set', { p_code: set.code })); setPlaying(true) } catch (e) { setErr(errorText(e)) } finally { setBusy(false) } }}>قبلت التحدي</button>
          <Link className="btn ghost" to="/">مش دلوقتي</Link>
        </div>
      </div>
    )
  }

  /* ---- ready / resume ---- */
  if (!set.my_attempt.finished) {
    const resume = set.my_attempt.next_door > 0
    return (
      <div className="hand-off">
        <div className="bigav" style={{ background: col }}>{initial(player?.name)}</div>
        <h1>{resume ? 'كمّل من مكانك' : set.mode === 'duel' ? 'مبارزة جديدة' : 'يلا يا ' + player?.name}</h1>
        <p style={{ maxWidth: 320, fontWeight: 600 }}>
          {resume ? `خلّصت ${ar(set.my_attempt.next_door)} من ${ar(set.n)} أوض.` : `قدامك ${ar(set.n)} أوض. اقرا ملف كل مريض كويس.`}
          {!resume && set.prev_best != null && set.mode === 'solo' && <><br />أحسن نتيجة ليك قبل كده: {ar(set.prev_best)}٪</>}
        </p>
        <div style={{ width: '100%' }} className="stack">
          <button className="btn" onClick={() => setPlaying(true)}>{resume ? 'كمّل' : 'افتح أول باب'}</button>
          {set.mode === 'duel' && set.owner_is_me && (
            <>
              <p className="small" style={{ fontWeight: 600 }}>تقدر تبعت التحدي لزميلك دلوقتي أو بعد ما تخلّص. كود المبارزة: <b dir="ltr">{set.code}</b></p>
              <ShareButton label="ابعت التحدي" data={{ title: 'حارب العدوى', text: `${player?.name} بيتحداك في «حارب العدوى» 🚪 تقدر تكسبه في العزل ونظافة الإيدين؟`, url: link }} />
            </>
          )}
        </div>
      </div>
    )
  }

  return set.mode === 'solo' ? <SoloResult set={set} /> : <DuelResult set={set} link={link} />
}

/* ======================= results ======================= */
function comp(p: SetPlayer, n: number) {
  const t = { iso: 0, ppe: 0, hand: 0 }
  ;(p.doors || []).forEach(d => { t.iso += d.iso_pts; t.ppe += d.ppe_pts; t.hand += d.hand_pts })
  return { iso: pct(t.iso, 50 * n), ppe: pct(t.ppe, 30 * n), hand: pct(t.hand, 20 * n) }
}
const Mk = ({ s }: { s: string }) => <span className={'mk ' + s}>{s === 'ok' ? '✓' : s === 'half' ? '½' : '✗'}</span>

function DoorTable({ set, players }: { set: GameSet; players: SetPlayer[] }) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--display)', fontSize: 20 }}>باب باب</h3>
      <div className="scroll"><table className="tbl">
        {players.length > 1 && <thead><tr><th>الحالة</th>{players.map(p => <th key={p.player_id} className="c">{p.name}</th>)}</tr></thead>}
        <tbody>{set.doors.map(d => (
          <tr key={d.idx}>
            <td><b>{d.title}</b></td>
            {players.map(p => { const x = p.doors?.find(z => z.idx === d.idx); return <td key={p.player_id} className="c" style={{ whiteSpace: 'nowrap' }}>{x ? <><Mk s={x.iso} /><Mk s={x.ppe} /><Mk s={x.hand} /></> : '—'}</td> })}
          </tr>))}
        </tbody></table></div>
      <p className="small muted" style={{ marginTop: 6 }}>الترتيب في كل خانة: اللافتة · الواقيات · الإيدين</p>
    </div>
  )
}

function Bars({ k, wide }: { k: { iso: number; ppe: number; hand: number }; wide?: boolean }) {
  return <>{([['العزل', k.iso, '#2F6FD1'], ['الواقيات', k.ppe, '#22C38E'], [wide ? 'نظافة الإيدين' : 'الإيدين', k.hand, '#FF5D6C']] as const).map(([l, v, c]) => (
    <div className="mbar" key={l} style={wide ? { fontSize: 14 } : undefined}><span style={wide ? { minWidth: 90 } : undefined}>{l}</span><span className="t"><i style={{ width: v + '%', background: c }} /></span><span className="num">{ar(v)}٪</span></div>))}</>
}

function SoloResult({ set }: { set: GameSet }) {
  const me = set.players.find(p => p.is_me)!
  const v = pct(me.base || 0, set.n * 100)
  const nst = v >= 85 ? 3 : v >= 65 ? 2 : v >= 40 ? 1 : 0
  const pb = set.prev_best
  return (
    <div className="stack">
      <Confetti fire={nst >= 2 ? 1 : 0} />
      <Stars big states={[0, 1, 2].map(i => i < nst)} />
      <div className="bigscore"><div className="v num">{ar(me.score || 0)}</div><p className="white" style={{ fontWeight: 700 }}>نقطة · صح {ar(v)}٪</p></div>
      <p className="saved" style={pb != null && v > pb ? { background: 'var(--mint)' } : undefined}>
        {pb == null ? 'أول مرة تلعب. العب تاني وحاول تكسر رقمك.' : v > pb ? `رقم جديد! أحسن من ${ar(pb)}٪ قبل كده` : `أحسن نتيجة ليك: ${ar(pb)}٪. قرّبت!`}
      </p>
      <div className="card stack" style={{ gap: 8 }}><Bars k={comp(me, set.n)} wide /></div>
      <DoorTable set={set} players={[me]} />
      <ShareButton label="شارك نتيجتك" data={{ title: 'حارب العدوى', text: `جبت ${ar(v)}٪ في «حارب العدوى» ${'⭐'.repeat(nst)} تقدر تجيب أكتر؟`, url: appUrl('/') }} />
      <Link className="btn" to="/play/solo">العب تاني بحالات جديدة</Link>
      <Link className="btn ghost" to="/">الرئيسية</Link>
    </div>
  )
}

function DuelResult({ set, link }: { set: GameSet; link: string }) {
  const me = set.players.find(p => p.is_me)!
  const other = set.players.find(p => !p.is_me)
  const done = !!other?.finished
  const myPct = pct(me.base || 0, set.n * 100)
  const shareChallenge = { title: 'حارب العدوى', text: `أنا خلّصت مبارزة «حارب العدوى» وجبت ${ar(me.score || 0)} نقطة 🚪 تقدر تكسبني؟`, url: link }

  if (!done) return (
    <div className="stack">
      <div className="bigscore" style={{ marginTop: 16 }}><p className="white" style={{ fontWeight: 800 }}>نتيجتك</p><div className="v num">{ar(me.score || 0)}</div><p className="white" style={{ fontWeight: 700 }}>صح {ar(myPct)}٪</p></div>
      <div className="card stack" style={{ gap: 10, textAlign: 'center' }}>
        {other ? <><h3 style={{ fontFamily: 'var(--display)', fontSize: 22 }}>{other.name} بيلعب دلوقتي</h3><p className="muted">خلّص {ar(other.progress)} من {ar(set.n)} أوض. النتيجة هتظهر هنا أول ما يخلّص.</p></>
          : <><h3 style={{ fontFamily: 'var(--display)', fontSize: 22 }}>ابعت التحدي لزميلك</h3><p className="muted">لما يفتح اللينك هيلعب نفس الحالات، والنتيجة هتظهر هنا للاتنين. كود المبارزة: <b dir="ltr">{set.code}</b></p></>}
        <ShareButton className="btn" label="ابعت التحدي" data={shareChallenge} />
      </div>
      <div className="card stack" style={{ gap: 8 }}><Bars k={comp(me, set.n)} wide /></div>
      <DoorTable set={set} players={[me]} />
      <Link className="btn ghost" to="/">الرئيسية</Link>
    </div>
  )

  const ps = set.players
  const win = ps[0].score === ps[1].score ? -1 : (ps[0].score || 0) > (ps[1].score || 0) ? 0 : 1
  const iWon = win >= 0 && ps[win].is_me
  return (
    <div className="stack">
      <Confetti fire={1} n={90} />
      <div className="logo"><h1 style={{ fontSize: 44 }}>{win === -1 ? 'تعادل!' : iWon ? 'كسبت!' : ps[win].name + ' كسب!'}</h1></div>
      <div className="podium">{ps.map((p, i) => {
        const w = win === i, k = comp(p, set.n)
        return (
          <div key={p.player_id} className={'pod' + (w ? ' win' : '')}>
            {w && <Svg html={TROPHY} />}
            <div className="av" style={{ background: PCOL[i] }}>{initial(p.name)}</div><div className="nm">{p.name}{p.is_me ? ' (انت)' : ''}</div>
            <div className="blk" style={{ minHeight: w || win === -1 ? 232 : 200 }}><div className="sc num">{ar(p.score || 0)}</div><div className="small muted num" style={{ marginTop: -6 }}>{p.dept}</div><Bars k={k} /></div>
          </div>)
      })}</div>
      <DoorTable set={set} players={ps} />
      <ShareButton label="شارك النتيجة" data={{ title: 'حارب العدوى', text: win === -1 ? `اتعادلت مع ${other!.name} في «حارب العدوى» 🚪` : iWon ? `كسبت ${other!.name} في مبارزة «حارب العدوى» 🏆 مين عايز يتحداني؟` : `${other!.name} كسبني في «حارب العدوى»… المرة الجاية 💪`, url: appUrl('/') }} />
      <Link className="btn" to="/play/duel">مبارزة جديدة</Link>
      <Link className="btn ghost" to="/">الرئيسية</Link>
    </div>
  )
}
