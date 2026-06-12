import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import Flag from '@/components/Flag'

export default async function GruposPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_admin')
    .eq('id', user.id)
    .single()

  const { data: standings } = await supabase
    .from('group_standings')
    .select('*')

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={profile?.username ?? ''} isAdmin={profile?.is_admin} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Tabla de posiciones
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 24px' }}>
          Actualizada en tiempo real con resultados oficiales
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {groups.map(group => {
            const groupTeams = (standings ?? [])
              .filter((s: any) => s.group_letter === group)
              .sort((a: any, b: any) => 
                b.points - a.points 
                || b.goal_difference - a.goal_difference 
                || b.goals_for - a.goals_for
              )

            if (groupTeams.length === 0) return null

            return (
              <div
                key={group}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <h3 className="fifa-label" style={{ color: 'var(--fifa-gold)', margin: '0 0 12px', fontSize: '12px' }}>
                  Grupo {group}
                </h3>

                {/* Header tabla */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 28px 1fr 24px 24px 24px 24px 36px',
                  gap: '6px',
                  padding: '6px 4px',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                }}>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center' }}>#</span>
                  <span></span>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>Equipo</span>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center' }}>PJ</span>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center' }}>G</span>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center' }}>E</span>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center' }}>P</span>
                  <span className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center' }}>Pts</span>
                </div>

                {/* Filas equipos */}
                {groupTeams.map((team: any, idx: number) => {
                  const qualifiesDirect = idx < 2
                  const qualifiesAsThird = idx === 2

                  return (
                    <div
                      key={team.team_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 28px 1fr 24px 24px 24px 24px 36px',
                        gap: '6px',
                        padding: '8px 4px',
                        borderBottom: idx < groupTeams.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        alignItems: 'center',
                        borderLeft: qualifiesDirect 
                          ? '3px solid var(--fifa-green)'
                          : qualifiesAsThird
                          ? '3px solid var(--fifa-gold)'
                          : '3px solid transparent',
                        paddingLeft: '4px',
                        marginLeft: '-4px',
                      }}
                    >
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>
                        {idx + 1}
                      </span>
                      <Flag code={team.code} size={18} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {team.name}
                        </p>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>{team.played}</span>
                      <span style={{ fontSize: '11px', color: 'var(--fifa-green)', textAlign: 'center', fontWeight: 600 }}>{team.won}</span>
                      <span style={{ fontSize: '11px', color: 'var(--fifa-gold)', textAlign: 'center', fontWeight: 600 }}>{team.drawn}</span>
                      <span style={{ fontSize: '11px', color: 'var(--fifa-red)', textAlign: 'center', fontWeight: 600 }}>{team.lost}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        {team.points}
                      </span>
                    </div>
                  )
                })}

                {/* Leyenda diferencia de gol */}
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {groupTeams.map((team: any) => (
                    <span key={team.team_id}>
                      {team.code}: {team.goals_for > 0 || team.goals_against > 0 ? `${team.goal_difference >= 0 ? '+' : ''}${team.goal_difference}` : '0'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Leyenda */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '20px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--fifa-green)', borderRadius: '2px', marginRight: '6px', verticalAlign: 'middle' }} />
            Clasifica directo (1° y 2°)
          </span>
          <span>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--fifa-gold)', borderRadius: '2px', marginRight: '6px', verticalAlign: 'middle' }} />
            Mejor tercero (8 cupos disponibles)
          </span>
        </div>
      </main>
    </div>
  )
}