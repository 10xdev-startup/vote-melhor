import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

let client: SupabaseClient | null = null

// O SDK pede um construtor WebSocketLike (`onerror: Event`). Em Node sem DOM,
// `typeof globalThis.WebSocket` e o de undici (`onerror: ErrorEvent`) — o mesmo
// mismatch que o pacote `ws` — e o cast nao fecha o TS2322 do `tsc` no Docker.
type RealtimeTransport = NonNullable<NonNullable<NonNullable<Parameters<typeof createClient>[2]>['realtime']>['transport']>

// Cria o client sob demanda. As credenciais so sao exigidas no primeiro uso
// real do banco — nao no boot do processo.
function getClient(): SupabaseClient {
  if (client) return client
  const supabaseUrl = process.env['SUPABASE_URL']
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  }
  // O SDK inicializa Realtime mesmo em consultas REST; Node 20 não possui WebSocket global.
  client = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket as unknown as RealtimeTransport } })
  return client
}

// Proxy lazy: o client real so e inicializado (e as credenciais cobradas) no
// primeiro acesso a uma propriedade, ex. `supabase.from(...)` ou `supabase.auth`.
// Assim o backend sobe sem Supabase configurado (ex.: apenas /health) e so falha
// se uma rota que de fato usa o banco for chamada.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const value = Reflect.get(c, prop, c)
    return typeof value === 'function' ? value.bind(c) : value
  },
})
