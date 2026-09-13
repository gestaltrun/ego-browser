// @vitest-environment jsdom
/** The watch tab participates in Sidebar without consuming unrelated links. */
import { afterEach, expect, it, vi } from 'vitest'
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import * as store from '@deepseek-ai/dsh-client-store'

afterEach(() => vi.unstubAllGlobals())

it('tracks a late Sidebar through withdrawal, replacement and parent disposal', async () => {
  vi.stubGlobal('require', (name: string) => {
    if (name === 'react') return React
    if (name === 'react-dom/client') return ReactDOMClient
    if (name === '@deepseek-ai/dsh-client-store') return store
    throw Error(`Unexpected client dependency: ${name}`)
  })
  const plugin = await import('../../src/client/index.ts')
  const { checkClientLifecycle } = await import('../../scripts/check-client-lifecycle.mjs')
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  const originalAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  await checkClientLifecycle(plugin, window)
  expect(Object.getOwnPropertyDescriptor(globalThis, 'fetch')).toEqual(originalFetch)
  expect(Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')).toEqual(originalAct)
})
