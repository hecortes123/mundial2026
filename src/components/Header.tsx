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
      <header style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="var(--bg-deep)" stroke="var(--fifa-gold)" strokeWidth="2"/>
              <text x="50" y="60" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="38" fontWeight="900" fill="var(--fifa-gold)" letterSpacing="-2" fontStyle="italic">26</text>
              <text x="50" y="80" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="800" fill="var(--fifa-gold)" letterSpacing="3">FIFA</text>
            </svg>
            <div>
              <p style={{ color: 'var(--fifa-green)', fontSize: '10px', letterSpacing: '0.2em', fontWeight: 600, margin: 0 }}>
                COPA MUNDIAL FIFA
              </p>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                Polla 2026
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
              Hola, <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{username}</span>
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-tertiary)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {loggingOut ? '...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </header>

      <nav style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '14px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive ? 'var(--fifa-green)' : 'var(--text-tertiary)',
                  borderBottom: `2px solid ${isActive ? 'var(--fifa-green)' : 'transparent'}`,
                  letterSpacing: '0.02em',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}