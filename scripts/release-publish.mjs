/** Publish only archives validated by release:pack, preserving their exact bytes. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
const { values } = parseArgs({ args: process.argv.slice(2).filter(arg => arg !== '--'), options: { from: { type: 'string' }, tag: { type: 'string', default: 'candidate' } } })
if (!values.from || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(values.tag)) throw new Error('Usage: pnpm release:publish -- --from <directory> --tag <tag>')
const root = resolve(values.from)
const inventory = JSON.parse(readFileSync(join(root, 'gestaltrun-packages.json'), 'utf8'))
if (inventory.repository !== 'gestaltrun/ego-browser' || inventory.packages?.length !== 1) throw new Error('Unexpected release inventory')
for (const item of inventory.packages) {
  if (!/^\d+\.\d+\.\d+-gestaltrun\.\d+$/.test(item.version) || item.name !== '@gestaltrun/dsh-ego-browser' || item.filename !== `gestaltrun-dsh-ego-browser-${item.version}.tgz`) throw new Error('Unexpected artifact identity')
  const file = join(root, item.filename)
  if (`sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}` !== item.integrity) throw new Error('Artifact integrity mismatch')
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['publish', file, '--access', 'public', '--tag', values.tag, ...(process.env.GITHUB_ACTIONS === 'true' ? ['--provenance'] : [])], { stdio: 'inherit' })
}
