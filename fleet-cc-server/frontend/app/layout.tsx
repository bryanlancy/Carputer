import type { Metadata } from 'next'
import './globals.scss'

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
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

