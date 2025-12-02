import type { Metadata } from 'next'
import './globals.scss'
import { NotificationProviderWrapper } from './components/NotificationProviderWrapper'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGuard } from './components/AuthGuard'
import { ConditionalNavbar } from './components/ConditionalNavbar'

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
						</AuthGuard>
					</NotificationProviderWrapper>
				</AuthProvider>
			</body>
		</html>
	)
}
