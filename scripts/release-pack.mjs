/** Build and validate the immutable Gestaltrun Ego plugin archive. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const { values } = parseArgs({ args: process.argv.slice(2).filter(arg => arg !== '--'), options: { out: { type: 'string' }, 'sidebar-tarball': { type: 'string' } } })
if (!values.out) throw new Error('Usage: pnpm release:pack -- --out <directory> [--sidebar-tarball <archive>]')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (manifest.name !== '@gestaltrun/dsh-ego-browser' || !/^\d+\.\d+\.\d+-gestaltrun\.\d+$/.test(manifest.version)) throw new Error('Unexpected plugin identity')
if (values['sidebar-tarball']) {
  const sidebar = JSON.parse(execFileSync('tar', ['-xOf', resolve(values['sidebar-tarball']), 'package/package.json'], { encoding: 'utf8' }))
  if (sidebar.name !== '@gestaltrun/dsh-better-sidebar' || sidebar.version !== '0.19.1-gestaltrun.0') throw new Error('Unexpected Sidebar artifact')
}
const cli = process.env.npm_execpath
if (!cli || !/pnpm(?:\.[cm]?js)?$/.test(cli)) throw new Error('Run through pinned pnpm')
function pnpm(args) { execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' }) }
pnpm(['install', '--frozen-lockfile', '--ignore-scripts'])
pnpm(['run', 'build'])
const output = resolve(values.out)
mkdirSync(output, { recursive: true })
pnpm(['--config.ignore-scripts=true', 'pack', '--pack-destination', output])
const filename = `${manifest.name.slice(1).replace('/', '-')}-${manifest.version}.tgz`
const archive = join(output, filename)
const packed = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }))
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  for (const [name, spec] of Object.entries(packed[field] ?? {})) {
    if (/^(?:file|link|workspace):/.test(spec)) throw new Error(`Local artifact dependency ${name}`)
  }
}
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n')
for (const required of ['lib/index.js', 'lib/client.js', 'bin/ego-cast-worker.mjs', 'runtime/ego-linux/bin/ego-browser.mjs', 'runtime/ego-browser/dist/out/index.js', 'cordis.patch.yml', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  if (!entries.includes(`package/${required}`)) throw new Error(`Missing artifact entry ${required}`)
}
if (entries.some(entry => !entry.startsWith('package/') || entry.split('/').includes('..'))) throw new Error('Invalid archive entry')
const { checkPackedClient } = await import('./check-packed-client.mjs')
await checkPackedClient(archive)
const identity = { name: manifest.name, version: manifest.version, filename, integrity: `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}` }
writeFileSync(join(output, 'gestaltrun-packages.json'), JSON.stringify({ schemaVersion: 1, repository: 'gestaltrun/ego-browser', version: manifest.version, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), packages: [identity] }, null, 2) + '\n')
console.log(JSON.stringify(identity))
