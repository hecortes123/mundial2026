import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import CampeonClient from './CampeonClient'

export default async function CampeonPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_admin')
    .eq('id', user.id)
    .single()

  const { data: octavosRaw } = await supabase
    .from('matches')
    .select(`
      status, match_date,
      home_team:teams!matches_home_team_id_fkey(id, code, name),
      away_team:teams!matches_away_team_id_fkey(id, code, name)
    `)
    .eq('phase', 'octavos')

  const octavos = (octavosRaw ?? []) as any[]

  const teamsMap = new Map<number, { id: number; code: string; name: string }>()
  octavos.forEach(m => {
    if (m.home_team) teamsMap.set(m.home_team.id, m.home_team)
    if (m.away_team) teamsMap.set(m.away_team.id, m.away_team)
  })
  const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Abierto mientras NINGÚN partido de octavos haya iniciado
  const nowMs = Date.now()
  const isOpen = !octavos.some(m => new Date(m.match_date).getTime() <= nowMs)

  const { data: myPick } = await supabase
    .from('champion_predictions')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <Header username={profile?.username ?? ''} isAdmin={profile?.is_admin} />
      <CampeonClient teams={teams} isOpen={isOpen} initialPick={myPick?.team_id ?? null} />
    </div>
  )
}