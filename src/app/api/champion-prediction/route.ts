import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { teamId } = await request.json()
  if (!teamId) {
    return NextResponse.json({ error: 'teamId requerido' }, { status: 400 })
  }

  // Deadline: se cierra en cuanto el PRIMER partido de octavos ya inició
  const { data: startedOctavos } = await supabase
    .from('matches')
    .select('id')
    .eq('phase', 'octavos')
    .lte('match_date', new Date().toISOString())
    .limit(1)

  if (startedOctavos && startedOctavos.length > 0) {
    return NextResponse.json(
      { error: 'El plazo para elegir campeón ya cerró (inició la fase de octavos).' },
      { status: 403 }
    )
  }

  // El equipo debe estar clasificado a octavos
  const { data: octavosMatches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('phase', 'octavos')

  const qualifiedIds = new Set<number>()
  octavosMatches?.forEach(m => {
    if (m.home_team_id) qualifiedIds.add(m.home_team_id)
    if (m.away_team_id) qualifiedIds.add(m.away_team_id)
  })

  if (!qualifiedIds.has(teamId)) {
    return NextResponse.json(
      { error: 'Ese equipo no está clasificado a la siguiente ronda.' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('champion_predictions')
    .upsert({
      user_id: user.id,
      team_id: teamId,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}