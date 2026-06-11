'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface Props {
  username: string
  isAdmin?: boolean
}

export default function Header({ username, isAdmin }: Props) {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  const navItems = [
    { href: '/dashboard', label: 'Inicio' },
    { href: '/pronosticos', label: 'Pronósticos' },
    { href: '/ranking', label: 'Ranking' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <>
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">⚽ Polla Mundial 2026</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Hola, <span className="text-white font-medium">{username}</span>
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-sm text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {loggingOut ? '...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                pathname === item.href
                  ? 'text-white border-blue-500'
                  : 'text-gray-400 hover:text-white border-transparent'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}