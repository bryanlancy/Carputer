'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import styles from './NotificationTimer.module.scss'

interface NotificationTimerProps {
	progress: number // 0-100
}

export function NotificationTimer({ progress }: NotificationTimerProps) {
	const progressRef = useRef<HTMLDivElement>(null)
	const animationRef = useRef<gsap.core.Tween | null>(null)
	const previousProgressRef = useRef<number>(100)

	useEffect(() => {
		const progressBar = progressRef.current
		if (!progressBar) return

		// Kill any existing animation
		if (animationRef.current) {
			animationRef.current.kill()
		}

		// If progress jumped to 100% from a lower value, use smooth animation (for reset)
		// Otherwise use quick animation for normal countdown
		const isReset = progress === 100 && previousProgressRef.current < 100
		const duration = isReset ? 0.3 : 0.1
		const ease = isReset ? 'power2.out' : 'none'

		// Animate progress bar to new value
		animationRef.current = gsap.to(progressBar, {
			scaleX: progress / 100,
			duration,
			ease,
		})

		// Update previous progress for next comparison
		previousProgressRef.current = progress

		return () => {
			if (animationRef.current) {
				animationRef.current.kill()
			}
		}
	}, [progress])

	return (
		<div className={styles.timerBar}>
			<div ref={progressRef} className={styles.timerProgress} />
		</div>
	)
}

