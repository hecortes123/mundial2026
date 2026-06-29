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
    // Paso 1 — Rendimiento REAL en el torneo (desde nuestra BD)
    const { data: standings } = await supabase.from('group_standings').select('*')

    let history: any[] = []
    if (match.home_team_id && match.away_team_id) {
      const { data: h } = await supabase
        .from('matches')
        .select(`
          home_team_id, away_team_id, home_score, away_score, match_date,
          home_team:teams!matches_home_team_id_fkey(name),
          away_team:teams!matches_away_team_id_fkey(name)
        `)
        .eq('status', 'finalizado')
        .or(
          `home_team_id.eq.${match.home_team_id},away_team_id.eq.${match.home_team_id},home_team_id.eq.${match.away_team_id},away_team_id.eq.${match.away_team_id}`
        )
      history = h ?? []
    }

    const matchResults = (teamId: number) =>
      history
        .filter((m: any) => m.home_team_id === teamId || m.away_team_id === teamId)
        .sort((a: any, b: any) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
        .map((m: any) => {
          const isHome = m.home_team_id === teamId
          const gf = isHome ? m.home_score : m.away_score
          const ga = isHome ? m.away_score : m.home_score
          const opp = isHome ? m.away_team?.name : m.home_team?.name
          const r = gf > ga ? 'victoria' : gf < ga ? 'derrota' : 'empate'
          return `${r} ${gf}-${ga} vs ${opp}`
        })

    const describeCampaign = (teamId: number | null, teamName: string) => {
      if (!teamId) return `${teamName}: equipo aún por definir.`
      const results = matchResults(teamId)
      const s = (standings ?? []).find((x: any) => x.team_id === teamId)
      if (!s) {
        return results.length
          ? `${teamName}: ${results.join('; ')}.`
          : `${teamName}: sin datos de fase de grupos.`
      }
      const group = (standings ?? [])
        .filter((x: any) => x.group_letter === s.group_letter)
        .sort((a: any, b: any) =>
          b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for
        )
      const pos = group.findIndex((x: any) => x.team_id === teamId) + 1
      const posLabel =
        pos === 1 ? '1º del grupo' : pos === 2 ? '2º del grupo' : 'entre los mejores terceros'
      const resTxt = results.length ? ` Resultados en el torneo: ${results.join('; ')}.` : ''
      return `${teamName} (Grupo ${s.group_letter}): clasificó como ${posLabel} con ${s.points} pts (${s.won}V ${s.drawn}E ${s.lost}D, ${s.goals_for} goles a favor / ${s.goals_against} en contra).${resTxt}`
    }

    const campaignHome = describeCampaign(match.home_team_id, homeTeam)
    const campaignAway = describeCampaign(match.away_team_id, awayTeam)

    // Paso 2 — Tavily: foco en rendimiento del torneo (sin inducir sanciones)
    const [newsHome, newsAway] = await Promise.all([
      tavilyClient.search(`${homeTeam} selección Mundial 2026 rendimiento fase de grupos noticias`, {
        maxResults: 5,
        searchDepth: 'basic',
      }),
      tavilyClient.search(`${awayTeam} selección Mundial 2026 rendimiento fase de grupos noticias`, {
        maxResults: 5,
        searchDepth: 'basic',
      }),
    ])

    const contextHome = newsHome.results
      .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join('\n')

    const contextAway = newsAway.results
      .map(r => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join('\n')

    // Paso 3 — Claude analiza (sin web_search)
    const prompt = `Eres un analista deportivo experto en fútbol. Analiza este partido del Mundial FIFA 2026 y genera un pronóstico basado SOBRE TODO en el rendimiento real de cada selección durante este torneo.

PARTIDO: ${homeTeam} vs ${awayTeam}
FASE: ${match.phase}
FECHA: ${match.match_date}
SEDE: ${match.city}

RENDIMIENTO EN EL MUNDIAL (datos oficiales — esta es tu base principal de análisis):
${campaignHome}
${campaignAway}

NOTICIAS RECIENTES (contexto complementario, puede estar incompleto o ser irrelevante):
${homeTeam}:
${contextHome}

${awayTeam}:
${contextAway}

REGLAS ESTRICTAS (obligatorias):
1. Centra el análisis en cómo se desempeñó cada equipo en el torneo y CÓMO CLASIFICÓ a esta ronda: posición en el grupo, puntos, goles a favor/en contra y resultados. Compara el nivel mostrado por ambos.
2. NO inventes lesiones, sanciones ni bajas. Menciona una baja (por lesión o por tarjetas) ÚNICAMENTE si aparece de forma explícita en las noticias proporcionadas arriba. Si no hay información clara de bajas, NO las menciones ni asumas que algún jugador está ausente.
3. Las 48 selecciones, incluida Irán, están participando con normalidad. Nunca afirmes que un equipo se retiró, fue excluido o no participa.
4. "recent_form" debe reflejar los resultados reales recientes (incluida la fase de grupos de este Mundial).
5. Los "key_players" deben ser jugadores que están disponibles y han participado en el torneo; no incluyas jugadores que las noticias indiquen como ausentes.

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
  "analysis_text": "Análisis de 3-4 oraciones centrado en el rendimiento de ambos en el torneo y cómo clasificaron"
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