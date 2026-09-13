// @vitest-environment jsdom
/** The watch tab participates in Sidebar without consuming unrelated links. */
import { afterEach, expect, it, vi } from 'vitest'
import * as React from 'react'
import * as store from '@deepseek-ai/dsh-client-store'

vi.mock('../../src/client/events.ts', () => ({ EgoEventSource: class { addEventListener() {} close() {} } }))
afterEach(() => vi.unstubAllGlobals())

it('keeps the common HTTPS target while registering an explicit Ego watch tab', async () => {
  vi.stubGlobal('require', (name: string) => {
    if (name === 'react') return React
    if (name === '@deepseek-ai/dsh-client-store') return store
    throw Error(`Unexpected client dependency: ${name}`)
  })
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ toolCallCount: 0 }), { headers: { 'content-type': 'application/json' } }))
  const tabs: Array<{ id: string; component: unknown; urlTarget?: (url: URL) => boolean }> = []
  const effects: Array<() => void> = []
  const settings: Array<{ id: string }> = []
  const sidebar = { registerTab(tab: typeof tabs[number]) { tabs.push(tab); return () => { tabs.splice(tabs.indexOf(tab), 1) } } }
  const { apply } = await import('../../src/client/index.ts')
  const ctx = {
    effect(callback: () => (() => void) | undefined) { const dispose = callback(); if (dispose) effects.push(dispose) },
    on() { return () => {} },
    locale: { register() { return () => {} } },
    slots: { inject(_name: string, callback: () => () => void) { effects.push(callback()) }, register(definition: { id: string }) { settings.push(definition); return () => { settings.splice(settings.indexOf(definition), 1) } } },
    get(name: string) { return name === 'betterSidebar' ? sidebar : undefined },
  }
  try {
    apply(ctx)
    const target = (url: string) => tabs.find(tab => tab.urlTarget?.(new URL(url)))?.id ?? 'browser'
    expect(target('https://example.com/page')).toBe('browser')
    expect(target('https://example.com/manual.pdf')).toBe('browser')
    expect(tabs.find(tab => tab.id === 'ego-browser:watch')?.component).toBeTypeOf('function')
    expect(settings.map(entry => entry.id)).toEqual(['ego-browser'])
  } finally {
    for (const dispose of effects.reverse()) dispose()
  }
  expect(tabs).toHaveLength(0)
  expect(settings).toHaveLength(0)
  expect(document.head.querySelectorAll('style')).toHaveLength(0)
})
