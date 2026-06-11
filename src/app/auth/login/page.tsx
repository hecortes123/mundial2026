'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-deep)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '420px',
        border: '1px solid var(--border-subtle)',
      }}>
        {/* Emblema */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <svg width="64" height="64" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="var(--bg-deep)" stroke="var(--fifa-gold)" strokeWidth="2"/>
            <text x="50" y="60" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="38" fontWeight="900" fill="var(--fifa-gold)" letterSpacing="-2" fontStyle="italic">26</text>
            <text x="50" y="80" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="800" fill="var(--fifa-gold)" letterSpacing="3">FIFA</text>
          </svg>
          <p className="fifa-label" style={{ color: 'var(--fifa-green)', margin: '12px 0 4px' }}>
            COPA MUNDIAL FIFA
          </p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Polla 2026
          </h1>
        </div>

        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', margin: '0 0 24px' }}>
          Iniciar sesión
        </p>

        {error && (
          <div style={{
            background: 'rgba(204, 34, 41, 0.1)',
            border: '1px solid rgba(204, 34, 41, 0.3)',
            color: 'var(--fifa-red)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="fifa-label" style={{ color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              style={{
                width: '100%',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="fifa-label" style={{ color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              background: 'var(--fifa-green)',
              color: 'white',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
              marginTop: '8px',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', margin: '24px 0 0' }}>
          ¿No tienes cuenta?{' '}
          <Link href="/auth/registro" style={{ color: 'var(--fifa-green)', textDecoration: 'none', fontWeight: 600 }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}