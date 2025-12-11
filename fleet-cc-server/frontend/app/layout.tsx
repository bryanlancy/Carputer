import type { Metadata } from 'next'
import './globals.scss'
import { NotificationProviderWrapper } from './components/notifications/NotificationProviderWrapper'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGuard } from './components/ui/AuthGuard'
import { ConditionalNavbar } from './components/ui/ConditionalNavbar'
import NotificationPopupManager from './components/notifications/NotificationPopupManager'

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
				<AuthProvider>
					<NotificationProviderWrapper>
						<AuthGuard>
							<ConditionalNavbar />
							{children}
							<NotificationPopupManager />
						</AuthGuard>
					</NotificationProviderWrapper>
				</AuthProvider>
			</body>
		</html>
	)
}
