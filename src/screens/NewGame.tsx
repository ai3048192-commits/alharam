import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { ar, errorText } from '../lib/content'
import { Header } from '../components/ui'

export default function NewGame() {
  const { mode } = useParams()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const duel = mode === 'duel'
  const start = async () => {
    setBusy(true); setErr('')
    try { const s = await rpc('create_set', { p_mode: duel ? 'duel' : 'solo', p_level: 'all' }); nav('/g/' + s.code, { replace: true }) }
    catch (e) { setErr(errorText(e)); setBusy(false) }
  }
  return (
    <div className="stack">
      <Header title={duel ? 'مبارزة جديدة' : 'العب لوحدك'} />
      <div className="card stack" style={{ gap: 8 }}>
        <p className="small muted" style={{ fontWeight: 600 }}>
          قدامك {ar(6)} أوض بحالات مختلفة، وكل أوضة ليها {ar(45)} ثانية.
          {duel ? ' بعد ما تخلص هتاخد لينك تبعته لزميلك، وهيلعب نفس الحالات بالظبط.' : ''}
        </p>
      </div>
      {err && <p className="err">{err}</p>}
      <button className="btn mint" onClick={start} disabled={busy}>{busy ? 'بنجهّز الأوض...' : 'ابدأ'}</button>
    </div>
  )
}
