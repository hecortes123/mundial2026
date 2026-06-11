import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { matchId, homeTeamId, awayTeamId } = await request.json()

  if (!matchId) {
    return NextResponse.json({ error: 'matchId requerido' }, { status: 400 })
  }

  const updates: any = {}
  if (homeTeamId !== undefined) updates.home_team_id = homeTeamId
  if (awayTeamId !== undefined) updates.away_team_id = awayTeamId

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
  }

  const { error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}