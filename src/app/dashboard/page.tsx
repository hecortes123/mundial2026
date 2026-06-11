import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'

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
    <div className="min-h-screen bg-gray-950 text-white">
      <Header username={profile?.username ?? ''} isAdmin={profile?.is_admin} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{profile?.total_points ?? 0}</p>
            <p className="text-gray-400 text-sm mt-1">Puntos</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{predictions?.length ?? 0}</p>
            <p className="text-gray-400 text-sm mt-1">Pronósticos</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">
              {ranking?.rank ? `#${ranking.rank}` : '—'}
            </p>
            <p className="text-gray-400 text-sm mt-1">Posición</p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link
            href="/pronosticos"
            className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl p-6 text-center"
          >
            <p className="text-2xl mb-2">🎯</p>
            <p className="font-bold">Hacer pronósticos</p>
            <p className="text-blue-200 text-sm mt-1">72 partidos de fase de grupos</p>
          </Link>
          <Link
            href="/ranking"
            className="bg-gray-900 hover:bg-gray-800 border border-gray-800 transition-colors rounded-xl p-6 text-center"
          >
            <p className="text-2xl mb-2">🏆</p>
            <p className="font-bold">Ver ranking</p>
            <p className="text-gray-400 text-sm mt-1">¿En qué posición estás?</p>
          </Link>
        </div>

        {/* Próximos partidos */}
        <h2 className="text-lg font-semibold mb-4">Próximos partidos</h2>
        <div className="space-y-3">
          {matches?.map(match => (
            <div
              key={match.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="text-right flex-1">
                  <p className="font-semibold">{match.home_team?.name ?? match.home_team_placeholder}</p>
                  <p className="text-xs text-gray-500">Local</p>
                </div>
                <div className="text-center px-3">
                  <span className="text-gray-500 font-bold">VS</span>
                  <p className="text-xs text-gray-600 mt-1">Grupo {match.group_letter}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{match.away_team?.name ?? match.away_team_placeholder}</p>
                  <p className="text-xs text-gray-500">Visitante</p>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-xs text-gray-500">
                  {new Date(match.match_date).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
                <p className="text-xs text-gray-600">{match.city}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}