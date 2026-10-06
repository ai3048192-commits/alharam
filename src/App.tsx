import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { SessionProvider, useSession } from './lib/session'
import { Loading, ErrorBox } from './components/ui'
import Home from './screens/Home'
import Profile from './screens/Profile'
import NewGame from './screens/NewGame'
import Game from './screens/Game'
import Spot from './screens/Spot'
import ManagerHome from './manager/ManagerHome'
import Cases from './manager/Cases'

function NeedsProfile({ children }: { children: JSX.Element }) {
  const { player } = useSession()
  const loc = useLocation()
  if (!player) return <Navigate to={'/profile?next=' + encodeURIComponent(loc.pathname)} replace />
  return children
}

function Shell() {
  const { ready, error } = useSession()
  if (!ready) return <Loading text="بنجهّز اللعبة..." />
  if (error) return <ErrorBox text={error} retry={() => location.reload()} />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/play/:mode" element={<NeedsProfile><NewGame /></NeedsProfile>} />
      <Route path="/g/:code" element={<NeedsProfile><Game /></NeedsProfile>} />
      <Route path="/spot" element={<NeedsProfile><Spot /></NeedsProfile>} />
      <Route path="/manager" element={<ManagerHome />} />
      <Route path="/manager/cases" element={<Cases />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <div id="app" dir="rtl" lang="ar">
      {configured ? <SessionProvider><Shell /></SessionProvider> : (
        <div className="card stack" style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--display)' }}>محتاج إعداد Supabase</h2>
          <p>اعمل ملف <code>.env.local</code> فيه <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code> (شوف README).</p>
        </div>
      )}
    </div>
  )
}
