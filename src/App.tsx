import { useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { SessionProvider, useSession } from './lib/session'
import { Loading, ErrorBox } from './components/ui'
import Home from './screens/Home'
import Profile from './screens/Profile'
import NewGame from './screens/NewGame'
import Game from './screens/Game'
import Spot from './screens/Spot'
import Mirror from './screens/Mirror'
import MirrorCalibrate from './screens/MirrorCalibrate'
import ManagerHome from './manager/ManagerHome'
import Cases from './manager/Cases'
import { flushPending } from './mirror/queue'
import Kiosk from './kiosk/Kiosk'
import KioskSettings from './kiosk/KioskSettings'
import KioskPrint from './kiosk/KioskPrint'

function NeedsProfile({ children }: { children: JSX.Element }) {
  const { player } = useSession()
  const loc = useLocation()
  if (!player) return <Navigate to={'/profile?next=' + encodeURIComponent(loc.pathname)} replace />
  return children
}

function Shell() {
  const { ready, error } = useSession()
  const { pathname } = useLocation()
  // send mirror results that were saved while offline, now and whenever the connection comes back
  useEffect(() => {
    if (!ready) return
    flushPending()
    window.addEventListener('online', flushPending)
    return () => window.removeEventListener('online', flushPending)
  }, [ready])
  // the smart mirror and the PPE station run on the device itself, so they don't wait for (or need) the server
  const mirror = pathname.startsWith('/mirror') || pathname.startsWith('/kiosk')
  if (!ready && !mirror) return <Loading text="بنجهّز اللعبة..." />
  if (error && !mirror) return (
    <div className="stack">
      <ErrorBox text={error} retry={() => location.reload()} />
      <Link className="btn mint" to="/mirror">افتح المراية الذكية (بتشتغل من غير نت)</Link>
    </div>
  )
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/play/:mode" element={<NeedsProfile><NewGame /></NeedsProfile>} />
      <Route path="/g/:code" element={<NeedsProfile><Game /></NeedsProfile>} />
      <Route path="/spot" element={<NeedsProfile><Spot /></NeedsProfile>} />
      <Route path="/mirror" element={<Mirror />} />
      <Route path="/mirror/calibrate" element={<MirrorCalibrate />} />
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/kiosk/settings" element={<KioskSettings />} />
      <Route path="/kiosk/print" element={<KioskPrint />} />
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
