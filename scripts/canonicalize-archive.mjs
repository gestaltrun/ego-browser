/** Stable gzip metadata for unpublished npm archives produced by pnpm. */
import { gunzipSync } from 'node:zlib'
import { gzipSync } from 'fflate'

/** Return a validated archive with gzip OS=255 and identical decompressed tar bytes. */
export function canonicalizeArchive(archive) {
  if (archive.length < 18 || archive[0] !== 0x1f || archive[1] !== 0x8b || archive[2] !== 8 || archive[3] !== 0) {
    throw new Error('Expected a gzip archive with compression method 8 and no optional header fields')
  }
  const tar = gunzipSync(archive)
  const canonical = Buffer.from(gzipSync(tar, { level: 9, mtime: 0 }))
  canonical[9] = 255
  if (!gunzipSync(canonical).equals(tar)) throw new Error('Canonical gzip changed the tar contents')
  return canonical
}
