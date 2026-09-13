/** Native desktop browser launch does not acquire a Linux X display. */
import { afterEach, expect, it, vi } from 'vitest'
import { ensureXDisplay } from '../runtime/ego-linux/src/chrome.mjs'

const platform = Object.getOwnPropertyDescriptor(process, 'platform')
afterEach(() => {
  Object.defineProperty(process, 'platform', platform)
  vi.unstubAllEnvs()
})

it.each(['darwin', 'win32'])('%s uses its native display without DISPLAY or Xvfb', async value => {
  Object.defineProperty(process, 'platform', { ...platform, value })
  vi.stubEnv('DISPLAY', undefined)
  vi.stubEnv('PATH', '')
  expect(await ensureXDisplay()).toBeNull()
  expect(await ensureXDisplay({ ignoreEnvDisplay: true })).toBeNull()
  expect(process.env.DISPLAY).toBeUndefined()
})

it('keeps the explicitly supplied Linux X display', async () => {
  Object.defineProperty(process, 'platform', { ...platform, value: 'linux' })
  vi.stubEnv('DISPLAY', 'display.example:7.0')
  expect(await ensureXDisplay()).toEqual({ display: 'display.example:7.0', pid: null, launched: false })
})
