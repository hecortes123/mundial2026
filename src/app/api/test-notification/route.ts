import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
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

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return NextResponse.json({ 
      error: 'Variables de entorno faltantes',
      hasToken: !!token,
      hasChatId: !!chatId,
    }, { status: 500 })
  }

  const message = [
    '🏆 <b>Test de notificación</b>',
    '',
    '⚽ <b>Equipo A</b> 2 - 1 <b>Equipo B</b>',
    '⚽ <b>Equipo C</b> 0 - 3 <b>Equipo D</b>',
    '',
    '👉 https://mundial2026-ivory-eight.vercel.app/admin',
  ].join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    const data = await res.json()

    return NextResponse.json({
      success: res.ok,
      telegramResponse: data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}