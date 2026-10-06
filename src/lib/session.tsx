import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, rpc } from './supabase'
import { errorText } from './content'

export type Player = { id: string; name: string; dept_id: number; role: 'nurse' | 'doctor' }
export type Dept = { id: number; name: string }
export type Manager = { display_name: string; dept_id: number | null; dept: string | null; is_admin: boolean }

type Ctx = {
  ready: boolean
  error: string | null
  user: User | null
  player: Player | null
  depts: Dept[]
  manager: Manager | null
  saveProfile: (p: Omit<Player, 'id'>) => Promise<void>
  refreshManager: () => Promise<void>
  signInManager: (email: string, password: string) => Promise<void>
  signOutManager: () => Promise<void>
}
const SessionCtx = createContext<Ctx>(null as unknown as Ctx)
export const useSession = () => useContext(SessionCtx)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [depts, setDepts] = useState<Dept[]>([])
  const [manager, setManager] = useState<Manager | null>(null)

  const loadFor = useCallback(async (u: User | null) => {
    setUser(u)
    if (!u) { setPlayer(null); setManager(null); return }
    const { data } = await supabase.from('players').select('id,name,dept_id,role').eq('id', u.id).maybeSingle()
    setPlayer((data as Player) || null)
    setManager(u.is_anonymous ? null : await rpc<Manager | null>('my_manager').catch(() => null))
  }, [])

  const ensureAnon = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session.user
    const r = await supabase.auth.signInAnonymously()
    if (r.error) throw r.error
    return r.data.user
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const u = await ensureAnon()
        const { data: d } = await supabase.from('departments').select('id,name').order('sort')
        if (!alive) return
        setDepts((d as Dept[]) || [])
        await loadFor(u)
      } catch (e) { if (alive) setError(errorText(e)) }
      finally { if (alive) setReady(true) }
    })()
    return () => { alive = false }
  }, [ensureAnon, loadFor])

  const saveProfile = async (p: Omit<Player, 'id'>) => {
    // make sure this device really has a live sign-in before writing (e.g. a session left over from before anonymous sign-ins were enabled)
    let u = (await supabase.auth.getUser()).data.user
    if (!u) {
      await supabase.auth.signOut().catch(() => {})
      const r = await supabase.auth.signInAnonymously()
      if (r.error) throw r.error
      u = r.data.user
    }
    const saved = await rpc<Player>('save_profile', { p_name: p.name.trim(), p_dept: p.dept_id, p_role: p.role })
    setUser(u)
    setPlayer(saved)
  }

  const refreshManager = async () => { await loadFor((await supabase.auth.getUser()).data.user) }

  const signInManager = async (email: string, password: string) => {
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) throw new Error(err.message)
    await loadFor(data.user)
  }

  const signOutManager = async () => {
    await supabase.auth.signOut()
    const u = await ensureAnon()
    await loadFor(u)
  }

  return (
    <SessionCtx.Provider value={{ ready, error, user, player, depts, manager, saveProfile, refreshManager, signInManager, signOutManager }}>
      {children}
    </SessionCtx.Provider>
  )
}
