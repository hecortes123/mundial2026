import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

const TLA_TO_FIFA: Record<string, string> = {
  'MEX': 'MEX', 'RSA': 'RSA', 'KOR': 'KOR', 'CZE': 'CZE',
  'CAN': 'CAN', 'BIH': 'BIH', 'QAT': 'QAT', 'SUI': 'SUI',
  'BRA': 'BRA', 'MAR': 'MAR', 'HAI': 'HAI', 'SCO': 'SCO',
  'USA': 'USA', 'PAR': 'PAR', 'AUS': 'AUS', 'TUR': 'TUR',
  'GER': 'GER', 'CUW': 'CUW', 'CIV': 'CIV', 'ECU': 'ECU',
  'NED': 'NED', 'JPN': 'JPN', 'SWE': 'SWE', 'TUN': 'TUN',
  'BEL': 'BEL', 'EGY': 'EGY', 'IRN': 'IRN', 'NZL': 'NZL',
  'ESP': 'ESP', 'CPV': 'CPV', 'KSA': 'KSA', 'URU': 'URU',
  'FRA': 'FRA', 'SEN': 'SEN', 'IRQ': 'IRQ', 'NOR': 'NOR',
  'ARG': 'ARG', 'ALG': 'ALG', 'AUT': 'AUT', 'JOR': 'JOR',
  'POR': 'POR', 'COD': 'COD', 'UZB': 'UZB', 'COL': 'COL',
  'ENG': 'ENG', 'CRO': 'CRO', 'GHA': 'GHA', 'PAN': 'PAN',
}

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch (error) {
    console.error('Error enviando Telegram:', error)
  }
}

export async function GET(request: Request) {
  // Permitir acceso con token de cron (para cron-job.org)
  const { searchParams } = new URL(request.url)
  const cronToken = searchParams.get('cronToken')
  const isCron = cronToken === process.env.CRON_SECRET

  const supabase = await createClient()

  // Si no es un cron, validar admin
  if (!isCron) {
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
  }

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED', {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY!,
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al consultar football-data.org' }, { status: 500 })
    }

    const apiData = await res.json()

    const { data: pendingMatches } = await supabase
      .from('matches')
      .select(`
        id,
        match_number,
        match_date,
        home_team:teams!matches_home_team_id_fkey(code, name),
        away_team:teams!matches_away_team_id_fkey(code, name),
        status
      `)
      .eq('status', 'pendiente')

    const suggestions: any[] = []

    for (const apiMatch of apiData.matches) {
      const homeFifa = TLA_TO_FIFA[apiMatch.homeTeam.tla]
      const awayFifa = TLA_TO_FIFA[apiMatch.awayTeam.tla]
      if (!homeFifa || !awayFifa) continue

      const apiDate = apiMatch.utcDate.split('T')[0]
      const ourMatch = pendingMatches?.find((m: any) => {
        const ourDate = new Date(m.match_date).toISOString().split('T')[0]
        return m.home_team?.code === homeFifa
          && m.away_team?.code === awayFifa
          && ourDate === apiDate
      })

      if (ourMatch) {
        suggestions.push({
          matchId: ourMatch.id,
          matchNumber: ourMatch.match_number,
          homeTeam: ourMatch.home_team,
          awayTeam: ourMatch.away_team,
          homeScore: apiMatch.score.fullTime.home,
          awayScore: apiMatch.score.fullTime.away,
          status: apiMatch.status,
          apiMatchId: apiMatch.id,
        })
      }
    }

    // Si es cron y hay sugerencias, notificar
    if (isCron && suggestions.length > 0) {
      const lines = suggestions.map(s =>
        `⚽ <b>${(s.homeTeam as any)?.name}</b> ${s.homeScore} - ${s.awayScore} <b>${(s.awayTeam as any)?.name}</b>`
      )
      const message = [
        '🏆 <b>Resultados pendientes por aprobar</b>',
        '',
        ...lines,
        '',
        `👉 https://mundial2026-ivory-eight.vercel.app/admin`,
      ].join('\n')

      await sendTelegram(message)
    }

    return NextResponse.json({
      total: suggestions.length,
      suggestions,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}