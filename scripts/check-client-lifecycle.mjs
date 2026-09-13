/** Exercise the real Cordis provider lifecycle with the plugin's browser view. */
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'

/** Verify optional Sidebar arrival, withdrawal, replacement, and parent disposal. */
export async function checkClientLifecycle(plugin, window) {
  const ctx = new Context()
  const tabs = new Set()
  const settings = new Set()
  const dictionaries = new Map()
  const streams = new Set()
  const windowGlobals = new Map(['fetch', 'TextDecoder', 'TextEncoder'].map(name => [name, Object.getOwnPropertyDescriptor(window, name)]))
  const globals = new Map([['fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch')]])
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'MutationObserver']) {
    if (globalThis[name] === window[name] || (name === 'window' && globalThis.window === window)) continue
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' ? window : window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  window.TextDecoder ??= globalThis.TextDecoder
  window.TextEncoder ??= globalThis.TextEncoder
  window.fetch = async (url, options = {}) => {
    if (url === '/api/ego/spaces') return new Response(JSON.stringify({ ok: true, spaces: [], toolCallCount: 0, capture: { backend: 'cdp', state: 'idle' } }), { headers: { 'content-type': 'application/json' } })
    if (url === '/api/ego/stream') {
      const signal = options.signal
      assert.ok(signal)
      streams.add(signal)
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode(':ready\n\n'))
        const close = () => { streams.delete(signal); controller.close() }
        if (signal.aborted) close()
        else signal.addEventListener('abort', close, { once: true })
      } }), { headers: { 'content-type': 'text/event-stream' } })
    }
    if (url === '/api/ego/watch/stop') return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })
    throw new Error(`Unexpected fixture request: ${url}`)
  }
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: window.fetch })
  class Locale extends Service {
    constructor(scope) { super(scope, 'locale') }
    register(name, values) { dictionaries.set(name, values); return () => dictionaries.delete(name) }
    bind(name) { return key => dictionaries.get(name)?.zh[key] ?? key }
    subscribe() { return () => {} }
    getSnapshot() { return { active: 'zh', revision: 0 } }
  }
  class Slots extends Service {
    constructor(scope) { super(scope, 'slots') }
    inject(_name, callback) { return this.ctx.effect(callback) }
    register(definition) { settings.add(definition); return () => settings.delete(definition) }
  }
  class Sidebar extends Service {
    constructor(scope) { super(scope, 'betterSidebar') }
    registerTab(tab) {
      tabs.add(tab)
      const container = window.document.createElement('section')
      container.dataset.egoSidebarFixture = ''
      window.document.body.appendChild(container)
      const root = createRoot(container)
      root.render(createElement(tab.component, { ctx: this.ctx, visible: true }))
      return () => { root.unmount(); container.remove(); tabs.delete(tab) }
    }
    openTab() {}
  }
  async function settle(work = async () => {}) {
    await act(async () => {
      await work()
      await Promise.all([...ctx.registry.values()].flatMap(runtime => [...runtime.fibers].map(fiber => fiber.await())))
    })
  }
  let ego
  let sidebar
  try {
    await ctx.plugin(scope => { new Locale(scope); new Slots(scope); new Service(scope, 'connection') })
    await settle(async () => { ego = ctx.plugin(plugin); await ego })
    assert.ok(window.document.querySelector('#dsh-ego-fab'), 'Missing standalone preview before Sidebar arrives')
    assert.ok(window.document.querySelector('#dsh-ego-panel .dsh-ego-side-root'), 'Standalone preview did not render the shared interactive view')
    assert.equal(window.document.querySelectorAll('textarea').length, 1, 'Standalone view has no unique input proxy')
    assert.ok(!window.document.body.textContent.includes('只读观察窗'))
    await settle(async () => { sidebar = ctx.plugin(Sidebar); await sidebar })
    assert.equal(tabs.size, 1, 'Late Sidebar did not receive the Ego tab')
    assert.ok(streams.size > 0, 'Rendered views did not connect the real SSE reader')
    assert.equal([...tabs][0].id, 'ego-browser:watch')
    assert.equal(typeof [...tabs][0].component, 'function')
    assert.ok(window.document.querySelector('[data-ego-sidebar-fixture] .dsh-ego-side-root'), 'Sidebar did not render the shared interactive view')
    assert.equal(window.document.querySelectorAll('textarea').length, 1, 'Sidebar view duplicated or lost the input proxy')
    assert.equal([...tabs][0].urlTarget, undefined, 'Ego must preserve the existing HTTPS target')
    assert.equal(window.document.querySelector('#dsh-ego-fab'), null, 'Floating preview survived Sidebar arrival')
    assert.deepEqual([...settings].map(entry => entry.id), ['ego-browser'])
    await settle(() => sidebar.dispose())
    assert.equal(tabs.size, 0)
    assert.ok(window.document.querySelector('#dsh-ego-fab'), 'Standalone preview was not restored after Sidebar withdrawal')
    await settle(async () => { sidebar = ctx.plugin(Sidebar); await sidebar })
    assert.equal(tabs.size, 1, 'Sidebar replacement duplicated or lost the Ego tab')
    await settle(() => ego.dispose())
    assert.equal(tabs.size, 0)
    assert.equal(settings.size, 0)
    assert.equal(window.document.querySelector('#dsh-ego-fab'), null)
    assert.equal(window.document.querySelector('#dsh-ego-panel'), null)
    await sidebar.dispose()
    await settle(async () => { sidebar = ctx.plugin(Sidebar); await sidebar })
    assert.equal(tabs.size, 0, 'A late service resurrected the disposed Ego plugin')
    assert.equal(streams.size, 0, 'Disposed views retained SSE connections')
    assert.equal(window.document.querySelectorAll('style, textarea').length, 0, 'Disposed views retained DOM resources')
  } finally {
    try {
      await settle(() => ctx.fiber.dispose())
    } finally {
      for (const [name, descriptor] of windowGlobals) {
        if (descriptor) Object.defineProperty(window, name, descriptor)
        else delete window[name]
      }
      for (const [name, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete globalThis[name]
      }
    }
  }
}
