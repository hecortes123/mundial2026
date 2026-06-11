import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'

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
          <div className="grid grid-cols-3 gap-3 mb-8" style={{ alignItems: 'end' }}>
            {/* Segundo */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              borderTop: '3px solid #C0C0C0',
            }}>
              <p style={{ fontSize: '22px', margin: '0 0 4px' }}>🥈</p>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)' }}>
                {ranking[1].username}
              </p>
              <p style={{ fontSize: '18px', color: '#C0C0C0', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {ranking[1].total_points} pts
              </p>
            </div>

            {/* Primero */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '20px 16px',
              textAlign: 'center',
              borderTop: '4px solid var(--fifa-gold)',
              transform: 'translateY(-12px)',
            }}>
              <p style={{ fontSize: '28px', margin: '0 0 4px' }}>🏆</p>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)' }}>
                {ranking[0].username}
              </p>
              <p style={{ fontSize: '22px', color: 'var(--fifa-gold)', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {ranking[0].total_points} pts
              </p>
            </div>

            {/* Tercero */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              borderTop: '3px solid #CD7F32',
            }}>
              <p style={{ fontSize: '22px', margin: '0 0 4px' }}>🥉</p>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)' }}>
                {ranking[2].username}
              </p>
              <p style={{ fontSize: '18px', color: '#CD7F32', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {ranking[2].total_points} pts
              </p>
            </div>
          </div>
        )}

        {/* Tabla completa */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="grid grid-cols-12 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="col-span-1 fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>#</div>
            <div className="col-span-5 fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Usuario</div>
            <div className="col-span-2 text-center fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Pts</div>
            <div className="col-span-2 text-center fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Exactos</div>
            <div className="col-span-2 text-center fifa-label" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Correctos</div>
          </div>

          {ranking?.map((entry, index) => {
            const isCurrentUser = entry.id === user.id
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

            return (
              <div
                key={entry.id}
                className="grid grid-cols-12 px-4 py-4 items-center"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isCurrentUser ? 'rgba(0, 168, 89, 0.06)' : 'transparent',
                  borderLeft: isCurrentUser ? '3px solid var(--fifa-green)' : '3px solid transparent',
                }}
              >
                <div className="col-span-1" style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '14px' }}>
                  {medal ?? index + 1}
                </div>
                <div className="col-span-5">
                  <p style={{ fontWeight: 600, fontSize: '14px', margin: 0, color: isCurrentUser ? 'var(--fifa-green)' : 'var(--text-primary)' }}>
                    {entry.username}
                    {isCurrentUser && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--fifa-green)', fontWeight: 400 }}>· Tú</span>
                    )}
                  </p>
                </div>
                <div className="col-span-2 text-center">
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {entry.total_points}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span style={{ color: 'var(--fifa-green)', fontWeight: 600, fontSize: '14px' }}>{entry.exact_scores}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span style={{ color: 'var(--fifa-gold)', fontWeight: 600, fontSize: '14px' }}>{entry.correct_results}</span>
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

        <div className="mt-6 flex gap-6" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <span><span style={{ color: 'var(--fifa-green)', fontWeight: 600 }}>Exactos</span> · Marcador exacto (3 pts)</span>
          <span><span style={{ color: 'var(--fifa-gold)', fontWeight: 600 }}>Correctos</span> · Resultado correcto (1 pt)</span>
        </div>
      </main>
    </div>
  )
}