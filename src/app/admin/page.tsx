import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(code, name),
      away_team:teams!matches_away_team_id_fkey(code, name)
    `)
    .order('match_number', { ascending: true })

  const { data: teams } = await supabase
    .from('teams')
    .select('id, code, name')
    .order('name')

  const { data: aiPredictions } = await supabase
    .from('ai_predictions')
    .select('match_id, generated_at')

  const aiMap: Record<number, string> = {}
  aiPredictions?.forEach(p => { aiMap[p.match_id] = p.generated_at })

  return (
    <AdminClient
      matches={matches ?? []}
      aiMap={aiMap}
      username={profile?.username ?? ''}
      teams={teams ?? []}
    />
  )
}