import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// football-data.org usa códigos casi idénticos a los nuestros (FIFA).
// Aquí van SOLO las diferencias conocidas (TLA de la API -> nuestro código).
const TLA_OVERRIDES: Record<string, string> = {
  URY: 'URU', // Uruguay (la API usa URY)
}

function mapTla(tla: string): string {
  return TLA_OVERRIDES[tla] ?? tla
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const apply = searchParams.get('apply') === 'true'
  const cronToken = searchParams.get('cronToken')
  const isCron = cronToken === process.env.CRON_SECRET

  const supabase = await createClient()

  if (!isCron) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  // 1. Traer TODOS los partidos de football-data.org
  let apiData: any = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchWithTimeout(
        'https://api.football-data.org/v4/competitions/WC/matches',
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! }, cache: 'no-store' },
        15000
      )
      if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * attempt)); continue }
      if (!res.ok) {
        if (attempt === 3) return NextResponse.json({ error: `football-data.org respondió ${res.status}` }, { status: 502 })
        await new Promise(r => setTimeout(r, 1000 * attempt)); continue
      }
      apiData = await res.json()
      break
    } catch (e: any) {
      if (attempt === 3) return NextResponse.json({ error: 'Timeout con football-data.org', details: e.message }, { status: 502 })
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  if (!apiData?.matches) return NextResponse.json({ error: 'Sin datos de la API' }, { status: 502 })

  // 2. Traer nuestros partidos
  const { data: ourMatches } = await supabase
    .from('matches')
    .select(`id, match_number, phase, match_date, home_team_placeholder, away_team_placeholder,
      home_team:teams!matches_home_team_id_fkey(code, name),
      away_team:teams!matches_away_team_id_fkey(code, name)`)
    .order('match_number', { ascending: true })

  if (!ourMatches) return NextResponse.json({ error: 'Sin partidos en BD' }, { status: 500 })

  const changes: any[] = []
  const unmatched: any[] = []

  // 3. FASE DE GRUPOS: emparejar por par de equipos (robusto)
  const apiGroup = apiData.matches.filter((m: any) => m.stage === 'GROUP_STAGE')
  const ourGroup = ourMatches.filter((m: any) => m.phase === 'grupo')

  for (const am of apiGroup) {
    const homeFifa = mapTla(am.homeTeam?.tla ?? '')
    const awayFifa = mapTla(am.awayTeam?.tla ?? '')
    if (!homeFifa || !awayFifa) {
      unmatched.push({ api: `${am.homeTeam?.tla} vs ${am.awayTeam?.tla}`, reason: 'TLA vacío' })
      continue
    }
    const match = ourGroup.find((m: any) => {
      const h = m.home_team?.code, a = m.away_team?.code
      return (h === homeFifa && a === awayFifa) || (h === awayFifa && a === homeFifa)
    })
    if (!match) {
      unmatched.push({ api: `${homeFifa} vs ${awayFifa}`, date: am.utcDate, reason: 'sin coincidencia en BD' })
      continue
    }
    const current = new Date(match.match_date).toISOString()
    const incoming = new Date(am.utcDate).toISOString()
    if (current !== incoming) {
      changes.push({
        id: match.id,
        matchNumber: match.match_number,
        teams: `${match.home_team?.name} vs ${match.away_team?.name}`,
        from: current,
        to: incoming,
      })
    }
  }

  // 4. ELIMINATORIAS: emparejar por orden cronológico (equipos aún sin asignar)
  const apiKnockout = apiData.matches
    .filter((m: any) => m.stage !== 'GROUP_STAGE')
    .sort((a: any, b: any) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
  const ourKnockout = ourMatches
    .filter((m: any) => m.phase !== 'grupo')
    .sort((a: any, b: any) => a.match_number - b.match_number)

  const n = Math.min(ourKnockout.length, apiKnockout.length)
  for (let i = 0; i < n; i++) {
    const match = ourKnockout[i]
    const am = apiKnockout[i]
    const current = new Date(match.match_date).toISOString()
    const incoming = new Date(am.utcDate).toISOString()
    if (current !== incoming) {
      changes.push({
        id: match.id,
        matchNumber: match.match_number,
        teams: `${match.home_team?.name ?? match.home_team_placeholder} vs ${match.away_team?.name ?? match.away_team_placeholder} (${match.phase})`,
        from: current,
        to: incoming,
      })
    }
  }

  // 5. Aplicar solo si ?apply=true
  let applied = 0
  if (apply) {
    for (const c of changes) {
      const { error } = await supabase.from('matches').update({ match_date: c.to }).eq('id', c.id)
      if (!error) applied++
    }
  }

  return NextResponse.json({
    mode: apply ? 'APLICADO' : 'PREVIEW (no se modificó nada)',
    totalChanges: changes.length,
    applied,
    changes,
    unmatched,
  })
}