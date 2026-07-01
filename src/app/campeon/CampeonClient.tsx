'use client'

import { useState } from 'react'
import Flag from '@/components/Flag'

interface Team { id: number; code: string; name: string }

interface Props {
  teams: Team[]
  isOpen: boolean
  initialPick: number | null
}

export default function CampeonClient({ teams, isOpen, initialPick }: Props) {
  const [selected, setSelected] = useState<number | null>(initialPick)
  const [saved, setSaved] = useState<number | null>(initialPick)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/champion-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar')
      } else {
        setSaved(selected)
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const selectedTeam = teams.find(t => t.id === saved)

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        Pronóstico de campeón
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 20px' }}>
        Elige quién levantará la copa. Suma puntos extra al ranking según hasta dónde llegue tu equipo.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {[
          { label: 'Campeón', pts: '+30' },
          { label: 'Finalista', pts: '+15' },
          { label: 'Semifinalista', pts: '+8' },
          { label: 'Cuartos', pts: '+3' },
        ].map(x => (
          <div key={x.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px 12px' }}>
            <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '14px' }}>{x.pts}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginLeft: '6px' }}>{x.label}</span>
          </div>
        ))}
      </div>

      {!isOpen ? (
        <div style={{ background: 'rgba(204,34,41,0.1)', border: '1px solid rgba(204,34,41,0.3)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
          <p style={{ color: 'var(--fifa-red)', fontSize: '13px', margin: 0 }}>
            🔒 El plazo para elegir campeón ya cerró (inició la fase de octavos).
            {selectedTeam ? ` Tu elección: ${selectedTeam.name}.` : ' No registraste una elección.'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'rgba(0,168,89,0.08)', border: '1px solid rgba(0,168,89,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
          <p style={{ color: 'var(--fifa-green)', fontSize: '13px', margin: 0 }}>
            Puedes elegir o cambiar tu campeón hasta el inicio del primer partido de octavos.
            {selectedTeam ? ` Elección actual: ${selectedTeam.name}.` : ''}
          </p>
        </div>
      )}

      {teams.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', margin: 0 }}>Los equipos se habilitarán cuando se definan los cruces de octavos.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {teams.map(team => {
              const isSel = selected === team.id
              const isSavedPick = saved === team.id
              return (
                <button
                  key={team.id}
                  onClick={() => isOpen && setSelected(team.id)}
                  disabled={!isOpen}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: isSel ? 'rgba(212,175,55,0.12)' : 'var(--bg-surface)',
                    border: isSel ? '2px solid var(--fifa-gold)' : '1px solid var(--border-subtle)',
                    borderRadius: '10px', padding: '12px',
                    cursor: isOpen ? 'pointer' : 'default',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <Flag code={team.code} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {team.name}
                    </p>
                    {isSavedPick && <p style={{ fontSize: '10px', color: 'var(--fifa-gold)', margin: '2px 0 0' }}>★ Tu campeón</p>}
                  </div>
                </button>
              )
            })}
          </div>

          {isOpen && (
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleSave}
                disabled={!selected || saving || selected === saved}
                style={{
                  background: 'var(--fifa-green)', color: 'white', fontWeight: 600, fontSize: '14px',
                  padding: '12px 24px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', opacity: (!selected || saving || selected === saved) ? 0.5 : 1,
                }}
              >
                {saving ? 'Guardando...' : done ? '✓ Guardado' : (selected === saved && saved) ? 'Elección guardada' : 'Guardar elección'}
              </button>
              {error && <span style={{ color: 'var(--fifa-red)', fontSize: '12px' }}>{error}</span>}
            </div>
          )}
        </>
      )}
    </main>
  )
}