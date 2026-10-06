import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../lib/session'
import { errorText, initial } from '../lib/content'
import { Field } from '../components/ui'

export default function Profile() {
  const { player, depts, saveProfile } = useSession()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [name, setName] = useState(player?.name || '')
  const [dept, setDept] = useState<number>(player?.dept_id || depts[0]?.id || 0)
  const [role, setRole] = useState<'nurse' | 'doctor'>(player?.role || 'nurse')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (name.trim().length < 2) return setErr('اكتب اسمك (حرفين على الأقل).')
    setBusy(true); setErr('')
    try { await saveProfile({ name, dept_id: dept, role }); nav(sp.get('next') || '/', { replace: true }) }
    catch (e) { setErr(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="mhead"><h2>{player ? 'بياناتك' : 'قبل ما تلعب'}</h2></div>
      <div className="pcardx" style={{ background: '#FF9F1C' }}>
        <div className="top"><div className="av">{initial(name || '؟')}</div><h3>عرّفنا بيك</h3></div>
        <Field label="الاسم"><input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم زي ما هيظهر لرئيس القسم" autoComplete="name" /></Field>
        <Field label="القسم"><select value={dept} onChange={e => setDept(+e.target.value)}>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <div className="seg" role="group" aria-label="الوظيفة">
          <button type="button" aria-pressed={role === 'nurse'} onClick={() => setRole('nurse')}>تمريض</button>
          <button type="button" aria-pressed={role === 'doctor'} onClick={() => setRole('doctor')}>طبيب</button>
        </div>
      </div>
      <p className="foot">اسمك وقسمك ونتايجك بتظهر لرئيس قسمك بس. البيانات دي محفوظة على الموبايل ده.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn mint" onClick={save} disabled={busy}>{busy ? 'بنحفظ...' : 'يلا'}</button>
    </div>
  )
}
