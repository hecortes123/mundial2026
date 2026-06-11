'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import AiPrediction from './AiPrediction'
import Header from '@/components/Header'
import Flag from '@/components/Flag'

interface Team {
  code: string
  name: string
}

interface Match {
  id: number
  match_number: number
  phase: string
  group_letter: string | null
  home_team: Team | null
  away_team: Team | null
  home_team_placeholder: string | null
  away_team_placeholder: string | null
  match_date: string
  city: string
  status: string
}

interface Prediction {
  match_id: number
  predicted_home_score: number
  predicted_away_score: number
}

interface Props {
  matches: Match[]
  predictions: Prediction[]
  userId: string
  isAdmin: boolean
  aiPredictions: Record<number, any>
  username: string
}

export default function PronosticosClient({ matches, predictions, userId, isAdmin, aiPredictions, username }: Props) {
  const supabase = createClient()

  const predMap: Record<number, Prediction> = {}
  predictions.forEach(p => { predMap[p.match_id] = p })

  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>(() => {
    const init: Record<number, { home: string; away: string }> = {}
    matches.forEach(m => {
      const p = predMap[m.id]
      init[m.id] = {
        home: p ? String(p.predicted_home_score) : '',
        away: p ? String(p.predicted_away_score) : '',
      }
    })
    return init
  })

  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [activePhase, setActivePhase] = useState('grupo')

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const PHASES = [
    { key: 'grupo', label: 'Fase de Grupos' },
    { key: 'dieciseisavos', label: 'Dieciseisavos' },
    { key: 'octavos', label: 'Octavos' },
    { key: 'cuartos', label: 'Cuartos' },
    { key: 'semifinal', label: 'Semifinales' },
    { key: 'tercer_puesto', label: 'Tercer puesto' },
    { key: 'final', label: 'Final' },
  ]

  const handleSave = async (matchId: number) => {
    const score = scores[matchId]
    if (score.home === '' || score.away === '') return

    setSaving(matchId)

    const { error } = await supabase
      .from('predictions')
      .upsert({
        user_id: userId,
        match_id: matchId,
        predicted_home_score: parseInt(score.home),
        predicted_away_score: parseInt(score.away),
      }, { onConflict: 'user_id,match_id' })

    setSaving(null)
    if (!error) {
      setSaved(prev => ({ ...prev, [matchId]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [matchId]: false })), 2000)
    }
  }

  const renderMatchCard = (match: Match) => {
    const isPending = match.status === 'pendiente'
    const hasPred = !!predMap[match.id]
    const isSaving = saving === match.id
    const isSaved = saved[match.id]

    return (
      <div
        key={match.id}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto',
          gap: '16px',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                {match.home_team?.name ?? match.home_team_placeholder}
              </p>
              <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '2px 0 0', fontSize: '10px' }}>
                {match.home_team?.code ?? ''}
              </p>
            </div>
            <Flag code={match.home_team?.code} size={28} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min="0"
              max="20"
              disabled={!isPending}
              value={scores[match.id]?.home ?? ''}
              onChange={e => setScores(prev => ({
                ...prev,
                [match.id]: { ...prev[match.id], home: e.target.value }
              }))}
              style={{
                width: '48px',
                height: '40px',
                textAlign: 'center',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '16px',
                outline: 'none',
                opacity: !isPending ? 0.4 : 1,
              }}
            />
            <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '18px' }}>-</span>
            <input
              type="number"
              min="0"
              max="20"
              disabled={!isPending}
              value={scores[match.id]?.away ?? ''}
              onChange={e => setScores(prev => ({
                ...prev,
                [match.id]: { ...prev[match.id], away: e.target.value }
              }))}
              style={{
                width: '48px',
                height: '40px',
                textAlign: 'center',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '16px',
                outline: 'none',
                opacity: !isPending ? 0.4 : 1,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Flag code={match.away_team?.code} size={28} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                {match.away_team?.name ?? match.away_team_placeholder}
              </p>
              <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '2px 0 0', fontSize: '10px' }}>
                {match.away_team?.code ?? ''}
              </p>
            </div>
          </div>

          <div style={{ minWidth: '110px', textAlign: 'right' }}>
            {isPending ? (
              <button
                onClick={() => handleSave(match.id)}
                disabled={isSaving}
                style={{
                  fontSize: '12px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: isSaved
                    ? 'var(--fifa-green)'
                    : hasPred
                    ? 'var(--bg-elevated)'
                    : 'var(--fifa-blue)',
                  color: 'white',
                  opacity: isSaving ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {isSaving ? '...' : isSaved ? '✓ Guardado' : hasPred ? 'Actualizar' : 'Guardar'}
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {match.status === 'finalizado' ? '⏱ Finalizado' : '🔒 Cerrado'}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, letterSpacing: '0.02em' }}>
            {new Date(match.match_date).toLocaleString('es-CO', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Bogota',
            })} · {match.city}
          </p>
        </div>

        <AiPrediction
          matchId={match.id}
          homeTeam={match.home_team?.name ?? match.home_team_placeholder ?? ''}
          awayTeam={match.away_team?.name ?? match.away_team_placeholder ?? ''}
          hasExisting={!!aiPredictions[match.id]}
          existing={aiPredictions[match.id]}
          isAdmin={isAdmin}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={username} isAdmin={isAdmin} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Mis pronósticos
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 24px' }}>
          3 pts por marcador exacto · 1 pt por resultado correcto
        </p>

        <div className="flex gap-1 overflow-x-auto mb-6 pb-1">
          {PHASES.map(phase => {
            const isActive = activePhase === phase.key
            return (
              <button
                key={phase.key}
                onClick={() => setActivePhase(phase.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  background: isActive ? 'var(--fifa-green)' : 'var(--bg-surface)',
                  color: isActive ? 'white' : 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {phase.label}
              </button>
            )
          })}
        </div>

        {activePhase === 'grupo' ? (
          groups.map(group => {
            const groupMatches = matches.filter(m => m.phase === 'grupo' && m.group_letter === group)
            if (!groupMatches.length) return null

            return (
              <div key={group} className="mb-6">
                <h3 className="fifa-label" style={{ color: 'var(--fifa-gold)', margin: '24px 0 12px', fontSize: '11px' }}>
                  Grupo {group}
                </h3>
                <div className="space-y-2">
                  {groupMatches.map(renderMatchCard)}
                </div>
              </div>
            )
          })
        ) : (
          (() => {
            const phaseMatches = matches.filter(m => m.phase === activePhase && m.home_team && m.away_team)

            if (!phaseMatches.length) {
              return (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-tertiary)', margin: 0 }}>
                    Aún no hay equipos asignados a esta fase.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0 0' }}>
                    Los pronósticos se habilitarán cuando termine la fase anterior.
                  </p>
                </div>
              )
            }

            return (
              <div className="space-y-2">
                {phaseMatches.map(renderMatchCard)}
              </div>
            )
          })()
        )}
      </main>
    </div>
  )
}