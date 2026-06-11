import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'

export default async function RankingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <Header username={profile?.username ?? ''} isAdmin={profile?.is_admin} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-2">Ranking</h2>
        <p className="text-gray-400 text-sm mb-8">
          Actualizado en tiempo real según los resultados oficiales.
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Tabla header */}
          <div className="grid grid-cols-12 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Usuario</div>
            <div className="col-span-2 text-center">Pts</div>
            <div className="col-span-2 text-center">Exactos</div>
            <div className="col-span-2 text-center">Correctos</div>
          </div>

          {/* Filas */}
          {ranking?.map((entry, index) => {
            const isCurrentUser = entry.id === user.id
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

            return (
              <div
                key={entry.id}
                className={`grid grid-cols-12 px-4 py-4 border-b border-gray-800 last:border-0 items-center ${
                  isCurrentUser ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="col-span-1 text-gray-400 font-bold">
                  {medal ?? index + 1}
                </div>
                <div className="col-span-5">
                  <p className={`font-semibold ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                    {entry.username}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-blue-500 font-normal">Tú</span>
                    )}
                  </p>
                  {entry.display_name !== entry.username && (
                    <p className="text-xs text-gray-500">{entry.display_name}</p>
                  )}
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-lg font-bold text-white">{entry.total_points}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-green-400 font-semibold">{entry.exact_scores}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-yellow-400 font-semibold">{entry.correct_results}</span>
                </div>
              </div>
            )
          })}

          {(!ranking || ranking.length === 0) && (
            <div className="px-4 py-12 text-center text-gray-500">
              Aún no hay participantes registrados
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="mt-6 flex gap-6 text-xs text-gray-500">
          <span><span className="text-green-400 font-bold">Exactos</span> — Marcador exacto (3 pts)</span>
          <span><span className="text-yellow-400 font-bold">Correctos</span> — Resultado correcto (1 pt)</span>
        </div>
      </main>
    </div>
  )
}