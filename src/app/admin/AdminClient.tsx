'use client'

import { useState } from 'react'
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
  home_score: number | null
  away_score: number | null
}

interface Props {
  matches: Match[]
  aiMap: Record<number, string>
  username: string
  teams: { id: number; code: string; name: string }[]
}

const PHASES = [
  { key: 'grupo', label: 'Fase de Grupos' },
  { key: 'dieciseisavos', label: 'Dieciseisavos' },
  { key: 'octavos', label: 'Octavos' },
  { key: 'cuartos', label: 'Cuartos' },
  { key: 'semifinal', label: 'Semifinales' },
  { key: 'tercer_puesto', label: 'Tercer puesto' },
  { key: 'final', label: 'Final' },
]

const TABS = ['pronósticos', 'resultados', 'eliminatorias'] as const
type Tab = typeof TABS[number]

export default function AdminClient({ matches, aiMap, username, teams }: Props) {
  const [generating, setGenerating] = useState<Record<number, boolean>>({})
  const [generated, setGenerated] = useState<Record<number, string>>(aiMap)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [activePhase, setActivePhase] = useState('grupo')
  const [activeGroup, setActiveGroup] = useState('A')
  const [batchLoading, setBatchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('pronósticos')

  const [resultScores, setResultScores] = useState<Record<number, { home: string; away: string }>>(() => {
    const init: Record<number, { home: string; away: string }> = {}
    matches.forEach(m => {
      init[m.id] = {
        home: m.home_score !== null ? String(m.home_score) : '',
        away: m.away_score !== null ? String(m.away_score) : '',
      }
    })
    return init
  })
  const [savingResult, setSavingResult] = useState<number | null>(null)
  const [savedResult, setSavedResult] = useState<Record<number, boolean>>({})
  const [resultErrors, setResultErrors] = useState<Record<number, string>>({})

  const [eliminatoriaPhase, setEliminatoriaPhase] = useState('dieciseisavos')
  const [savingAssign, setSavingAssign] = useState<number | null>(null)
  const [assignErrors, setAssignErrors] = useState<Record<number, string>>({})

  const handleGenerate = async (matchId: number) => {
    setGenerating(prev => ({ ...prev, [matchId]: true }))
    setErrors(prev => ({ ...prev, [matchId]: '' }))

    try {
      const res = await fetch('/api/ai-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrors(prev => ({ ...prev, [matchId]: data.error }))
      } else {
        setGenerated(prev => ({ ...prev, [matchId]: new Date().toISOString() }))
      }
    } catch {
      setErrors(prev => ({ ...prev, [matchId]: 'Error de conexión' }))
    } finally {
      setGenerating(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleBatchGenerate = async (matchIds: number[]) => {
    setBatchLoading(true)
    for (const matchId of matchIds) {
      if (!generated[matchId]) {
        await handleGenerate(matchId)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    setBatchLoading(false)
  }

  const handleSaveResult = async (matchId: number) => {
    const score = resultScores[matchId]
    if (score.home === '' || score.away === '') return

    setSavingResult(matchId)
    setResultErrors(prev => ({ ...prev, [matchId]: '' }))

    try {
      const res = await fetch('/api/update-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          homeScore: parseInt(score.home),
          awayScore: parseInt(score.away),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResultErrors(prev => ({ ...prev, [matchId]: data.error }))
      } else {
        setSavedResult(prev => ({ ...prev, [matchId]: true }))
        setTimeout(() => setSavedResult(prev => ({ ...prev, [matchId]: false })), 2000)
      }
    } catch {
      setResultErrors(prev => ({ ...prev, [matchId]: 'Error de conexión' }))
    } finally {
      setSavingResult(null)
    }
  }

  const handleAssignTeam = async (matchId: number, side: 'home' | 'away', teamId: number | null) => {
    setSavingAssign(matchId)
    setAssignErrors(prev => ({ ...prev, [matchId]: '' }))

    try {
      const body: any = { matchId }
      if (side === 'home') body.homeTeamId = teamId
      if (side === 'away') body.awayTeamId = teamId

      const res = await fetch('/api/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setAssignErrors(prev => ({ ...prev, [matchId]: data.error }))
      } else {
        window.location.reload()
      }
    } catch {
      setAssignErrors(prev => ({ ...prev, [matchId]: 'Error de conexión' }))
    } finally {
      setSavingAssign(null)
    }
  }

  const ELIM_PHASES = [
    { key: 'dieciseisavos', label: 'Dieciseisavos' },
    { key: 'octavos', label: 'Octavos' },
    { key: 'cuartos', label: 'Cuartos' },
    { key: 'semifinal', label: 'Semifinales' },
    { key: 'tercer_puesto', label: 'Tercer puesto' },
    { key: 'final', label: 'Final' },
  ]

  const eliminatoriaMatches = matches.filter(m => m.phase === eliminatoriaPhase)
  const filteredMatches = matches.filter(m => m.phase === activePhase)
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const groupMatches = activePhase === 'grupo'
    ? filteredMatches.filter(m => m.group_letter === activeGroup)
    : filteredMatches
  const pendingInView = groupMatches.filter(m => !generated[m.id])

  const tabStyle = (active: boolean) => ({
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'var(--text-primary)' : 'var(--bg-surface)',
    color: active ? 'var(--bg-deep)' : 'var(--text-tertiary)',
    border: '1px solid var(--border-subtle)',
    transition: 'all 0.15s',
  })

  const phaseTabStyle = (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    background: active ? 'var(--fifa-blue)' : 'var(--bg-surface)',
    color: active ? 'white' : 'var(--text-tertiary)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={username} isAdmin={true} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Panel de Administración
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 24px' }}>
          Gestión de pronósticos IA, resultados y asignación de eliminatorias
        </p>

        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid var(--text-primary)' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
              {matches.length}
            </p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Total partidos</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid var(--fifa-green)' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--fifa-green)', margin: 0, letterSpacing: '-0.03em' }}>
              {Object.keys(generated).length}
            </p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Pronósticos IA</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid var(--fifa-gold)' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--fifa-gold)', margin: 0, letterSpacing: '-0.03em' }}>
              {matches.filter(m => m.status === 'finalizado').length}
            </p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Finalizados</p>
          </div>
        </div>

        {/* Tabs principales */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
              {tab === 'pronósticos' ? '🤖 Pronósticos IA' : tab === 'resultados' ? '⚽ Resultados' : '🏆 Eliminatorias'}
            </button>
          ))}
        </div>

        {/* Tabs de fase (excepto eliminatorias) */}
        {activeTab !== 'eliminatorias' && (
          <>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
              {PHASES.map(phase => (
                <button key={phase.key} onClick={() => setActivePhase(phase.key)} style={phaseTabStyle(activePhase === phase.key)}>
                  {phase.label}
                </button>
              ))}
            </div>

            {activePhase === 'grupo' && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => setActiveGroup(g)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: activeGroup === g ? 'var(--fifa-gold)' : 'var(--bg-surface)',
                      color: activeGroup === g ? 'var(--bg-deep)' : 'var(--text-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB: PRONÓSTICOS IA */}
        {activeTab === 'pronósticos' && (
          <>
            {pendingInView.length > 0 && (
              <div style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pendingInView.length}</span> pronósticos pendientes
                </p>
                <button
                  onClick={() => handleBatchGenerate(pendingInView.map(m => m.id))}
                  disabled={batchLoading}
                  style={{
                    background: 'var(--fifa-blue)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: batchLoading ? 0.5 : 1,
                  }}
                >
                  {batchLoading ? '⏳ Generando...' : '🤖 Generar todos'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groupMatches.map(match => {
                const hasAi = !!generated[match.id]
                const isGenerating = generating[match.id]
                const error = errors[match.id]

                return (
                  <div key={match.id} style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px' }}>#{match.match_number}</span>
                      <Flag code={match.home_team?.code} size={22} />
                      <p style={{ fontWeight: 600, fontSize: '13px', margin: 0, minWidth: '120px' }}>
                        {match.home_team?.name ?? match.home_team_placeholder}
                      </p>
                      <span style={{ color: 'var(--fifa-gold)', fontSize: '12px', fontWeight: 700 }}>VS</span>
                      <p style={{ fontWeight: 600, fontSize: '13px', margin: 0, minWidth: '120px' }}>
                        {match.away_team?.name ?? match.away_team_placeholder}
                      </p>
                      <Flag code={match.away_team?.code} size={22} />
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginLeft: 'auto' }}>
                        {new Date(match.match_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {match.city}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
                      {hasAi && (
                        <span style={{ fontSize: '11px', color: 'var(--fifa-green)' }}>
                          ✓ {new Date(generated[match.id]).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      <button
                        onClick={() => handleGenerate(match.id)}
                        disabled={isGenerating || batchLoading}
                        style={{
                          fontSize: '12px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: hasAi ? 'var(--bg-elevated)' : 'var(--fifa-blue)',
                          color: 'white',
                          opacity: (isGenerating || batchLoading) ? 0.5 : 1,
                        }}
                      >
                        {isGenerating ? '...' : hasAi ? '🔄 Actualizar' : '🤖 Generar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* TAB: RESULTADOS */}
        {activeTab === 'resultados' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {groupMatches.map(match => {
              const isSaving = savingResult === match.id
              const isSaved = savedResult[match.id]
              const error = resultErrors[match.id]
              const isFinished = match.status === 'finalizado'

              return (
                <div key={match.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr auto 1fr auto',
                    gap: '12px',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{match.match_number}</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
                      <p style={{ fontWeight: 600, fontSize: '13px', margin: 0, textAlign: 'right' }}>
                        {match.home_team?.name ?? match.home_team_placeholder}
                      </p>
                      <Flag code={match.home_team?.code} size={24} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={resultScores[match.id]?.home ?? ''}
                        onChange={e => setResultScores(prev => ({
                          ...prev,
                          [match.id]: { ...prev[match.id], home: e.target.value }
                        }))}
                        style={{
                          width: '44px',
                          height: '36px',
                          textAlign: 'center',
                          background: 'var(--bg-deep)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '15px',
                          outline: 'none',
                        }}
                      />
                      <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '16px' }}>-</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={resultScores[match.id]?.away ?? ''}
                        onChange={e => setResultScores(prev => ({
                          ...prev,
                          [match.id]: { ...prev[match.id], away: e.target.value }
                        }))}
                        style={{
                          width: '44px',
                          height: '36px',
                          textAlign: 'center',
                          background: 'var(--bg-deep)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '15px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Flag code={match.away_team?.code} size={24} />
                      <p style={{ fontWeight: 600, fontSize: '13px', margin: 0 }}>
                        {match.away_team?.name ?? match.away_team_placeholder}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isFinished && <span style={{ fontSize: '11px', color: 'var(--fifa-green)' }}>✓</span>}
                      <button
                        onClick={() => handleSaveResult(match.id)}
                        disabled={isSaving}
                        style={{
                          fontSize: '12px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: isSaved ? 'var(--fifa-green)' : isFinished ? 'var(--bg-elevated)' : 'var(--fifa-green)',
                          color: 'white',
                          opacity: isSaving ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isSaving ? '...' : isSaved ? '✓ Guardado' : isFinished ? 'Actualizar' : 'Guardar'}
                      </button>
                    </div>
                  </div>

                  {error && <p style={{ fontSize: '11px', color: 'var(--fifa-red)', marginTop: '8px' }}>{error}</p>}

                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                    {new Date(match.match_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {match.city}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: ELIMINATORIAS */}
        {activeTab === 'eliminatorias' && (
          <>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '4px' }}>
              {ELIM_PHASES.map(phase => (
                <button
                  key={phase.key}
                  onClick={() => setEliminatoriaPhase(phase.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    background: eliminatoriaPhase === phase.key ? 'var(--fifa-gold)' : 'var(--bg-surface)',
                    color: eliminatoriaPhase === phase.key ? 'var(--bg-deep)' : 'var(--text-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {phase.label}
                </button>
              ))}
            </div>

            <div style={{
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
            }}>
              <p style={{ fontSize: '12px', color: 'var(--fifa-gold)', margin: 0 }}>
                💡 Asigna los equipos clasificados a cada cruce. Los placeholders (1A, W73) son referencias del calendario oficial.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {eliminatoriaMatches.map(match => {
                const isSaving = savingAssign === match.id
                const error = assignErrors[match.id]

                return (
                  <div key={match.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px' }}>#{match.match_number}</span>

                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px', letterSpacing: '1px' }}>
                            LOCAL · <span style={{ color: 'var(--fifa-gold)' }}>{match.home_team_placeholder ?? '-'}</span>
                          </p>
                          <select
                            value={match.home_team?.code ? teams.find(t => t.code === match.home_team?.code)?.id ?? '' : ''}
                            onChange={e => handleAssignTeam(match.id, 'home', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isSaving}
                            style={{
                              width: '100%',
                              background: 'var(--bg-deep)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          >
                            <option value="">— Sin asignar —</option>
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                          </select>
                        </div>

                        <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '14px', marginTop: '20px' }}>VS</span>

                        <div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px', letterSpacing: '1px' }}>
                            VISITANTE · <span style={{ color: 'var(--fifa-gold)' }}>{match.away_team_placeholder ?? '-'}</span>
                          </p>
                          <select
                            value={match.away_team?.code ? teams.find(t => t.code === match.away_team?.code)?.id ?? '' : ''}
                            onChange={e => handleAssignTeam(match.id, 'away', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isSaving}
                            style={{
                              width: '100%',
                              background: 'var(--bg-deep)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          >
                            <option value="">— Sin asignar —</option>
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {error && <p style={{ fontSize: '11px', color: 'var(--fifa-red)', marginTop: '8px' }}>{error}</p>}

                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {new Date(match.match_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {match.city}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}