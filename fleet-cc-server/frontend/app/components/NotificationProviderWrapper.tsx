'use client'

import { NotificationProvider } from '../contexts/NotificationContext'
import { NotificationFeed } from './NotificationFeed'

export function NotificationProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      {children}
      <NotificationFeed />
    </NotificationProvider>
  )
}

