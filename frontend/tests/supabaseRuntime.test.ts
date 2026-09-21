/** @jest-environment node */
import { describe, it, expect, jest } from '@jest/globals'
import { NextRequest } from 'next/server'

describe('Supabase sem WebSocket nativo no servidor', () => {
  it('permite importar o cliente do navegador durante SSR sem inicializá-lo', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    Reflect.deleteProperty(globalThis, 'WebSocket')
    try {
      jest.resetModules()
      const clientModule = await import('@/lib/supabase/client')
      expect(typeof clientModule.createClient).toBe('function')
      expect(typeof clientModule.supabase).toBe('object')
    } finally { if (descriptor) Object.defineProperty(globalThis, 'WebSocket', descriptor) }
  })
  it('proxy inicializa o SDK e redireciona visitante sem abrir WebSocket', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    Reflect.deleteProperty(globalThis, 'WebSocket')
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    try {
      jest.resetModules()
      const { proxy } = await import('@/proxy')
      const response = await proxy(new NextRequest('http://localhost:3000/admin/dossies'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?redirect=%2Fadmin%2Fdossies')
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'WebSocket', descriptor)
      if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = url
      if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key
    }
  })
})
