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
    // Paso 1 — Buscar noticias con Tavily (2 búsquedas)
    const [newsHome, newsAway] = await Promise.all([
      tavilyClient.search(`${homeTeam} Mundial 2026 lesiones forma reciente noticias`, {
        maxResults: 5,
        searchDepth: 'basic',
      }),
      tavilyClient.search(`${awayTeam} Mundial 2026 lesiones forma reciente noticias`, {
        maxResults: 5,
        searchDepth: 'basic',
      }),
    ])

    // Extraer snippets relevantes
    const contextHome = newsHome.results
      .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join('\n')

    const contextAway = newsAway.results
      .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join('\n')

    // Paso 2 — Claude analiza con el contexto (sin web_search)
    const prompt = `Eres un analista deportivo experto en fútbol. Analiza este partido del Mundial FIFA 2026 y genera un pronóstico.

PARTIDO: ${homeTeam} vs ${awayTeam}
FASE: ${match.phase}
FECHA: ${match.match_date}
SEDE: ${match.city}

NOTICIAS RECIENTES ${homeTeam}:
${contextHome}

NOTICIAS RECIENTES ${awayTeam}:
${contextAway}

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
  "analysis_text": "Análisis de 3-4 oraciones del partido incluyendo lesiones y factores clave"
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