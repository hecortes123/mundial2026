import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PronosticosClient from './PronosticosClient'

export default async function PronosticosPage() {
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

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(code, name),
      away_team:teams!matches_away_team_id_fkey(code, name)
    `)
    .order('match_date', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)

  const { data: aiPredictions } = await supabase
    .from('ai_predictions')
    .select('*')

  const aiMap: Record<number, any> = {}
  aiPredictions?.forEach(p => { aiMap[p.match_id] = p })

  return (
    <PronosticosClient
      matches={matches ?? []}
      predictions={predictions ?? []}
      userId={user.id}
      isAdmin={profile?.is_admin ?? false}
      aiPredictions={aiMap}
      username={profile?.username ?? ''}
    />
  )
}