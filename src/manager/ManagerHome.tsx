import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ar, errorText } from '../lib/content'
import { Field, Loading } from '../components/ui'

export function ManagerLogin() {
  const { signInManager, user, manager } = useSession()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const notManager = user && !user.is_anonymous && !manager
  return (
    <div className="stack" style={{ paddingTop: 16 }}>
      <div className="mhead"><h2>دخول رئيس القسم</h2><Link className="linkbtn" to="/">رجوع</Link></div>
      <form className="card stack" style={{ gap: 10 }} onSubmit={async e => {
        e.preventDefault(); setBusy(true); setErr('')
        try { await signInManager(email, pw) } catch (x) { setErr(errorText(x)) } finally { setBusy(false) }
      }}>
        <Field label="الإيميل"><input id="email" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></Field>
        <Field label="الباسورد"><input id="password" type="password" dir="ltr" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required /></Field>
        {(err || notManager) && <p className="err">{err || 'الحساب ده مش متسجل كرئيس قسم. اطلب من الأدمن يضيفك.'}</p>}
        <button className="btn" disabled={busy}>{busy ? 'بندخل...' : 'دخول'}</button>
        <p className="small muted">الحسابات بيعملها الأدمن من Supabase. لو نسيت الباسورد كلّمه.</p>
      </form>
    </div>
  )
}

type Dash = {
  kpis: { games: number; players: number; avg: number; spot_games: number }
  comp: { iso: number; ppe: number; hand: number }
  misses: { title: string; part: 'iso' | 'ppe' | 'hand'; rate: number; wrong: number; n: number }[]
  depts: { dept: string; players: number; games: number; avg: number }[]
  people: { name: string; dept: string; role: string; games: number; wins: number; avg: number; last: string }[]
  spot: { games: number; avg_found: number; avg_pct?: number; items: { id: string; title: string; scene: string; n: number; rate: number }[] }
  roster: { id: number; name: string; dept: string; played: boolean }[]
}
const PART = { iso: 'نوع العزل', ppe: 'الواقيات', hand: 'نظافة الإيدين' }

