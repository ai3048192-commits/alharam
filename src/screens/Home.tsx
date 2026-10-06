import { Link } from 'react-router-dom'
import { useSession } from '../lib/session'
import { Scene, ShareButton, Svg } from '../components/ui'
import { MODE_IC } from '../art'
import { appUrl } from '../lib/share'

function Mode({ to, id, c, d, title, sub, isNew }: { to: string; id: string; c: string; d: string; title: string; sub: string; isNew?: boolean }) {
  return (
    <Link className="mode" to={to} style={{ ['--c' as any]: c, ['--d' as any]: d }}>
      <span className="mi"><Svg html={MODE_IC[id]} /></span>
      <span><b>{title}{isNew && <em className="new" style={{ fontStyle: 'normal' }}>جديد</em>}</b><span>{sub}</span></span>
      <span className="go">‹</span>
    </Link>
  )
}

export default function Home() {
  const { player, depts, manager } = useSession()
  const dept = depts.find(d => d.id === player?.dept_id)?.name
  return (
    <div className="stack">
      <div className="logo">
        <h1>حارب العدوى</h1>
        <p className="subtitle">فريق مكافحة العدوى - مستشفى الهرم</p>
      </div>
      <Scene room="204" sign="airborne" layers={['n95']} />
      {player && (
        <div className="me-bar">
          <span>أهلًا <b>{player.name}</b> · {dept}</span>
          <Link className="linkbtn" to="/profile">تعديل</Link>
        </div>
      )}
      <div className="modes">
        <Mode to="/play/duel" id="duel" c="#FF9F1C" d="#D9780A" title="مبارزة" sub="العب وابعت التحدي لزميلك على واتساب" />
        <Mode to="/play/solo" id="solo" c="#D9C2FF" d="#7B4FC0" title="العب لوحدك" sub="٦ أوض، وحاول تكسر رقمك" />
        <Mode to="/spot" id="spot" c="#FFB3BD" d="#D63848" title="طلّع الغلطات" sub="صورة جديدة كل مرة. لاقي غلطات العدوى" isNew />
      </div>
      <ShareButton className="btn ghost" label="ابعت اللعبة لزمايلك" data={{ title: 'حارب العدوى', text: 'جرب لعبة «حارب العدوى»: مبارزة العزل ونظافة الإيدين 🚪', url: appUrl('/') }} />
      <Link className="btn ghost" to="/manager">{manager ? 'صفحة رئيس القسم' : 'دخول رئيس القسم'}</Link>
    </div>
  )
}
