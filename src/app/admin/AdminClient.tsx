'use client'

import { useState, useEffect } from 'react'
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

interface Suggestion {
  matchId: number
  matchNumber: number
  homeTeam: Team
  awayTeam: Team
  homeScore: number
  awayScore: number
  status: string
}

interface Props {
  matches: Match[]
  aiMap: Record<number, string>
  username: string
  teams: { id: number; code: string; name: string }[]
}

const PHASES = [
  { key: 'grupo', label: 'Grupos' },
  { key: 'dieciseisavos', label: '16vos' },
  { key: 'octavos', label: 'Octavos' },
  { key: 'cuartos', label: 'Cuartos' },
  { key: 'semifinal', label: 'Semis' },
  { key: 'tercer_puesto', label: '3er puesto' },
  { key: 'final', label: 'Final' },
]

const TABS = ['pronósticos', 'resultados', 'sincronizar', 'eliminatorias'] as const
type Tab = typeof TABS[number]

const formatDate = (date: string) =>
  new Date(date).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })

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

  // Estados para sync
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSync, setLoadingSync] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [acceptingSuggestion, setAcceptingSuggestion] = useState<number | null>(null)
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<Record<number, boolean>>({})

  const fetchSuggestions = async () => {
    setLoadingSync(true)
    setSyncError('')
    try {
      const res = await fetch('/api/sync-football')
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error ?? 'Error al consultar')
      } else {
        setSuggestions(data.suggestions ?? [])
      }
    } catch {
      setSyncError('Error de conexión')
    } finally {
      setLoadingSync(false)
    }
  }

  // Cargar sugerencias al abrir el tab
  useEffect(() => {
    if (activeTab === 'sincronizar') {
      fetchSuggestions()
    }
  }, [activeTab])

  const handleAcceptSuggestion = async (s: Suggestion) => {
    setAcceptingSuggestion(s.matchId)
    try {
      const res = await fetch('/api/update-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: s.matchId,
          homeScore: s.homeScore,
          awayScore: s.awayScore,
        }),
      })
      if (res.ok) {
        setAcceptedSuggestion(prev => ({ ...prev, [s.matchId]: true }))
        setTimeout(() => fetchSuggestions(), 1500)
      }
    } finally {
      setAcceptingSuggestion(null)
    }
  }

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
      if (!res.ok) setErrors(prev => ({ ...prev, [matchId]: data.error }))
      else setGenerated(prev => ({ ...prev, [matchId]: new Date().toISOString() }))
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
      if (!res.ok) setResultErrors(prev => ({ ...prev, [matchId]: data.error }))
      else {
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
      if (!res.ok) setAssignErrors(prev => ({ ...prev, [matchId]: data.error }))
      else window.location.reload()
    } catch {
      setAssignErrors(prev => ({ ...prev, [matchId]: 'Error de conexión' }))
    } finally {
      setSavingAssign(null)
    }
  }

  const ELIM_PHASES = PHASES.filter(p => p.key !== 'grupo')
  const eliminatoriaMatches = matches.filter(m => m.phase === eliminatoriaPhase)
  const filteredMatches = matches.filter(m => m.phase === activePhase)
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const groupMatches = activePhase === 'grupo'
    ? filteredMatches.filter(m => m.group_letter === activeGroup)
    : filteredMatches
  const pendingInView = groupMatches.filter(m => !generated[m.id])

  const tabLabel = (tab: Tab) => {
    if (tab === 'pronósticos') return '🤖 IA'
    if (tab === 'resultados') return '⚽ Resultados'
    if (tab === 'sincronizar') return '🔄 Sincronizar'
    return '🏆 Llaves'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={username} isAdmin={true} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Panel de Administración
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 20px' }}>
          Pronósticos IA, resultados, sincronización y eliminatorias
        </p>

        {/* Stats */}
        <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '12px', borderLeft: '3px solid var(--text-primary)' }}>
            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>{matches.length}</p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '2px 0 0', fontSize: '9px' }}>Partidos</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '12px', borderLeft: '3px solid var(--fifa-green)' }}>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--fifa-green)', margin: 0, letterSpacing: '-0.03em' }}>{Object.keys(generated).length}</p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '2px 0 0', fontSize: '9px' }}>IA</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '12px', borderLeft: '3px solid var(--fifa-gold)' }}>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--fifa-gold)', margin: 0, letterSpacing: '-0.03em' }}>{matches.filter(m => m.status === 'finalizado').length}</p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '2px 0 0', fontSize: '9px' }}>Finalizados</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: activeTab === tab ? 'var(--text-primary)' : 'var(--bg-surface)',
                color: activeTab === tab ? 'var(--bg-deep)' : 'var(--text-tertiary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Tabs de fase (solo para algunos tabs) */}
        {(activeTab === 'pronósticos' || activeTab === 'resultados') && (
          <>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
              {PHASES.map(phase => (
                <button
                  key={phase.key}
                  onClick={() => setActivePhase(phase.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    background: activePhase === phase.key ? 'var(--fifa-blue)' : 'var(--bg-surface)',
                    color: activePhase === phase.key ? 'white' : 'var(--text-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {phase.label}
                </button>
              ))}
            </div>

            {activePhase === 'grupo' && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => setActiveGroup(g)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      fontSize: '12px',
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
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '12px',
                flexWrap: 'wrap',
              }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pendingInView.length}</span> pendientes
                </p>
                <button
                  onClick={() => handleBatchGenerate(pendingInView.map(m => m.id))}
                  disabled={batchLoading}
                  style={{
                    background: 'var(--fifa-blue)',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
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

                return (
                  <div key={match.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{match.match_number}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <Flag code={match.home_team?.code} size={20} />
                        <p style={{ fontWeight: 600, fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {match.home_team?.name ?? match.home_team_placeholder}
                        </p>
                      </div>
                      <span style={{ color: 'var(--fifa-gold)', fontSize: '11px', fontWeight: 700 }}>VS</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {match.away_team?.name ?? match.away_team_placeholder}
                        </p>
                        <Flag code={match.away_team?.code} size={20} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
                          {formatDate(match.match_date)} · {match.city}
                        </p>
                        {hasAi && (
                          <span style={{ fontSize: '10px', color: 'var(--fifa-green)' }}>✓ Generado</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleGenerate(match.id)}
                        disabled={isGenerating || batchLoading}
                        style={{
                          fontSize: '11px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: hasAi ? 'var(--bg-elevated)' : 'var(--fifa-blue)',
                          color: 'white',
                          opacity: (isGenerating || batchLoading) ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isGenerating ? '...' : hasAi ? '🔄' : '🤖 Generar'}
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
                <div key={match.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{match.match_number}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      <Flag code={match.home_team?.code} size={20} />
                      <p style={{ fontWeight: 600, fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {match.home_team?.name ?? match.home_team_placeholder}
                      </p>
                    </div>
                    <span style={{ color: 'var(--fifa-gold)', fontSize: '11px', fontWeight: 700 }}>VS</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {match.away_team?.name ?? match.away_team_placeholder}
                      </p>
                      <Flag code={match.away_team?.code} size={20} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={resultScores[match.id]?.home ?? ''}
                      onChange={e => setResultScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], home: e.target.value } }))}
                      className="match-score-input"
                      style={{ width: '50px', height: '36px' }}
                    />
                    <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '16px' }}>-</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={resultScores[match.id]?.away ?? ''}
                      onChange={e => setResultScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], away: e.target.value } }))}
                      className="match-score-input"
                      style={{ width: '50px', height: '36px' }}
                    />
                    <button
                      onClick={() => handleSaveResult(match.id)}
                      disabled={isSaving}
                      style={{
                        fontSize: '11px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: isSaved ? 'var(--fifa-green)' : isFinished ? 'var(--bg-elevated)' : 'var(--fifa-green)',
                        color: 'white',
                        opacity: isSaving ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                        marginLeft: '8px',
                      }}
                    >
                      {isSaving ? '...' : isSaved ? '✓' : isFinished ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>

                  {error && <p style={{ fontSize: '11px', color: 'var(--fifa-red)', margin: '0 0 6px', textAlign: 'center' }}>{error}</p>}

                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                    {formatDate(match.match_date)} · {match.city}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: SINCRONIZAR */}
        {activeTab === 'sincronizar' && (
          <>
            <div style={{
              background: 'rgba(50, 98, 149, 0.08)',
              border: '1px solid rgba(50, 98, 149, 0.2)',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <p style={{ fontSize: '12px', color: 'var(--fifa-blue)', margin: 0 }}>
                💡 Resultados finalizados según football-data.org pendientes en tu BD
              </p>
              <button
                onClick={fetchSuggestions}
                disabled={loadingSync}
                style={{
                  background: 'var(--fifa-blue)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: loadingSync ? 0.5 : 1,
                }}
              >
                {loadingSync ? '⏳' : '🔄'} Refrescar
              </button>
            </div>

            {syncError && (
              <p style={{ fontSize: '12px', color: 'var(--fifa-red)', marginBottom: '12px' }}>{syncError}</p>
            )}

            {loadingSync ? (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>Consultando football-data.org...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '32px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: '0 0 6px' }}>
                  ✓ Todo sincronizado
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                  No hay partidos pendientes con resultado disponible
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestions.map(s => {
                  const isAccepting = acceptingSuggestion === s.matchId
                  const isAccepted = acceptedSuggestion[s.matchId]

                  return (
                    <div key={s.matchId} style={{
                      background: isAccepted ? 'rgba(0, 168, 89, 0.08)' : 'var(--bg-surface)',
                      border: `1px solid ${isAccepted ? 'rgba(0, 168, 89, 0.3)' : 'var(--border-subtle)'}`,
                      borderRadius: '10px',
                      padding: '12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{s.matchNumber}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                          <Flag code={s.homeTeam.code} size={20} />
                          <p style={{ fontWeight: 600, fontSize: '12px', margin: 0 }}>{s.homeTeam.name}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-deep)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.homeScore}</span>
                          <span style={{ color: 'var(--fifa-gold)', fontSize: '12px' }}>-</span>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.awayScore}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '12px', margin: 0 }}>{s.awayTeam.name}</p>
                          <Flag code={s.awayTeam.code} size={20} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAcceptSuggestion(s)}
                          disabled={isAccepting || isAccepted}
                          style={{
                            fontSize: '12px',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            background: isAccepted ? 'var(--fifa-green)' : 'var(--fifa-green)',
                            color: 'white',
                            opacity: isAccepting ? 0.5 : 1,
                          }}
                        >
                          {isAccepting ? '...' : isAccepted ? '✓ Aplicado' : '✓ Aceptar resultado'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* TAB: ELIMINATORIAS */}
        {activeTab === 'eliminatorias' && (
          <>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
              {ELIM_PHASES.map(phase => (
                <button
                  key={phase.key}
                  onClick={() => setEliminatoriaPhase(phase.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
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
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '14px',
            }}>
              <p style={{ fontSize: '11px', color: 'var(--fifa-gold)', margin: 0 }}>
                💡 Asigna los equipos clasificados. Placeholders como 1A, W73 son del calendario oficial.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {eliminatoriaMatches.map(match => {
                const isSaving = savingAssign === match.id
                const error = assignErrors[match.id]

                return (
                  <div key={match.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{match.match_number}</span>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                        {formatDate(match.match_date)} · {match.city}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                            padding: '8px 10px',
                            fontSize: '12px',
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
                            padding: '8px 10px',
                            fontSize: '12px',
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

                    {error && <p style={{ fontSize: '11px', color: 'var(--fifa-red)', marginTop: '8px' }}>{error}</p>}
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