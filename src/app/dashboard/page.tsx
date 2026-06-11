import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Flag from '@/components/Flag'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(code, name),
      away_team:teams!matches_away_team_id_fkey(code, name)
    `)
    .eq('phase', 'grupo')
    .eq('status', 'pendiente')
    .order('match_date', { ascending: true })
    .limit(5)

  const { data: predictions } = await supabase
    .from('predictions')
    .select('id')
    .eq('user_id', user.id)

  const { data: ranking } = await supabase
    .from('leaderboard')
    .select('rank')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={profile?.username ?? ''} isAdmin={profile?.is_admin} />

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Stats */}
        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid var(--fifa-green)' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--fifa-green)', margin: 0, letterSpacing: '-0.03em' }}>
              {profile?.total_points ?? 0}
            </p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Puntos</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid var(--fifa-gold)' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--fifa-gold)', margin: 0, letterSpacing: '-0.03em' }}>
              {predictions?.length ?? 0}
            </p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Pronósticos</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid var(--fifa-blue)' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
              {ranking?.rank ? `#${ranking.rank}` : '—'}
            </p>
            <p className="fifa-label" style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Posición</p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          <Link
            href="/pronosticos"
            style={{
              background: 'var(--fifa-green)',
              borderRadius: '12px',
              padding: '20px',
              textDecoration: 'none',
              color: 'white',
              transition: 'all 0.2s',
            }}
          >
            <p style={{ fontSize: '24px', margin: '0 0 8px' }}>🎯</p>
            <p style={{ fontWeight: 600, margin: 0, fontSize: '15px' }}>Hacer pronósticos</p>
            <p style={{ fontSize: '12px', margin: '4px 0 0', opacity: 0.85 }}>72 partidos de fase de grupos</p>
          </Link>
          <Link
            href="/ranking"
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '20px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
          >
            <p style={{ fontSize: '24px', margin: '0 0 8px' }}>🏆</p>
            <p style={{ fontWeight: 600, margin: 0, fontSize: '15px' }}>Ver ranking</p>
            <p style={{ fontSize: '12px', margin: '4px 0 0', color: 'var(--text-tertiary)' }}>¿En qué posición estás?</p>
          </Link>
        </div>

        {/* Próximos partidos */}
        <h2 className="fifa-label" style={{ color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '12px' }}>
          Próximos partidos
        </h2>
        <div className="space-y-2">
          {matches?.map(match => (
            <div
              key={match.id}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="match-grid">
                <div className="match-team-home">
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{match.home_team?.name ?? match.home_team_placeholder}</p>
                    <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '2px 0 0', fontSize: '10px' }}>{match.home_team?.code ?? ''}</p>
                  </div>
                  <Flag code={match.home_team?.code} size={28} />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--fifa-gold)', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.02em' }}>VS</span>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0', letterSpacing: '1px' }}>
                    GRUPO {match.group_letter}
                  </p>
                </div>

                <div className="match-team-away">
                  <Flag code={match.away_team?.code} size={28} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{match.away_team?.name ?? match.away_team_placeholder}</p>
                    <p className="fifa-label" style={{ color: 'var(--text-muted)', margin: '2px 0 0', fontSize: '10px' }}>{match.away_team?.code ?? ''}</p>
                  </div>
                </div>

                <div className="match-action" style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                    {new Date(match.match_date).toLocaleString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Bogota',
                    })}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {match.city}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}