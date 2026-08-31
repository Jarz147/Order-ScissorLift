import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// =====================================================================
//  Edge Function: publish-mqtt
//  Menerima data pemesanan yang disetujui lalu meneruskan ke Node-RED
//  (relay) supaya dipublish ke broker MQTT lokal.
//
//  Variabel env (Supabase Edge Function secrets):
//    NODERED_URL   = URL public HTTP endpoint Node-RED (mis. via ngrok)
//    NODERED_TOKEN = token pengaman yang dicocokkan Node-RED
// =====================================================================

const NODERED_URL = Deno.env.get('NODERED_URL') || ''
const NODERED_TOKEN = Deno.env.get('NODERED_TOKEN') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    if (!NODERED_URL) {
      return new Response(
        JSON.stringify({ error: 'NODERED_URL belum dikonfigurasi' }),
        { status: 500, headers: corsHeaders },
      )
    }

    const res = await fetch(NODERED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nodered-token': NODERED_TOKEN,
      },
      body: JSON.stringify(body),
    })

    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      status: res.ok ? 200 : 502,
      headers: corsHeaders,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
