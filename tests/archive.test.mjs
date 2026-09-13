/** Archive identity is independent of the builder OS without rewriting its tar. */
import { expect, it } from 'vitest'
import { constants, gzipSync, gunzipSync } from 'node:zlib'
import { canonicalizeArchive } from '../scripts/canonicalize-archive.mjs'

it('gives Linux and macOS identical gzip bytes while retaining the original tar and inputs', () => {
  const tar = Buffer.alloc(1024) // Two terminal zero blocks form an empty tar archive.
  const linux = gzipSync(tar, { level: 1 })
  const mac = gzipSync(tar, { level: 9, strategy: constants.Z_FIXED })
  linux[9] = 3
  mac[9] = 19
  const linuxBefore = Buffer.from(linux)
  const macBefore = Buffer.from(mac)
  const canonical = canonicalizeArchive(linux)
  expect(canonical).toEqual(canonicalizeArchive(mac))
  expect(canonical[9]).toBe(255)
  expect(gunzipSync(canonical)).toEqual(tar)
  expect(linux).toEqual(linuxBefore)
  expect(mac).toEqual(macBefore)
  expect(canonicalizeArchive(canonical)).toEqual(canonical)
})

it.each([
  ['truncated header', bytes => bytes.subarray(0, 9)],
  ['invalid magic', bytes => { bytes[0] = 0; return bytes }],
  ['unsupported compression', bytes => { bytes[2] = 0; return bytes }],
  ['header CRC', bytes => { bytes[3] = 2; return bytes }],
  ['optional fields', bytes => { bytes[3] = 4; return bytes }],
  ['reserved flags', bytes => { bytes[3] = 128; return bytes }],
  ['corrupt trailer CRC', bytes => { bytes[bytes.length - 8] ^= 1; return bytes }],
  ['truncated payload', bytes => bytes.subarray(0, bytes.length - 9)],
])('rejects %s', (_name, corrupt) => {
  expect(() => canonicalizeArchive(corrupt(gzipSync(Buffer.alloc(1024))))).toThrow()
})
