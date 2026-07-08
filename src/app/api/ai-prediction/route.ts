import Anthropic from '@anthropic-ai/sdk'
import { tavily } from '@tavily/core'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! })

const KNOCKOUT_PHASES = ['dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final']
const PHASE_LABEL: Record<string, string> = {
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semifinal: 'Semifinal',
  tercer_puesto: 'Tercer puesto',
  final: 'Final',
}

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
  const isKnockout = KNOCKOUT_PHASES.includes(match.phase)

  try {
    // ---- Historial de partidos finalizados (filtrado por fase si es eliminatoria) ----
    let history: any[] = []
    if (match.home_team_id && match.away_team_id) {
      let q = supabase
        .from('matches')
        .select(`
          phase, home_team_id, away_team_id, home_score, away_score, match_date,
          home_team:teams!matches_home_team_id_fkey(name),
          away_team:teams!matches_away_team_id_fkey(name)
        `)
        .eq('status', 'finalizado')
        .or(
          `home_team_id.eq.${match.home_team_id},away_team_id.eq.${match.home_team_id},home_team_id.eq.${match.away_team_id},away_team_id.eq.${match.away_team_id}`
        )
      if (isKnockout) q = q.in('phase', KNOCKOUT_PHASES)
      const { data: h } = await q
      history = h ?? []
    }

    const teamMatches = (teamId: number) =>
      history
        .filter((m: any) => m.home_team_id === teamId || m.away_team_id === teamId)
        .sort((a: any, b: any) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())

    // ---- Descripción del recorrido en eliminatorias (con estadísticas) ----
    const describeKnockoutRun = (teamId: number | null, teamName: string) => {
      if (!teamId) return `${teamName}: equipo aún por definir.`
      const ms = teamMatches(teamId)
      if (!ms.length) return `${teamName}: sin partidos de eliminatoria registrados todavía.`
      let gf = 0, ga = 0, clean = 0
      const lines = ms.map((m: any) => {
        const isHome = m.home_team_id === teamId
        const f = isHome ? m.home_score : m.away_score
        const a = isHome ? m.away_score : m.home_score
        const opp = isHome ? m.away_team?.name : m.home_team?.name
        gf += f; ga += a; if (a === 0) clean++
        const outcome =
          f > a ? 'ganó' : f < a ? 'perdió' : 'empató y avanzó (prórroga/penales)'
        return `${PHASE_LABEL[m.phase] ?? m.phase}: ${outcome} ${f}-${a} vs ${opp}`
      })
      return `${teamName} — Recorrido en eliminatorias: ${lines.join('; ')}. Totales: ${gf} goles a favor y ${ga} en contra en ${ms.length} partido(s), ${clean} valla(s) invicta(s).`
    }

    // ---- Descripción por rendimiento de torneo (fases previas / grupos) ----
    const describeGeneric = (teamId: number | null, teamName: string) => {
      if (!teamId) return `${teamName}: equipo aún por definir.`
      const ms = teamMatches(teamId)
      if (!ms.length) return `${teamName}: sin datos de partidos previos.`
      const lines = ms.map((m: any) => {
        const isHome = m.home_team_id === teamId
        const f = isHome ? m.home_score : m.away_score
        const a = isHome ? m.away_score : m.home_score
        const opp = isHome ? m.away_team?.name : m.home_team?.name
        const r = f > a ? 'victoria' : f < a ? 'derrota' : 'empate'
        return `${r} ${f}-${a} vs ${opp}`
      })
      return `${teamName}: ${lines.join('; ')}.`
    }

    const perfHome = isKnockout ? describeKnockoutRun(match.home_team_id, homeTeam) : describeGeneric(match.home_team_id, homeTeam)
    const perfAway = isKnockout ? describeKnockoutRun(match.away_team_id, awayTeam) : describeGeneric(match.away_team_id, awayTeam)

    // ---- Tavily: rendimiento + bajas (más búsquedas si es eliminatoria) ----
    let perfCtxHome = '', perfCtxAway = '', injCtxHome = '', injCtxAway = ''

    const fmt = (res: any) =>
      (res?.results ?? []).map((r: any) => `- ${r.title}: ${r.content?.slice(0, 200)}`).join('\n')

    if (isKnockout) {
      const [ph, pa, ih, ia] = await Promise.all([
        tavilyClient.search(`${homeTeam} selección Mundial 2026 dieciseisavos octavos resultado rendimiento`, { maxResults: 5, searchDepth: 'basic' }),
        tavilyClient.search(`${awayTeam} selección Mundial 2026 dieciseisavos octavos resultado rendimiento`, { maxResults: 5, searchDepth: 'basic' }),
        tavilyClient.search(`${homeTeam} selección Mundial 2026 lesionados sancionados tarjeta roja baja`, { maxResults: 5, searchDepth: 'basic' }),
        tavilyClient.search(`${awayTeam} selección Mundial 2026 lesionados sancionados tarjeta roja baja`, { maxResults: 5, searchDepth: 'basic' }),
      ])
      perfCtxHome = fmt(ph); perfCtxAway = fmt(pa); injCtxHome = fmt(ih); injCtxAway = fmt(ia)
    } else {
      const [ph, pa] = await Promise.all([
        tavilyClient.search(`${homeTeam} selección Mundial 2026 rendimiento noticias`, { maxResults: 5, searchDepth: 'basic' }),
        tavilyClient.search(`${awayTeam} selección Mundial 2026 rendimiento noticias`, { maxResults: 5, searchDepth: 'basic' }),
      ])
      perfCtxHome = fmt(ph); perfCtxAway = fmt(pa)
    }

    // ---- Prompt ----
    const jsonSchema = `{
  "home_win_pct": número entre 0 y 100,
  "draw_pct": número entre 0 y 100,
  "away_win_pct": número entre 0 y 100,
  "home_expected_goals": número decimal,
  "away_expected_goals": número decimal,
  "key_players": [
    {"team": "${homeCode}", "player": "nombre", "reason": "por qué es clave"},
    {"team": "${awayCode}", "player": "nombre", "reason": "por qué es clave"}
  ],
  "recent_form": { "home": "WWDLL", "away": "WDWWL" },
  "analysis_text": "texto del análisis"
}`

    const prompt = isKnockout
      ? `Eres un analista táctico de fútbol de élite. Analiza este partido de ${PHASE_LABEL[match.phase] ?? match.phase} del Mundial FIFA 2026 y genera un pronóstico PROFUNDO basado casi exclusivamente en el rendimiento de cada selección en las rondas de eliminación ya disputadas (para cuartos: dieciseisavos y octavos). NO uses la fase de grupos como base.

PARTIDO: ${homeTeam} vs ${awayTeam}
FASE: ${PHASE_LABEL[match.phase] ?? match.phase}
FECHA: ${match.match_date}
SEDE: ${match.city}

RECORRIDO EN ELIMINATORIAS (datos oficiales — BASE PRINCIPAL del análisis):
${perfHome}
${perfAway}

NOTICIAS DE RENDIMIENTO (contexto complementario):
${homeTeam}:
${perfCtxHome}
${awayTeam}:
${perfCtxAway}

NOTICIAS DE BAJAS / LESIONES / SANCIONES (contexto — puede venir vacío o irrelevante):
${homeTeam}:
${injCtxHome}
${awayTeam}:
${injCtxAway}

INSTRUCCIONES (obligatorias):
1. Fundamenta el análisis y el marcador esperado ANTE TODO en los datos de sus partidos de dieciseisavos y octavos: goles marcados y recibidos, contundencia ofensiva, solidez defensiva y CÓMO resolvieron cada eliminatoria (goleada, resultado ajustado, prórroga o penales).
2. Usa esas estadísticas concretas para estimar el marcador más probable y JUSTIFICA los goles esperados citando esos datos.
3. Bajas: menciona lesiones o sanciones (tarjeta roja / acumulación) SOLO si aparecen de forma explícita en las noticias de arriba, dando prioridad a las surgidas en el partido anterior (octavos). Si no hay información clara, NO inventes bajas ni asumas ausencias.
4. Nunca afirmes que un equipo se retiró o no participa.
5. "recent_form" debe reflejar los resultados reales recientes, priorizando los partidos de eliminatorias.
6. "key_players": jugadores disponibles que hayan destacado en estas rondas; no incluyas a quienes las noticias señalen como ausentes.
7. "analysis_text" debe ser DETALLADO (5 a 7 oraciones) y citar datos concretos de dieciseisavos y octavos que sustenten el marcador previsto.

Responde ÚNICAMENTE con este JSON, sin texto antes ni después, sin markdown:
${jsonSchema}

Los tres porcentajes deben sumar exactamente 100.`
      : `Eres un analista deportivo experto en fútbol. Analiza este partido del Mundial FIFA 2026 basándote en el rendimiento real de cada selección en el torneo.

PARTIDO: ${homeTeam} vs ${awayTeam}
FASE: ${match.phase}
FECHA: ${match.match_date}
SEDE: ${match.city}

RENDIMIENTO EN EL TORNEO (datos oficiales):
${perfHome}
${perfAway}

NOTICIAS RECIENTES (contexto, puede estar incompleto):
${homeTeam}:
${perfCtxHome}
${awayTeam}:
${perfCtxAway}

REGLAS:
1. Centra el análisis en el rendimiento real en el torneo.
2. NO inventes lesiones ni sanciones; menciónalas solo si aparecen explícitas en las noticias.
3. Nunca afirmes que un equipo se retiró o no participa.
4. "recent_form" debe reflejar resultados reales recientes.

Responde ÚNICAMENTE con este JSON, sin texto antes ni después, sin markdown:
${jsonSchema}

Los tres porcentajes deben sumar exactamente 100.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
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