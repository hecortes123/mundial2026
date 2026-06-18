import Anthropic from '@anthropic-ai/sdk'
import { tavily } from '@tavily/core'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY!,
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verificar que sea admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { matchId } = await request.json()

  if (!matchId) {
    return NextResponse.json({ error: 'matchId requerido' }, { status: 400 })
  }

  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(code, name),
      away_team:teams!matches_away_team_id_fkey(code, name)
    `)
    .eq('id', matchId)
    .single()

  if (!match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  }

  const homeTeam = match.home_team?.name ?? match.home_team_placeholder
  const awayTeam = match.away_team?.name ?? match.away_team_placeholder
  const homeCode = match.home_team?.code ?? ''
  const awayCode = match.away_team?.code ?? ''

  try {
    // Paso 1 — Resultados previos REALES en este Mundial (desde nuestra BD)
    let startHome = `${homeTeam}: aún no ha jugado en el Mundial.`
    let startAway = `${awayTeam}: aún no ha jugado en el Mundial.`

    if (match.home_team_id && match.away_team_id) {
      const { data: history } = await supabase
        .from('matches')
        .select(`
          home_team_id, away_team_id, home_score, away_score,
          home_team:teams!matches_home_team_id_fkey(name),
          away_team:teams!matches_away_team_id_fkey(name)
        `)
        .eq('status', 'finalizado')
        .or(
          `home_team_id.eq.${match.home_team_id},away_team_id.eq.${match.home_team_id},home_team_id.eq.${match.away_team_id},away_team_id.eq.${match.away_team_id}`
        )

      const describe = (teamId: number, teamName: string) => {
        const played = (history ?? []).filter(
          (m: any) => m.home_team_id === teamId || m.away_team_id === teamId
        )
        if (!played.length) return `${teamName}: aún no ha jugado en el Mundial.`
        const lines = played.map((m: any) => {
          const isHome = m.home_team_id === teamId
          const gf = isHome ? m.home_score : m.away_score
          const ga = isHome ? m.away_score : m.home_score
          const opp = isHome ? m.away_team?.name : m.home_team?.name
          const res = gf > ga ? 'Victoria' : gf < ga ? 'Derrota' : 'Empate'
          return `${res} ${gf}-${ga} vs ${opp}`
        })
        return `${teamName}: ${lines.join('; ')}`
      }

      startHome = describe(match.home_team_id, homeTeam)
      startAway = describe(match.away_team_id, awayTeam)
    }

    // Paso 2 — Buscar noticias con Tavily (forma, lesiones, sanciones)
    const [newsHome, newsAway] = await Promise.all([
      tavilyClient.search(
        `${homeTeam} selección Mundial 2026 resultado primer partido lesionados sancionados tarjeta roja`,
        { maxResults: 5, searchDepth: 'basic' }
      ),
      tavilyClient.search(
        `${awayTeam} selección Mundial 2026 resultado primer partido lesionados sancionados tarjeta roja`,
        { maxResults: 5, searchDepth: 'basic' }
      ),
    ])

    const contextHome = newsHome.results
      .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join('\n')

    const contextAway = newsAway.results
      .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join('\n')

    // Paso 3 — Claude analiza con todo el contexto (sin web_search)
    const prompt = `Eres un analista deportivo experto en fútbol. Analiza este partido del Mundial FIFA 2026 y genera un pronóstico.

PARTIDO: ${homeTeam} vs ${awayTeam}
FASE: ${match.phase}
FECHA: ${match.match_date}
SEDE: ${match.city}

DATOS CONFIRMADOS (obligatorio respetarlos):
- Las 48 selecciones, INCLUIDA IRÁN, están participando y disputan sus partidos con normalidad. NUNCA afirmes que un equipo se retiró, fue excluido o no participa, sin importar lo que digan las noticias.

CÓMO LLEGAN AL PARTIDO (resultados oficiales ya jugados en este Mundial):
${startHome}
${startAway}

NOTICIAS RECIENTES ${homeTeam}:
${contextHome}

NOTICIAS RECIENTES ${awayTeam}:
${contextAway}

Considera de forma prioritaria:
1. Cómo arrancó cada selección el Mundial (resultado de su primer partido indicado arriba): el rendimiento, el ánimo y la necesidad de puntos.
2. Bajas confirmadas por LESIÓN o por SANCIÓN (tarjeta roja o acumulación de amarillas). Si un jugador importante está ausente, menciónalo en el análisis y NO lo incluyas como jugador clave disponible para este partido.
3. La "recent_form" debe reflejar resultados reales recientes, incluyendo el primer partido del Mundial.

Responde ÚNICAMENTE con este JSON, sin texto antes ni después, sin markdown:
{
  "home_win_pct": número entre 0 y 100,
  "draw_pct": número entre 0 y 100,
  "away_win_pct": número entre 0 y 100,
  "home_expected_goals": número decimal,
  "away_expected_goals": número decimal,
  "key_players": [
    {"team": "${homeCode}", "player": "nombre", "reason": "por qué es clave"},
    {"team": "${awayCode}", "player": "nombre", "reason": "por qué es clave"}
  ],
  "recent_form": {
    "home": "WWDLL",
    "away": "WDWWL"
  },
  "analysis_text": "Análisis de 3-4 oraciones del partido, mencionando cómo arrancaron, lesiones/sanciones relevantes y factores clave"
}

Los tres porcentajes deben sumar exactamente 100.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Sin respuesta de IA' }, { status: 500 })
    }

    // Parsear JSON
    let prediction
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Formato de respuesta inválido' }, { status: 500 })
      }
      prediction = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Error al parsear respuesta IA' }, { status: 500 })
    }

    // Guardar en Supabase
    const { error: upsertError } = await supabase
      .from('ai_predictions')
      .upsert({
        match_id: matchId,
        home_win_pct: prediction.home_win_pct,
        draw_pct: prediction.draw_pct,
        away_win_pct: prediction.away_win_pct,
        home_expected_goals: prediction.home_expected_goals,
        away_expected_goals: prediction.away_expected_goals,
        key_players: prediction.key_players,
        recent_form: prediction.recent_form,
        analysis_text: prediction.analysis_text,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'match_id' })

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return NextResponse.json({ error: `Error guardando: ${upsertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, prediction })

  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}