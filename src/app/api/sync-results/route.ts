import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io'
const HEADERS = {
  'x-apisports-key': process.env.API_FOOTBALL_KEY!,
}

export async function GET(request: NextRequest) {
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

  // Buscar el Mundial 2026
  const res = await fetch(`${API_FOOTBALL_URL}/leagues?name=FIFA World Cup&season=2026`, {
    headers: HEADERS,
  })

  const data = await res.json()

  return NextResponse.json(data)
}