import { describe, it, expect, jest } from '@jest/globals'

// Exercita o SDK real sem rede, reproduzindo o runtime sem WebSocket nativo.
describe('cliente Supabase do backend', () => {
  it('inicializa a consulta sem WebSocket global e reutiliza o cliente', async () => {
    const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    const originalUrl = process.env['SUPABASE_URL']
    const originalKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
    Reflect.deleteProperty(globalThis, 'WebSocket')
    process.env['SUPABASE_URL'] = 'https://example.supabase.co'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-key'
    try {
      jest.resetModules()
      const { supabase } = await import('@/database/supabase')
      expect(() => supabase.from('dossiers').select('slug')).not.toThrow()
      expect(supabase.auth).toBe(supabase.auth)
      expect(supabase.realtime.isConnected()).toBe(false)
    } finally {
      if (originalWebSocket) Object.defineProperty(globalThis, 'WebSocket', originalWebSocket)
      else Reflect.deleteProperty(globalThis, 'WebSocket')
      if (originalUrl === undefined) delete process.env['SUPABASE_URL']; else process.env['SUPABASE_URL'] = originalUrl
      if (originalKey === undefined) delete process.env['SUPABASE_SERVICE_ROLE_KEY']; else process.env['SUPABASE_SERVICE_ROLE_KEY'] = originalKey
    }
  })
})
