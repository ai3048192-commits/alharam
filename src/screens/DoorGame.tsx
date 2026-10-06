import { useCallback, useEffect, useRef, useState } from 'react'
import { rpc } from '../lib/supabase'
import { ar, errorText, HAND, initial, PPE, PPE_ORDER, ppeList, SIGNS, signBG, signShadow, DOOR_SECONDS, type SignId } from '../lib/content'
import { Confetti, Ring, Scene, Stars, Svg, useCountdown } from '../components/ui'
import { IC, STAR } from '../art'
import type { GameSet } from './Game'

type Res = {
  iso: number; ppe: number; hand: number; speed: number; total: number
  iso_state: 'ok' | 'half' | 'no'; ppe_state: 'ok' | 'half' | 'no'; hand_state: 'ok' | 'half' | 'no'; iso_note: string | null
  timed_out: boolean; correct: { iso: string; ppe: string[]; hand: string; hands?: string[] }; why: { iso: string; ppe: string; hand: string }; finished: boolean
}
type Ans = { iso?: string; ppeSel: string[]; ppe?: string[]; handSel: string[]; hands?: string[] }

const handList = (l: string[]) => l.map(k => HAND[k]).join(' + ')

export default function DoorGame({ set, attempt, name, col, onDone }: {
  set: GameSet; attempt: NonNullable<GameSet['my_attempt']>; name: string; col: string; onDone: () => void
}) {
  const [idx, setIdx] = useState(attempt.next_door)
  const [score, setScore] = useState(attempt.score)
  const [step, setStep] = useState(0)
  const [ans, setAns] = useState<Ans>({ ppeSel: [], handSel: [] })
  const [deadline, setDeadline] = useState<number | null>(null)
  const [res, setRes] = useState<Res | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [party, setParty] = useState(0)
  const ansRef = useRef(ans); ansRef.current = ans
  const door = set.doors[idx]

  // start each door on the server (a reload keeps the original clock)
  useEffect(() => {
    let alive = true
    setStep(0); setAns({ ppeSel: [], handSel: [] }); setRes(null); setOpen(false); setDeadline(null); setErr('')
    rpc<{ seconds_left: number }>('open_door', { p_attempt: attempt.id, p_idx: idx })
      .then(r => { if (alive) setDeadline(Date.now() + Number(r.seconds_left) * 1000) })
      .catch(e => alive && setErr(errorText(e)))
    window.scrollTo({ top: 0 })
    return () => { alive = false }
  }, [idx, attempt.id])

  const submit = useCallback(async (final: Ans) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await rpc<Res>('answer_door', { p_attempt: attempt.id, p_idx: idx, p_iso: final.iso ?? null, p_ppe: final.ppe ?? null, p_hands: final.hands ?? null })
      setRes(r); setScore(s => s + r.total); setDeadline(null)
      if (r.iso_state === 'ok' && r.ppe_state === 'ok' && r.hand_state === 'ok') setParty(p => p + 1)
      window.scrollTo({ top: 0 })
    } catch (e) { setErr(errorText(e)) } finally { setBusy(false) }
  }, [attempt.id, idx, busy])

  const onZero = useCallback(() => { if (!res) submit(ansRef.current) }, [res, submit])
  const left = useCountdown(res ? null : deadline, onZero)

  const enter = () => {
    const a = { ...ans, ppe: ans.ppeSel.slice() }
    setAns(a); setOpen(true)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setTimeout(() => { setOpen(false); setTimeout(() => setStep(2), reduce ? 0 : 450) }, reduce ? 0 : 1300)
  }

  if (!door) return null
  const layers = step === 1 ? ans.ppeSel : (ans.ppe || [])
  const hud = (
    <div>
      <div className="hud">
        <div className="chipx"><div className="av" style={{ background: col }}>{initial(name)}</div><span className="nm">{name}</span></div>
        <div className="score num"><Svg html={STAR(true)} /><span>{ar(score)}</span></div>
        <Ring left={res ? 0 : deadline ? left : DOOR_SECONDS} />
      </div>
      <div className="dots" aria-label={`الباب ${idx + 1} من ${set.n}`}>{set.doors.map(d => <i key={d.idx} className={d.idx < idx ? 'd' : d.idx === idx ? 'n' : ''} />)}</div>
    </div>
  )

  if (res) {
    const states = [res.iso_state, res.ppe_state, res.hand_state]
    const full = states.every(s => s === 'ok')
    const row = (label: string, state: string, pts: number, max: number, yours: string, right: string, why: string, note?: string | null) => (
      <div className="fbr"><div className={'ic ' + state}>{state === 'ok' ? '✓' : state === 'half' ? '½' : '✗'}</div><h4>{label}</h4><span className="pt num">{ar(pts)}/{ar(max)}</span>
        <div className="ans">إجابتك: {yours}{state !== 'ok' && <> · الصح: <em>{right}</em></>}</div>{note && <div className="note">{note}</div>}<div className="why">{why}</div></div>
    )
    return (
      <div className="stack">
        <Confetti fire={party} n={40} />
        {hud}
        <Scene room={door.room} sign={ans.iso} layers={ans.ppe || []} col={col} fx={full ? 'spark' : 'germs'} />
        <div style={{ height: 30 }} />
        <div className="sheet">
          <Stars states={states} />
          <div className="verdict">{full ? 'المرضى في أمان!' : res.total >= 60 ? 'قريب، بس فيه ثغرة' : 'الميكروب عدّى!'}</div>
          <div className="gain num">+{ar(res.total)}</div>
          {res.timed_out && <p className="timeout" style={{ marginTop: 8 }}>الوقت خلص قبل ما تكمّل</p>}
          <p className="small muted" style={{ textAlign: 'center', marginBottom: 6 }}>غرفة {door.room} · {door.title}{res.speed ? ` · نقط السرعة +${ar(res.speed)}` : ''}</p>
          {row('اللافتة', res.iso_state, res.iso, 50, ans.iso ? SIGNS[ans.iso as SignId].ar : 'مفيش', SIGNS[res.correct.iso as SignId].ar, res.why.iso, res.iso_note)}
          {row('الواقيات', res.ppe_state, res.ppe, 30, ans.ppe ? ppeList(ans.ppe) : 'مفيش', ppeList(res.correct.ppe), res.why.ppe)}
          {row('نظافة الإيدين', res.hand_state, res.hand, 20, ans.hands ? handList(ans.hands) : 'مفيش', handList(res.correct.hands ?? [res.correct.hand]), res.why.hand)}
          <button className="btn" style={{ marginTop: 8 }} onClick={() => (res.finished ? onDone() : setIdx(i => i + 1))}>{res.finished ? 'شوف النتيجة' : 'الباب اللي بعده'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      {hud}
      <Scene room={door.room} sign={ans.iso} layers={layers} open={open} col={col} />
      {step < 2 && (
        <div className="clip"><div className="who">{door.who}</div><ul>{door.file.map((x, i) => <li key={i}>{x}</li>)}</ul><div className="task">{door.task}</div></div>
      )}
      {err && <p className="err">{err}</p>}
      {step === 0 && <>
        <div className="qhead"><span className="n">١</span><h2>أنهي لافتة هتعلّقها؟</h2></div>
        <div className="signs">{door.order.map(id => (
          <button key={id} className="sbtn" disabled={!deadline} style={{ background: signBG(id), color: SIGNS[id as SignId].fg, textShadow: signShadow(id) }}
            onClick={() => { setAns(a => ({ ...a, iso: id, ppeSel: [], handSel: [] })); setStep(1) }}>
            <b>{SIGNS[id as SignId].ar}</b><s>{SIGNS[id as SignId].en}</s></button>))}</div>
      </>}
      {step === 1 && <>
        <div className="qhead"><span className="n">٢</span><h2>لبّسه قبل ما يدخل</h2></div>
        <p className="white small" style={{ fontWeight: 600, marginTop: -6 }}>دوس على كل حاجة هيلبسها. لو مش محتاج حاجة سيبها فاضية.</p>
        <div className="ppe">{PPE_ORDER.map(k => {
          const on = ans.ppeSel.includes(k)
          return <button key={k} type="button" className="pbtn" aria-pressed={on} disabled={open}
            onClick={() => setAns(a => ({ ...a, ppeSel: on ? a.ppeSel.filter(x => x !== k) : [...a.ppeSel, k] }))}><Svg html={IC[k]} />{PPE[k]}</button>
        })}</div>
        <button className="btn mint" disabled={open} onClick={enter}>{ans.ppeSel.length ? 'ادخل الأوضة' : 'ادخل من غير واقيات'}</button>
      </>}
      {step === 2 && <>
        <div className="qhead"><span className="n">٣</span><h2>خرج وقلع الواقيات. ينضف إيده بإيه؟</h2></div>
        <p className="white small" style={{ fontWeight: 600, marginTop: -6 }}>ممكن تختار أكتر من إجابة، وبعدين دوس تأكيد.</p>
        <div className="hands">
          {(['alcohol', 'soap', 'none'] as const).map(k => {
            const on = ans.handSel.includes(k)
            const toggle = () => setAns(a => ({ ...a, handSel: k === 'none' ? (on ? [] : ['none']) : on ? a.handSel.filter(x => x !== k) : [...a.handSel.filter(x => x !== 'none'), k] }))
            return <button key={k} type="button" className={'hbtn' + (k === 'none' ? ' wide' : '')} aria-pressed={on} disabled={busy} onClick={toggle}>
              <Svg html={IC[k]} />{k === 'alcohol' ? 'كحول' : k === 'soap' ? 'مية وصابون' : HAND.none}</button>
          })}
        </div>
        <button className="btn mint" disabled={busy || ans.handSel.length === 0} onClick={() => { const a = { ...ans, hands: ans.handSel.slice() }; setAns(a); submit(a) }}>
          {ans.handSel.length ? 'تأكيد' : 'اختار إجابة الأول'}</button>
      </>}
    </div>
  )
}
