'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, loading } = useAuth()
	const router = useRouter()
	const pathname = usePathname()

	useEffect(() => {
		// Don't redirect if we're on the login page or still loading
		if (loading) return
		if (pathname === '/login') return

		// Redirect to login if not authenticated
		if (!isAuthenticated) {
			router.push('/login')
		}
	}, [isAuthenticated, loading, pathname, router])

	// Show nothing while checking auth (prevents flash of content)
	if (loading) {
		return (
			<div
				style={{
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'var(--bg-primary)',
					color: 'var(--text-secondary)',
				}}>
				Loading...
			</div>
		)
	}

	// Don't render protected content if not authenticated (will redirect)
	if (!isAuthenticated && pathname !== '/login') {
		return null
	}

	return <>{children}</>
}
