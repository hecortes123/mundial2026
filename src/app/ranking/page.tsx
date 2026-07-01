import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import Flag from '@/components/Flag'

export default async function RankingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_admin')
    .eq('id', user.id)
    .single()

  const { data: ranking } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false })

  // Elección de campeón de cada usuario
  const { data: champions } = await supabase
    .from('champion_predictions')
    .select(`
      user_id,
      team:teams(code, name)
    `)

  const championMap: Record<string, { code: string; name: string }> = {}
  ;(champions ?? []).forEach((c: any) => {
    if (c.team) championMap[c.user_id] = c.team
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={profile?.username ?? ''} isAdmin={profile?.is_admin} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Ranking
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 24px' }}>
          Actualizado en tiempo real según los resultados oficiales
        </p>

        {/* Podio top 3 */}
        {ranking && ranking.length >= 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '32px' }}>
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '16px 8px',
              textAlign: 'center',
              borderTop: '3px solid #C0C0C0',
            }}>
              <p style={{ fontSize: '20px', margin: '0 0 4px' }}>🥈</p>
              <p style={{ fontSize: '12px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {ranking[1].username}
              </p>
              <p style={{ fontSize: '16px', color: '#C0C0C0', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {ranking[1].total_points} pts
              </p>
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '20px 8px',
              textAlign: 'center',
              borderTop: '4px solid var(--fifa-gold)',
              transform: 'translateY(-12px)',
            }}>
              <p style={{ fontSize: '26px', margin: '0 0 4px' }}>🏆</p>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {ranking[0].username}
              </p>
              <p style={{ fontSize: '20px', color: 'var(--fifa-gold)', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {ranking[0].total_points} pts
              </p>
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '16px 8px',
              textAlign: 'center',
              borderTop: '3px solid #CD7F32',
            }}>
              <p style={{ fontSize: '20px', margin: '0 0 4px' }}>🥉</p>
              <p style={{ fontSize: '12px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {ranking[2].username}
              </p>
              <p style={{ fontSize: '16px', color: '#CD7F32', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {ranking[2].total_points} pts
              </p>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 60px 60px 60px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '8px',
          }}>
            <div className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>#</div>
            <div className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Usuario</div>
            <div className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center' }}>Pts</div>
            <div className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center' }}>Exactos</div>
            <div className="fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center' }}>Aciertos</div>
          </div>

          {ranking?.map((entry, index) => {
            const isCurrentUser = entry.id === user.id
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

            return (
              <div
                key={entry.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 60px 60px 60px',
                  padding: '14px 16px',
                  gap: '8px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isCurrentUser ? 'rgba(0, 168, 89, 0.06)' : 'transparent',
                  borderLeft: isCurrentUser ? '3px solid var(--fifa-green)' : '3px solid transparent',
                }}
              >
                <div style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '14px' }}>
                  {medal ?? index + 1}
                </div>
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {championMap[entry.id] && (
                    <span title={`Campeón: ${championMap[entry.id].name}`} style={{ flexShrink: 0, display: 'inline-flex' }}>
                      <Flag code={championMap[entry.id].code} size={16} />
                    </span>
                  )}
                  <p style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    margin: 0,
                    color: isCurrentUser ? 'var(--fifa-green)' : 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.username}
                    {isCurrentUser && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--fifa-green)', fontWeight: 400 }}>· Tú</span>}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {entry.total_points}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--fifa-green)', fontWeight: 600, fontSize: '13px' }}>{entry.exact_scores}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--fifa-gold)', fontWeight: 600, fontSize: '13px' }}>{entry.correct_results}</span>
                </div>
              </div>
            )
          })}

          {(!ranking || ranking.length === 0) && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aún no hay participantes registrados
            </div>
          )}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '20px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--fifa-green)', fontWeight: 600 }}>Exactos</span> · Marcador exacto (3 pts)</span>
          <span><span style={{ color: 'var(--fifa-gold)', fontWeight: 600 }}>Aciertos</span> · Resultado correcto (1 pt)</span>
        </div>
      </main>
    </div>
  )
}