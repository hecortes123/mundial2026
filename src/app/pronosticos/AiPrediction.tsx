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

  return (
    <div className="mt-3 border-t border-gray-800 pt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (prediction || hasExisting) {
              setOpen(!open)
            }
          }}
          disabled={loading || (!hasExisting && !isAdmin)}
          className={`flex items-center gap-2 text-xs transition-colors disabled:opacity-30 ${
            hasExisting || prediction
              ? 'text-purple-400 hover:text-purple-300 cursor-pointer'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <span>🤖</span>
          {loading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            Buscando noticias y analizando...
          </span>
        ) : prediction || hasExisting ? (
          open ? 'Ocultar análisis IA' : 'Ver análisis IA'
        ) : (
          'Análisis IA no disponible aún'
        )}
        </button>        
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}

      {prediction && open && (
        <div className="mt-3 bg-gray-800/50 rounded-lg p-4 space-y-4">

          {/* Probabilidades */}
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Probabilidades</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-lg font-bold text-green-400">{prediction.home_win_pct}%</p>
                <p className="text-xs text-gray-500 truncate">{homeTeam}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-lg font-bold text-yellow-400">{prediction.draw_pct}%</p>
                <p className="text-xs text-gray-500">Empate</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-lg font-bold text-blue-400">{prediction.away_win_pct}%</p>
                <p className="text-xs text-gray-500 truncate">{awayTeam}</p>
              </div>
            </div>
          </div>

          {/* Goles esperados */}
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Goles esperados</p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{prediction.home_expected_goals}</p>
                <p className="text-xs text-gray-500 truncate">{homeTeam}</p>
              </div>
              <span className="text-gray-600 font-bold">—</span>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{prediction.away_expected_goals}</p>
                <p className="text-xs text-gray-500 truncate">{awayTeam}</p>
              </div>
            </div>
          </div>

          {/* Forma reciente */}
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Forma reciente</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1 truncate">{homeTeam}</p>
                <div className="flex gap-1">
                  {prediction.recent_form.home.split('').map((r, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                        r === 'W' ? 'bg-green-600 text-white' :
                        r === 'D' ? 'bg-yellow-600 text-white' :
                        'bg-red-600 text-white'
                      }`}
                    >
                      {r === 'W' ? 'G' : r === 'D' ? 'E' : 'P'}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1 truncate">{awayTeam}</p>
                <div className="flex gap-1">
                  {prediction.recent_form.away.split('').map((r, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                        r === 'W' ? 'bg-green-600 text-white' :
                        r === 'D' ? 'bg-yellow-600 text-white' :
                        'bg-red-600 text-white'
                      }`}
                    >
                      {r === 'W' ? 'G' : r === 'D' ? 'E' : 'P'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Jugadores clave */}
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Jugadores clave</p>
            <div className="space-y-2">
              {prediction.key_players?.map((kp, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-purple-400 text-xs mt-0.5">⭐</span>
                  <div>
                    <span className="text-xs font-semibold text-white">{kp.player}</span>
                    <span className="text-xs text-gray-500 ml-1">({kp.team})</span>
                    <p className="text-xs text-gray-400">{kp.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Análisis */}
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Análisis</p>
            <p className="text-xs text-gray-300 leading-relaxed">{prediction.analysis_text}</p>
          </div>

          {prediction.generated_at && (
            <p className="text-xs text-gray-600 text-right">
              Actualizado: {new Date(prediction.generated_at).toLocaleString('es-CO')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}