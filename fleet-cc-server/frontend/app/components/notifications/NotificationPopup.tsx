'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { parseMarkdown } from '../../utils/markdown'
import { NotificationTimer } from './NotificationTimer'
import styles from './NotificationPopup.module.scss'

// Register the useGSAP plugin to avoid React version discrepancies
gsap.registerPlugin(useGSAP)

interface NotificationPopupProps {
	notification: {
		id: string
		title: string
		message: string
		type: 'online' | 'offline' | 'info' | 'success' | 'warning' | 'error'
		timestamp: Date
	}
	onClose: () => void
}

const DURATION = 5000 // 5 seconds
const HOVER_RESTART_DELAY = 2000 // 2 seconds
const EXIT_ANIMATION_DURATION = 0.3 // seconds

const getIcon = (type: string): string => {
	switch (type) {
		case 'online':
		case 'success':
			return '✓'
		case 'offline':
		case 'error':
			return '✕'
		case 'warning':
			return '⚠'
		case 'info':
			return 'ℹ'
		default:
			return '•'
	}
}

export function NotificationPopup({
	notification,
	onClose,
}: NotificationPopupProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const timerRef = useRef<NodeJS.Timeout | null>(null)
	const hoverRestartTimerRef = useRef<NodeJS.Timeout | null>(null)
	const exitAnimationRef = useRef<gsap.core.Tween | null>(null)
	const [isPaused, setIsPaused] = useState(false)
	const [progress, setProgress] = useState(100)
	const hoverStartTimeRef = useRef<number | null>(null)
	const [isExiting, setIsExiting] = useState(false)
	const timerStartTimeRef = useRef<number>(0)
	const timerPausedTimeRef = useRef<number>(0)
	const pauseStartTimeRef = useRef<number | null>(null)
	const onCloseRef = useRef(onClose)
	const handleCloseWithAnimationRef = useRef<(() => void) | null>(null)

	// Entry animation and contextSafe setup using useGSAP
	const { contextSafe } = useGSAP(
		() => {
			const element = containerRef.current
			if (!element) return

			// Set initial state - start off screen to the right
			gsap.set(element, {
				x: 400,
				opacity: 0,
			})

			// Animate in - fade in and slide in from the right
			gsap.to(element, {
				x: 0,
				opacity: 1,
				duration: 0.4,
				ease: 'power2.out',
			})
		},
		{ scope: containerRef }
	)

	// Create close handler using contextSafe and store in ref
	useEffect(() => {
		handleCloseWithAnimationRef.current = contextSafe(() => {
			if (isExiting) return // Prevent multiple calls
			setIsExiting(true)

			const element = containerRef.current
			if (!element) {
				onCloseRef.current()
				return
			}

			// Clean up timers
			if (timerRef.current) {
				clearTimeout(timerRef.current)
				timerRef.current = null
			}
			if (hoverRestartTimerRef.current) {
				clearTimeout(hoverRestartTimerRef.current)
				hoverRestartTimerRef.current = null
			}

			// Animate out - fade out and slide off screen to the right
			exitAnimationRef.current = gsap.to(element, {
				x: 400,
				opacity: 0,
				duration: EXIT_ANIMATION_DURATION,
				ease: 'power2.in',
				onComplete: () => {
					onCloseRef.current()
				},
			})
		})
	}, [contextSafe, isExiting])

	// Keep onClose ref up to date
	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	// Initialize timer start time on mount
	useEffect(() => {
		timerStartTimeRef.current = Date.now()
	}, [])

	// Timer logic - updates progress state which is passed to NotificationTimer
	useEffect(() => {
		if (isExiting) return

		const updateProgress = () => {
			if (isPaused) {
				if (pauseStartTimeRef.current === null) {
					pauseStartTimeRef.current = Date.now()
				}
				// Continue checking while paused (but don't update progress)
				timerRef.current = setTimeout(updateProgress, 50)
				return
			}

			// If we just resumed from pause, adjust for paused time
			if (pauseStartTimeRef.current !== null) {
				const pauseDuration = Date.now() - pauseStartTimeRef.current
				timerPausedTimeRef.current += pauseDuration
				pauseStartTimeRef.current = null
			}

			const elapsed =
				Date.now() -
				timerStartTimeRef.current -
				timerPausedTimeRef.current
			const remaining = Math.max(0, DURATION - elapsed)
			const newProgress = (remaining / DURATION) * 100

			setProgress(newProgress)

			if (remaining > 0) {
				timerRef.current = setTimeout(updateProgress, 50)
			} else {
				// Use ref to avoid dependency issues
				if (handleCloseWithAnimationRef.current) {
					handleCloseWithAnimationRef.current()
				}
			}
		}

		updateProgress()

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
			}
			// Don't clear hoverRestartTimerRef here - it's managed separately
			// Clearing it here would cancel the 2-second timeout when isPaused changes!
		}
	}, [isPaused, isExiting])

	// Cleanup hoverRestartTimerRef on unmount only
	useEffect(() => {
		return () => {
			if (hoverRestartTimerRef.current) {
				clearTimeout(hoverRestartTimerRef.current)
				hoverRestartTimerRef.current = null
			}
		}
	}, [])

	// Handle hover - pause kill timer and start 2-second timeout
	const handleMouseEnter = () => {
		setIsPaused(true)
		hoverStartTimeRef.current = Date.now()

		// Start 2-second timeout to check if still hovering
		hoverRestartTimerRef.current = setTimeout(() => {
			// User is still hovering after 2 seconds - reset kill timer while paused
			// Check if still paused by checking pauseStartTimeRef (more reliable than state in closure)
			if (pauseStartTimeRef.current !== null) {
				// Reset timer completely - start fresh from now
				const resetTime = Date.now()
				timerStartTimeRef.current = resetTime
				timerPausedTimeRef.current = 0
				// Reset pause start time to now (we're still paused, restart pause tracking from reset point)
				pauseStartTimeRef.current = resetTime

				// Update progress to 100% - NotificationTimer component will handle the animation
				setProgress(100)
			}
		}, HOVER_RESTART_DELAY)
	}

	const handleMouseLeave = () => {
		// Clear the 2-second hover timeout if user leaves before it completes
		if (hoverRestartTimerRef.current) {
			clearTimeout(hoverRestartTimerRef.current)
			hoverRestartTimerRef.current = null
		}

		// Resume kill timer (if it was reset during hover, it will continue from 100%)
		setIsPaused(false)
		hoverStartTimeRef.current = null
	}

	return (
		<div
			ref={containerRef}
			className={`${styles.notification} ${styles[notification.type]}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}>
			<NotificationTimer progress={progress} />
			<div className={styles.icon}>{getIcon(notification.type)}</div>
			<div className={styles.content}>
				<div className={styles.title}>{notification.title}</div>
				<div
					className={styles.message}
					dangerouslySetInnerHTML={{
						__html: parseMarkdown(notification.message),
					}}
				/>
			</div>
			<button
				className={styles.close}
				onClick={() => {
					if (handleCloseWithAnimationRef.current) {
						handleCloseWithAnimationRef.current()
					}
				}}
				aria-label='Close'>
				×
			</button>
		</div>
	)
}
