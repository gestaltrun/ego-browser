/** Load the archived browser entry through the official module table. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import * as React from 'react'
import * as ClientStore from '@deepseek-ai/dsh-client-store'

/** Reject archived client imports absent from the shipped Web platform seeds. */
export async function checkPackedClient(archive) {
  const manifest = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }))
  const client = execFileSync('tar', ['-xOf', archive, 'package/lib/client.js'], { encoding: 'utf8' })
  const bootstrapScript = readFileSync(fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-client-modules/client')), 'utf8')
  const dom = new JSDOM('', { url: 'https://dsh.test/', runScripts: 'outside-only' })
  try {
    const pendingQueue = []
    const target = { mode: 'queue', pendingQueue, load(registration) { pendingQueue.push(registration) } }
    dom.window.__ModuleLoader__ = target
    dom.window.eval(bootstrapScript)
    assert.equal(pendingQueue.length, 1)
    const bootstrap = pendingQueue.shift()
    assert.equal(bootstrap.id, '@deepseek-ai/dsh-client-modules')
    const bootstrapExports = bootstrap.factory(specifier => { throw new Error(`Unexpected bootstrap dependency: ${specifier}`) })
    const url = `/plugins/??${manifest.name}/client.js&rev=archive`
    const modules = bootstrapExports.createClientModuleSystem(target, { id: bootstrap.id, exports: bootstrapExports }, {
      boot: { rev: 'archive', entries: [{ id: manifest.name, url, rev: 'archive' }], batches: [{ phase: 'application', url, rev: 'archive', entries: [manifest.name] }] },
      staticModules: { react: React, '@deepseek-ai/dsh-client-store': ClientStore },
      loadBundle: async requestedUrl => { assert.equal(requestedUrl, url); dom.window.eval(client) },
    })
    const plugin = await modules.import(manifest.name, '', {})
    assert.equal(typeof plugin.apply, 'function')
    assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale', 'connection'])
  } finally {
    dom.window.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/check-packed-client.mjs <archive.tgz>')
  await checkPackedClient(resolve(process.argv[2]))
  console.log('Archived Ego client loaded through ClientModuleSystem')
}
