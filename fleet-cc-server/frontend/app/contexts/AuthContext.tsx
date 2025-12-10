'use client'

import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	useRef,
	ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'
import { useInactivityTimer } from '../hooks/useInactivityTimer'
import { getApiUrl } from '../utils/api'

interface AuthContextType {
	user: User | null
	session: Session | null
	loading: boolean
	roles: string[]
	isAdmin: boolean
	signIn: (
		email: string,
		password: string
	) => Promise<{ error: AuthError | null }>
	signOut: () => Promise<void>
	isAuthenticated: boolean
	resetInactivityTimer: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)
	const [roles, setRoles] = useState<string[]>([])
	const [isAdmin, setIsAdmin] = useState(false)
	const fetchingRolesRef = useRef(false)
	const lastFetchedTokenRef = useRef<string | null>(null)
	const router = useRouter()
	const pathname = usePathname()

	// Get timeout from environment (default 15 minutes)
	const timeoutMinutes = parseInt(
		process.env.NEXT_PUBLIC_AUTH_TIMEOUT_MINUTES || '15',
		10
	)

	// Define signOut first so it can be used in useEffect hooks
	const signOut = useCallback(async () => {
		// Clear state immediately (optimistic update)
		setSession(null)
		setUser(null)
		setRoles([])
		setIsAdmin(false)

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
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Timeout')), 2000)
				),
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
	}, [router])

	const fetchUserRoles = useCallback(async (accessToken: string) => {
		// Prevent concurrent fetches and duplicate fetches for the same token
		if (fetchingRolesRef.current || lastFetchedTokenRef.current === accessToken) {
			return
		}

		fetchingRolesRef.current = true
		lastFetchedTokenRef.current = accessToken

		try {
			const apiUrl = getApiUrl()
			const response = await fetch(`${apiUrl}/api/auth/me`, {
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				},
			})

			if (response.ok) {
				const data = await response.json()
				setRoles(data.roles || [])
				setIsAdmin(data.isAdmin || false)
			} else {
				setRoles([])
				setIsAdmin(false)
				lastFetchedTokenRef.current = null // Reset on error so we can retry
			}
		} catch (error) {
			console.error('Failed to fetch user roles:', error)
			setRoles([])
			setIsAdmin(false)
			lastFetchedTokenRef.current = null // Reset on error so we can retry
		} finally {
			fetchingRolesRef.current = false
		}
	}, [])

	const signIn = async (email: string, password: string) => {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		})

		if (data.session) {
			setSession(data.session)
			setUser(data.session.user)
			// Fetch user roles after successful login
			await fetchUserRoles(data.session.access_token)
		}

		return { error }
	}

	useEffect(() => {
		let mounted = true

		// Get initial session
		supabase.auth.getSession().then(async ({ data: { session } }) => {
			if (!mounted) return
			setSession(session)
			setUser(session?.user ?? null)
			if (session?.access_token) {
				await fetchUserRoles(session.access_token)
			} else {
				setRoles([])
				setIsAdmin(false)
				lastFetchedTokenRef.current = null
			}
			setLoading(false)
		})

		// Listen for auth changes (including session revocation)
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			if (!mounted) return

			// Only fetch roles if the session token actually changed
			const tokenChanged = session?.access_token !== lastFetchedTokenRef.current

			setSession(session)
			setUser(session?.user ?? null)

			if (session?.access_token && tokenChanged) {
				await fetchUserRoles(session.access_token)
			} else if (!session?.access_token) {
				setRoles([])
				setIsAdmin(false)
				lastFetchedTokenRef.current = null
			}

			setLoading(false)

			// If session becomes null, clear state
			if (event === 'SIGNED_OUT' || !session) {
				// Clear state if session was revoked or user signed out
				setSession(null)
				setUser(null)
				setRoles([])
				setIsAdmin(false)
				lastFetchedTokenRef.current = null
			}

			// Redirect to login if user signs out
			if (!session && pathname !== '/login') {
				router.push('/login')
			}
		})

		return () => {
			mounted = false
			subscription.unsubscribe()
		}
	}, [router, pathname, fetchUserRoles]) // Removed 'user' from deps to prevent loops

	// Listen for session expiration events from API calls (backend revoked session)
	useEffect(() => {
		const handleSessionExpired = async (event: Event) => {
			// Backend has revoked the session - verify and log out
			try {
				// Double-check we still have a session before logging out
				const {
					data: { session: currentSession },
				} = await supabase.auth.getSession()

				if (currentSession || user || session) {
					console.log(
						'[Auth] Session expired or revoked by backend - logging out'
					)
					// Clear state immediately
					setSession(null)
					setUser(null)
					setRoles([])
					setIsAdmin(false)
					// Sign out
					signOut()
				}
			} catch (error) {
				// If we can't check session but we have user/session state, log out anyway
				if (user || session) {
					console.log(
						'[Auth] Session expired or revoked by backend - logging out (error checking session)'
					)
					setSession(null)
					setUser(null)
					setRoles([])
					setIsAdmin(false)
					signOut()
				}
			}
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('sessionExpired', handleSessionExpired)
			return () => {
				window.removeEventListener(
					'sessionExpired',
					handleSessionExpired
				)
			}
		}
	}, [user, session, signOut])

	// Setup inactivity timer - auto-logout after inactivity
	// Only run timer when user is authenticated
	const { resetTimer, clearTimer } = useInactivityTimer(
		useCallback(() => {
			// Timeout callback - sign out the user
			if (user || session) {
				console.log(
					`[Auth] Auto-logging out due to ${timeoutMinutes} minutes of inactivity`
				)
				signOut()
			}
		}, [user, session, timeoutMinutes, signOut]),
		timeoutMinutes,
		!!user || !!session // Only active when authenticated
	)

	// Clear timer when user logs out, start/reset when user logs in
	useEffect(() => {
		if (user || session) {
			// User is authenticated - reset timer to start fresh
			resetTimer()
		} else {
			// User is not authenticated - clear timer
			clearTimer()
		}
	}, [user, session, resetTimer, clearTimer])

	// Expose reset function for API calls
	const resetInactivityTimer = useCallback(() => {
		resetTimer()
	}, [resetTimer])

	const value: AuthContextType = {
		user,
		session,
		loading,
		roles,
		isAdmin,
		signIn,
		signOut,
		isAuthenticated: !!user,
		resetInactivityTimer,
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
