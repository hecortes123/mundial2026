'use client'

import { useState } from 'react'

interface KeyPlayer {
  team: string
  player: string
  reason: string
}

interface AiPredictionData {
  home_win_pct: number
  draw_pct: number
  away_win_pct: number
  home_expected_goals: number
  away_expected_goals: number
  key_players: KeyPlayer[]
  recent_form: { home: string; away: string }
  analysis_text: string
  generated_at?: string
}

interface Props {
  matchId: number
  homeTeam: string
  awayTeam: string
  existing?: AiPredictionData | null
  hasExisting: boolean
  isAdmin: boolean
}

export default function AiPrediction({ matchId, homeTeam, awayTeam, existing, hasExisting, isAdmin }: Props) {
  const [prediction, setPrediction] = useState<AiPredictionData | null>(existing ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/ai-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al generar pronóstico')
        return
      }

      setPrediction(data.prediction)
      setOpen(true)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const isClickable = hasExisting || !!prediction

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
      <button
        onClick={() => {
          if (isClickable) {
            setOpen(!open)
          }
        }}
        disabled={loading || !isClickable}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: 600,
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: isClickable ? 'var(--fifa-blue)' : 'var(--text-muted)',
          cursor: isClickable ? 'pointer' : 'not-allowed',
          letterSpacing: '0.02em',
        }}
      >
        {loading ? (
          <>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid var(--fifa-blue)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
            Analizando con IA...
          </>
        ) : (
          <>
            <span>🤖</span>
            {isClickable
              ? open ? 'Ocultar análisis IA' : 'Ver análisis IA'
              : 'Análisis IA no disponible aún'}
          </>
        )}
      </button>

      {error && <p style={{ fontSize: '11px', color: 'var(--fifa-red)', marginTop: '8px' }}>{error}</p>}

      {prediction && open && (
        <div style={{
          marginTop: '14px',
          background: 'var(--bg-deep)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid var(--border-subtle)',
        }}>
          {/* Probabilidades */}
          <div style={{ marginBottom: '16px' }}>
            <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '0 0 8px', fontSize: '10px' }}>
              Probabilidades
            </p>

            {/* Barra de probabilidades */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
              <div style={{
                flex: prediction.home_win_pct,
                background: 'var(--fifa-green)',
                height: '8px',
                borderRadius: '4px',
              }} />
              <div style={{
                flex: prediction.draw_pct,
                background: 'var(--fifa-gold)',
                height: '8px',
                borderRadius: '4px',
              }} />
              <div style={{
                flex: prediction.away_win_pct,
                background: 'var(--fifa-blue)',
                height: '8px',
                borderRadius: '4px',
              }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fifa-green)', margin: 0, letterSpacing: '-0.02em' }}>
                  {prediction.home_win_pct}%
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{homeTeam}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fifa-gold)', margin: 0, letterSpacing: '-0.02em' }}>
                  {prediction.draw_pct}%
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Empate</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fifa-blue)', margin: 0, letterSpacing: '-0.02em' }}>
                  {prediction.away_win_pct}%
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{awayTeam}</p>
              </div>
            </div>
          </div>

          {/* Goles esperados */}
          <div style={{ marginBottom: '16px' }}>
            <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '0 0 8px', fontSize: '10px' }}>
              Goles esperados
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {prediction.home_expected_goals}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{homeTeam}</p>
              </div>
              <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '18px' }}>—</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {prediction.away_expected_goals}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{awayTeam}</p>
              </div>
            </div>
          </div>

          {/* Forma reciente */}
          <div style={{ marginBottom: '16px' }}>
            <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '0 0 8px', fontSize: '10px' }}>
              Forma reciente
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>{homeTeam}</p>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {prediction.recent_form.home.split('').map((r, i) => (
                    <span
                      key={i}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        background: r === 'W' ? 'var(--fifa-green)' : r === 'D' ? 'var(--fifa-gold)' : 'var(--fifa-red)',
                      }}
                    >
                      {r === 'W' ? 'G' : r === 'D' ? 'E' : 'P'}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>{awayTeam}</p>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {prediction.recent_form.away.split('').map((r, i) => (
                    <span
                      key={i}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        background: r === 'W' ? 'var(--fifa-green)' : r === 'D' ? 'var(--fifa-gold)' : 'var(--fifa-red)',
                      }}
                    >
                      {r === 'W' ? 'G' : r === 'D' ? 'E' : 'P'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Jugadores clave */}
          <div style={{ marginBottom: '16px' }}>
            <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '0 0 8px', fontSize: '10px' }}>
              Jugadores clave
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {prediction.key_players?.map((kp, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--fifa-gold)', fontSize: '12px', marginTop: '2px' }}>⭐</span>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{kp.player}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({kp.team})</span>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.5 }}>{kp.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Análisis */}
          <div>
            <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '0 0 8px', fontSize: '10px' }}>
              Análisis
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {prediction.analysis_text}
            </p>
          </div>

          {prediction.generated_at && (
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', margin: '12px 0 0' }}>
              Actualizado: {new Date(prediction.generated_at).toLocaleString('es-CO')}
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}