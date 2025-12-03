'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Redirect to login if user signs out
      if (!session && pathname !== '/login') {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, pathname])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
    }

    return { error }
  }

  const signOut = async () => {
    // Clear state immediately (optimistic update)
    setSession(null)
    setUser(null)

    // Clear all auth-related storage
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('supabase.auth.token')
      localStorage.removeItem('sb-access-token')
      localStorage.removeItem('sb-refresh-token')
      // Clear all Supabase-related keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
      sessionStorage.removeItem('auth_token')
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          sessionStorage.removeItem(key)
        }
      })
    } catch (storageError) {
      console.warn('Error clearing storage:', storageError)
    }

    // Try to sign out from Supabase (but don't wait for it if it fails)
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ])
    } catch (error) {
      // Ignore Supabase signOut errors - we've already cleared local state
      console.warn('Supabase signOut failed (continuing anyway):', error)
    }

    // Always redirect to login, regardless of Supabase response
    // Use window.location for a hard redirect to ensure clean state
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    } else {
      router.push('/login')
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

