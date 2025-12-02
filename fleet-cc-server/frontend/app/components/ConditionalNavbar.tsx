'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export function ConditionalNavbar() {
  const pathname = usePathname()

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null
  }

  return <Navbar />
}

