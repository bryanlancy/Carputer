import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.scss'
import styles from './layout.module.scss'
import { NotificationProviderWrapper } from './components/NotificationProviderWrapper'

export const metadata: Metadata = {
	title: 'Fleet Command & Control',
	description: 'Central management system for Carputer fleet',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang='en'>
			<body>
				<NotificationProviderWrapper>
					<nav className={styles.nav}>
						<div className={styles.navContainer}>
							<Link href='/' className={styles.navBrand}>
								Fleet CC
							</Link>
							<div className={styles.navLinks}>
								<Link href='/' className={styles.navLink}>
									Dashboard
								</Link>
								<Link href='/devices' className={styles.navLink}>
									Devices
								</Link>
								<Link href='/images' className={styles.navLink}>
									Images
								</Link>
								<Link href='/docs' className={styles.navLink}>
									Docs
								</Link>
							</div>
						</div>
					</nav>
					{children}
				</NotificationProviderWrapper>
			</body>
		</html>
	)
}
