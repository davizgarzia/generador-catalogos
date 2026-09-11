import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function syncSession(nextSession) {
      if (!mounted) return
      setSession(nextSession)
      if (!nextSession?.user) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from("catalog_admins")
        .select("user_id")
        .eq("user_id", nextSession.user.id)
        .maybeSingle()
      if (mounted) {
        setIsAdmin(Boolean(data))
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => syncSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
