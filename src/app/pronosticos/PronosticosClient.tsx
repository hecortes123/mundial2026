'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import AiPrediction from './AiPrediction'
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header username={username} isAdmin={isAdmin} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-2">Mis pronósticos</h2>
        <p className="text-gray-400 text-sm mb-8">
          Ingresa el marcador que predices para cada partido. 3 pts por marcador exacto, 1 pt por resultado correcto.
        </p>

        {/* Tabs de fase */}
        <div className="flex gap-1 overflow-x-auto mb-6 pb-1">
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

        {activePhase === 'grupo' ? (
          groups.map(group => {
            const groupMatches = matches.filter(m => m.phase === 'grupo' && m.group_letter === group)
            if (!groupMatches.length) return null

          return (
            <div key={group} className="mb-8">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                Grupo {group}
              </h3>
              <div className="space-y-2">
                {groupMatches.map(match => {
                  const isPending = match.status === 'pendiente'
                  const hasPred = !!predMap[match.id]
                  const isSaving = saving === match.id
                  const isSaved = saved[match.id]

                  return (
                    <div
                      key={match.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-3">
                        {/* Equipo local */}
                        <div className="flex-1 text-right">
                          <p className="font-semibold text-sm">
                            {match.home_team?.name ?? match.home_team_placeholder}
                          </p>
                        </div>

                        {/* Marcador */}
                        <div className="flex items-center gap-2">
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
                            className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:outline-none focus:border-blue-500 disabled:opacity-40"
                          />
                          <span className="text-gray-600 font-bold">-</span>
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
                            className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:outline-none focus:border-blue-500 disabled:opacity-40"
                          />
                        </div>

                        {/* Equipo visitante */}
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {match.away_team?.name ?? match.away_team_placeholder}
                          </p>
                        </div>

                        {/* Botón guardar */}
                        {isPending ? (
                          <button
                            onClick={() => handleSave(match.id)}
                            disabled={isSaving}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              isSaved
                                ? 'bg-green-600 text-white'
                                : hasPred
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isSaving ? '...' : isSaved ? '✓ Guardado' : hasPred ? 'Actualizar' : 'Guardar'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600 italic">
                            {match.status === 'finalizado' ? '⏱ Finalizado' : '🔒 Cerrado'}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex justify-center">
                        <p className="text-xs text-gray-600">
                          {new Date(match.match_date).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} — {match.city}
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
                })}
              </div>
            </div>
          )
        })
        ) : (
          (() => {
            const phaseMatches = matches.filter(m => m.phase === activePhase && m.home_team && m.away_team)
            
            if (!phaseMatches.length) {
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                  <p className="text-gray-400">
                    Aún no hay equipos asignados a esta fase.
                  </p>
                  <p className="text-gray-600 text-sm mt-2">
                    Los pronósticos se habilitarán cuando termine la fase anterior.
                  </p>
                </div>
              )
            }

            return (
              <div className="space-y-2">
                {phaseMatches.map(match => {
                  const isPending = match.status === 'pendiente'
                  const hasPred = !!predMap[match.id]
                  const isSaving = saving === match.id
                  const isSaved = saved[match.id]

                  return (
                    <div
                      key={match.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-right">
                          <p className="font-semibold text-sm">
                            {match.home_team?.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
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
                            className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:outline-none focus:border-blue-500 disabled:opacity-40"
                          />
                          <span className="text-gray-600 font-bold">-</span>
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
                            className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:outline-none focus:border-blue-500 disabled:opacity-40"
                          />
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {match.away_team?.name}
                          </p>
                        </div>

                        {isPending ? (
                          <button
                            onClick={() => handleSave(match.id)}
                            disabled={isSaving}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              isSaved
                                ? 'bg-green-600 text-white'
                                : hasPred
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isSaving ? '...' : isSaved ? '✓ Guardado' : hasPred ? 'Actualizar' : 'Guardar'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600 italic">
                            {match.status === 'finalizado' ? '⏱ Finalizado' : '🔒 Cerrado'}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex justify-center">
                        <p className="text-xs text-gray-600">
                          {new Date(match.match_date).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} — {match.city}
                        </p>
                      </div>

                      <AiPrediction
                        matchId={match.id}
                        homeTeam={match.home_team?.name ?? ''}
                        awayTeam={match.away_team?.name ?? ''}
                        hasExisting={!!aiPredictions[match.id]}
                        existing={aiPredictions[match.id]}
                        isAdmin={isAdmin}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })()
        )}
      </main>
    </div>
  )
}