export default function ManagerHome() {
  const { manager, depts, signOutManager } = useSession()
  const [dept, setDept] = useState<number | ''>('')
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  const [names, setNames] = useState('')

  const load = useCallback(async () => {
    try { setD(await rpc<Dash>('dashboard', { p_dept: dept === '' ? null : dept })); setErr('') } catch (e) { setErr(errorText(e)) }
  }, [dept])
  useEffect(() => { if (manager) load() }, [manager, load])

  if (!manager) return <ManagerLogin />
  if (err) return <div className="stack"><p className="err">{err}</p><button className="btn white" onClick={load}>جرب تاني</button></div>
  if (!d) return <Loading />

  const spotItems = [...d.spot.items].sort((a, b) => a.rate - b.rate).slice(0, 10)
  return (
    <div className="stack">
      <div className="mhead"><h2>رئيس القسم</h2><Link className="linkbtn" to="/">الرئيسية</Link></div>
      <div className="me-bar"><span><b>{manager.display_name}</b> · {manager.is_admin ? 'أدمن (كل الأقسام)' : manager.dept}</span><button className="linkbtn" onClick={signOutManager}>خروج</button></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Link className="btn white" to="/manager/cases" style={{ marginBottom: 6 }}>الأسئلة</Link>
        <button className="btn white" onClick={load} style={{ marginBottom: 6 }}>تحديث</button>
      </div>
      {manager.is_admin && (
        <Field label="القسم"><select value={dept} onChange={e => setDept(e.target.value === '' ? '' : +e.target.value)}><option value="">كل الأقسام</option>{depts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      )}
      <div className="kpis">
        <div className="kpi"><b className="num">{ar(d.kpis.games)}</b><span>لعبة أوض</span></div>
        <div className="kpi"><b className="num">{ar(d.kpis.players)}</b><span>لاعب</span></div>
        <div className="kpi"><b className="num">{ar(d.kpis.avg)}٪</b><span>متوسط الدرجات</span></div>
      </div>

      <div className="card sect"><h3>أكتر الأخطاء تكرارًا</h3>
        <div className="miss">{d.misses.length ? d.misses.map((m, i) => (
          <div className="it" key={i}><span><b>{m.title}</b> · {PART[m.part]}</span><span className="num small muted">{ar(m.rate)}٪ ({ar(m.wrong)} من {ar(m.n)})</span><span className="t"><i style={{ width: m.rate + '%' }} /></span></div>
        )) : <p className="muted">لسه مفيش بيانات كفاية.</p>}</div>
        <p className="small muted" style={{ marginTop: 10, fontWeight: 700 }}>على مستوى الكل: العزل {ar(d.comp.iso)}٪ · الواقيات {ar(d.comp.ppe)}٪ · الإيدين {ar(d.comp.hand)}٪</p>
      </div>

      {d.depts.length > 0 && <div className="card sect"><h3>متوسط الأقسام</h3><div className="scroll"><table className="tbl">
        <thead><tr><th>القسم</th><th className="c">لاعبين</th><th className="c">لعبات</th><th className="c">المتوسط</th></tr></thead>
        <tbody>{d.depts.map(x => <tr key={x.dept}><td><b>{x.dept}</b></td><td className="c num">{ar(x.players)}</td><td className="c num">{ar(x.games)}</td><td className="c num"><b>{ar(x.avg)}٪</b></td></tr>)}</tbody>
      </table></div></div>}

      <div className="card sect"><h3>درجة كل لاعب</h3>{d.people.length ? <div className="scroll"><table className="tbl">
        <thead><tr><th>الاسم</th><th>القسم</th><th className="c">لعب</th><th className="c">كسب</th><th className="c">المتوسط</th></tr></thead>
        <tbody>{d.people.map((p, i) => <tr key={i}><td><b>{p.name}</b><div className="small muted">{p.role === 'doctor' ? 'طبيب' : 'تمريض'}</div></td><td>{p.dept}</td><td className="c num">{ar(p.games)}</td><td className="c num">{ar(p.wins)}</td><td className="c num"><b>{ar(p.avg)}٪</b></td></tr>)}</tbody>
      </table></div> : <p className="muted">لسه محدش خلّص لعبة.</p>}</div>

      <div className="card sect"><h3>طلّع الغلطات</h3>
        <p className="small muted" style={{ fontWeight: 700, marginBottom: 10 }}>{ar(d.spot.games)} لعبة · في المتوسط بيلاقوا {ar(d.spot.avg_pct ?? 0)}٪ من الغلطات</p>
        {d.spot.games > 0 && <><p className="small" style={{ fontWeight: 800, marginBottom: 6 }}>الغلطات اللي الناس مش بتلاحظها (من الأقل للأكتر):</p>
          <div className="miss">{spotItems.map(x => <div className="it" key={x.scene + x.id}><span><b>{x.title}</b> <span className="small muted">· {x.scene}</span></span><span className="num small muted">لاحظها {ar(x.rate)}٪ ({ar(x.n)} مرة)</span><span className="t"><i style={{ width: x.rate + '%', background: 'var(--mint)' }} /></span></div>)}</div></>}
      </div>

      <div className="card sect"><h3>مين لعب ومين لأ</h3>
        {d.roster.length > 0 && <>
          <p className="small" style={{ fontWeight: 800 }}><span style={{ color: 'var(--mint-dk)' }}>لعبوا: {ar(d.roster.filter(r => r.played).length)}</span> · <span style={{ color: 'var(--coral-dk)' }}>لسه: {ar(d.roster.filter(r => !r.played).length)}</span></p>
          <div className="rost">{d.roster.map(r => <span key={r.id} className={r.played ? 'y' : 'n'}>{r.played ? '✓' : '✗'} {r.name}
            <button className="x" aria-label={'شيل ' + r.name} onClick={async () => { await rpc('roster_remove', { p_id: r.id }); load() }}>×</button></span>)}</div>
        </>}
        <Field label="ضيف أسماء الفريق (اسم في كل سطر)"><textarea id="roster" value={names} onChange={e => setNames(e.target.value)} placeholder="لازم الاسم يتكتب بنفس الطريقة اللي اللاعب كتبها" /></Field>
        <button className="btn white sm" style={{ marginTop: 8 }} disabled={!names.trim() || (manager.is_admin && dept === '')} onClick={async () => {
          try { await rpc('roster_add', { p_names: names.split('\n').map(s => s.trim()).filter(Boolean), p_dept: dept === '' ? null : dept }); setNames(''); load() } catch (e) { setErr(errorText(e)) }
        }}>ضيف</button>
        {manager.is_admin && dept === '' && <p className="small muted" style={{ marginTop: 4 }}>اختار القسم من فوق الأول عشان تضيف أسماء.</p>}
      </div>
    </div>
  )
}
