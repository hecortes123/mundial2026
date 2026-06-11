'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'

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
  { key: 'octavos', label: 'Octavos de Final' },
  { key: 'cuartos', label: 'Cuartos de Final' },
  { key: 'semifinal', label: 'Semifinales' },
  { key: 'tercer_puesto', label: 'Tercer Puesto' },
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
  const [eliminatoriaPhase, setEliminatoriaPhase] = useState('dieciseisavos')
  const [savingAssign, setSavingAssign] = useState<number | null>(null)
  const [assignErrors, setAssignErrors] = useState<Record<number, string>>({})

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

  // Estado para resultados
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

  const filteredMatches = matches.filter(m => m.phase === activePhase)
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  const groupMatches = activePhase === 'grupo'
    ? filteredMatches.filter(m => m.group_letter === activeGroup)
    : filteredMatches

  const pendingInView = groupMatches.filter(m => !generated[m.id])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header username={username} isAdmin={true} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{matches.length}</p>
            <p className="text-gray-400 text-sm">Total partidos</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{Object.keys(generated).length}</p>
            <p className="text-gray-400 text-sm">Pronósticos IA</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {matches.filter(m => m.status === 'finalizado').length}
            </p>
            <p className="text-gray-400 text-sm">Partidos finalizados</p>
          </div>
        </div>

        {/* Tabs principales */}
        <div className="flex gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-950'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {tab === 'pronósticos' ? '🤖 Pronósticos IA' : tab === 'resultados' ? '⚽ Resultados' : '🏆 Eliminatorias'}
            </button>
          ))}
        </div>

        {/* Tabs de fase */}
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {PHASES.map(phase => (
            <button
              key={phase.key}
              onClick={() => setActivePhase(phase.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activePhase === phase.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {phase.label}
            </button>
          ))}
        </div>

        {/* Tabs de grupo */}
        {activePhase === 'grupo' && (
          <div className="flex gap-1 mb-6">
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                  activeGroup === g
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* TAB: PRONÓSTICOS IA */}
        {activeTab === 'pronósticos' && (
          <>
            {pendingInView.length > 0 && (
              <div className="mb-4 flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">
                  <span className="text-white font-medium">{pendingInView.length}</span> pronósticos pendientes
                </p>
                <button
                  onClick={() => handleBatchGenerate(pendingInView.map(m => m.id))}
                  disabled={batchLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {batchLoading ? '⏳ Generando...' : '🤖 Generar todos'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {groupMatches.map(match => {
                const homeTeam = match.home_team?.name ?? match.home_team_placeholder
                const awayTeam = match.away_team?.name ?? match.away_team_placeholder
                const hasAi = !!generated[match.id]
                const isGenerating = generating[match.id]
                const error = errors[match.id]

                return (
                  <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-xs text-gray-600 w-6">#{match.match_number}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {homeTeam} <span className="text-gray-600">vs</span> {awayTeam}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(match.match_date).toLocaleDateString('es-CO', {
                            day: 'numeric', month: 'short'
                          })} — {match.city}
                        </p>
                        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasAi && (
                        <span className="text-xs text-green-400">
                          ✓ {new Date(generated[match.id]).toLocaleDateString('es-CO', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      )}
                      <button
                        onClick={() => handleGenerate(match.id)}
                        disabled={isGenerating || batchLoading}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          hasAi
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {isGenerating ? (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            Generando...
                          </span>
                        ) : hasAi ? '🔄 Actualizar' : '🤖 Generar'}
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
          <div className="space-y-2">
            {groupMatches.map(match => {
              const homeTeam = match.home_team?.name ?? match.home_team_placeholder
              const awayTeam = match.away_team?.name ?? match.away_team_placeholder
              const isSaving = savingResult === match.id
              const isSaved = savedResult[match.id]
              const error = resultErrors[match.id]
              const isFinished = match.status === 'finalizado'

              return (
                <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-xs text-gray-600 w-6">#{match.match_number}</span>
                      <div className="flex items-center gap-3 flex-1">
                        <p className="font-medium text-sm flex-1 text-right">{homeTeam}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={resultScores[match.id]?.home ?? ''}
                            onChange={e => setResultScores(prev => ({
                              ...prev,
                              [match.id]: { ...prev[match.id], home: e.target.value }
                            }))}
                            className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:outline-none focus:border-green-500"
                          />
                          <span className="text-gray-600 font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={resultScores[match.id]?.away ?? ''}
                            onChange={e => setResultScores(prev => ({
                              ...prev,
                              [match.id]: { ...prev[match.id], away: e.target.value }
                            }))}
                            className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:outline-none focus:border-green-500"
                          />
                        </div>
                        <p className="font-medium text-sm flex-1">{awayTeam}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      {isFinished && (
                        <span className="text-xs text-green-400">✓ Finalizado</span>
                      )}
                      <button
                        onClick={() => handleSaveResult(match.id)}
                        disabled={isSaving}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          isSaved
                            ? 'bg-green-600 text-white'
                            : isFinished
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {isSaving ? '...' : isSaved ? '✓ Guardado' : isFinished ? 'Actualizar' : 'Guardar resultado'}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

                  <p className="text-xs text-gray-600 mt-2">
                    {new Date(match.match_date).toLocaleDateString('es-CO', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })} — {match.city}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: ELIMINATORIAS */}
        {activeTab === 'eliminatorias' && (
          <>
            <div className="flex gap-1 mb-6 overflow-x-auto">
              {ELIM_PHASES.map(phase => (
                <button
                  key={phase.key}
                  onClick={() => setEliminatoriaPhase(phase.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    eliminatoriaPhase === phase.key
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  {phase.label}
                </button>
              ))}
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs text-yellow-300">
                💡 Asigna los equipos clasificados a cada cruce. Los placeholders (ej: 1A, W73) son referencias del calendario oficial.
              </p>
            </div>

            <div className="space-y-2">
              {eliminatoriaMatches.map(match => {
                const isSaving = savingAssign === match.id
                const error = assignErrors[match.id]

                return (
                  <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-600 w-8">#{match.match_number}</span>

                      <div className="flex items-center gap-3 flex-1">
                        {/* Local */}
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">
                            Local — placeholder: <span className="text-yellow-400">{match.home_team_placeholder ?? '-'}</span>
                          </p>
                          <select
                            value={match.home_team?.code ? teams.find(t => t.code === match.home_team?.code)?.id ?? '' : ''}
                            onChange={e => handleAssignTeam(match.id, 'home', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isSaving}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                          >
                            <option value="">— Sin asignar —</option>
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                          </select>
                        </div>

                        <span className="text-gray-600 font-bold mt-5">vs</span>

                        {/* Visitante */}
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">
                            Visitante — placeholder: <span className="text-yellow-400">{match.away_team_placeholder ?? '-'}</span>
                          </p>
                          <select
                            value={match.away_team?.code ? teams.find(t => t.code === match.away_team?.code)?.id ?? '' : ''}
                            onChange={e => handleAssignTeam(match.id, 'away', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isSaving}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                          >
                            <option value="">— Sin asignar —</option>
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

                    <p className="text-xs text-gray-600 mt-2">
                      {new Date(match.match_date).toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })} — {match.city}
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