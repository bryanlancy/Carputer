'use client'

import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to get the authentication token for API requests
 * Returns the Supabase session access token if available
 */
export function useAuthToken(): string | null {
  const { session } = useAuth()
  return session?.access_token || null
}

