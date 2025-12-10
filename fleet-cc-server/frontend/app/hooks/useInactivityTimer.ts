'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Hook to track user inactivity and trigger a callback when timeout is reached
 * Resets the timer on user activity (mouse movement, clicks, key presses) and navigation
 * @param onTimeout - Callback to execute when timeout is reached
 * @param timeoutMinutes - Timeout in minutes (default 15)
 * @param isActive - Whether the timer should be active (default true)
 */
export function useInactivityTimer(
	onTimeout: () => void,
	timeoutMinutes: number = 15,
	isActive: boolean = true
) {
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)
	const pathname = usePathname()

	// Get timeout in milliseconds (convert minutes to milliseconds)
	const timeoutMs = timeoutMinutes * 60 * 1000

	// Reset the timer
	const resetTimer = useCallback(() => {
		// Only reset if timer is active
		if (!isActive) {
			return
		}

		// Clear existing timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
		}

		// Set new timeout
		timeoutRef.current = setTimeout(() => {
			onTimeout()
		}, timeoutMs)
	}, [timeoutMs, onTimeout, isActive])

	// Clear the timer
	const clearTimer = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
	}, [])

	useEffect(() => {
		// Don't set up listeners if timer is not active
		if (!isActive) {
			clearTimer()
			return
		}

		// Events that indicate user activity
		const events = [
			'mousedown',
			'mousemove',
			'keypress',
			'scroll',
			'touchstart',
			'click',
			'apiActivity',
		]

		// Reset timer on user activity
		const handleActivity = () => {
			if (isActive) {
				resetTimer()
			}
		}

		// Add event listeners
		events.forEach(event => {
			window.addEventListener(event, handleActivity, { passive: true })
		})

		// Start the timer
		resetTimer()

		// Cleanup
		return () => {
			events.forEach(event => {
				window.removeEventListener(event, handleActivity)
			})
			clearTimer()
		}
	}, [resetTimer, clearTimer, isActive])

	// Reset timer on route change (navigation) - only if active
	useEffect(() => {
		if (isActive) {
			resetTimer()
		}
	}, [pathname, resetTimer, isActive])

	return {
		resetTimer,
		clearTimer,
	}
}
