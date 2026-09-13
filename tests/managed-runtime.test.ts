/** Managed Ego state cannot attach to a user's independent browser instance. */
import { expect, it } from 'vitest'
import { join } from 'node:path'
import { managedRuntimeEnvironment, managedRuntimeRoot, managedStateDirectory } from '../src/managed-runtime.ts'
import { egoRequestRejection } from '../src/http-auth.ts'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import type { EgoContext } from '../src/types.ts'

it('uses DSH-owned state and an explicitly selected browser binary without adopting global Ego state', () => {
  const parent = { DSH_HOME: '/tmp/isolated-dsh', DSH_EGO_CHROME_PATH: '/resources/Chromium', EGO_LINUX_CDP_URL: 'ws://user-browser', EGO_LINUX_PROFILE: '/user/profile', EGO_LINUX_STATE_DIR: '/user/state', EGO_LINUX_CHROME: '/user/ego', KEEP_ME: 'value' }
  const child = managedRuntimeEnvironment(parent)
  expect(child.EGO_LINUX_CDP_URL).toBeUndefined()
  expect(child.EGO_LINUX_CHROME).toBe('/resources/Chromium')
  expect(child.EGO_LINUX_PROFILE).toBe(join(managedRuntimeRoot(parent), 'profile'))
  expect(child.EGO_LINUX_STATE_DIR).toBe(managedStateDirectory(parent))
  expect(child.KEEP_ME).toBe('value')
  expect(parent.EGO_LINUX_PROFILE).toBe('/user/profile')
})

it('delegates real HTTP auth and only admits positively identified private requests', () => {
  const request = new IncomingMessage(new Socket())
  request.headers = { cookie: 'dsh-auth-fake=anything', host: '127.0.0.1', origin: 'http://127.0.0.1' }
  let acceptedPrivate = false
  let calls = 0
  const ctx = { get(name: string) {
    if (name === 'desktopPrivateHttp') return { isTrusted: (incoming: IncomingMessage) => acceptedPrivate && incoming === request }
    if (name === 'connection') return { requestRejection(incoming: IncomingMessage) { expect(incoming).toBe(request); calls++; return 401 } }
    return undefined
  } } as EgoContext
  expect(egoRequestRejection(ctx, request)).toBe(401)
  expect(calls).toBe(1)
  acceptedPrivate = true
  expect(egoRequestRejection(ctx, request)).toBeUndefined()
  expect(calls).toBe(1)
  acceptedPrivate = false
  expect(egoRequestRejection(ctx, request)).toBe(401)
  expect(egoRequestRejection({} as EgoContext, request)).toBe(401)
  request.socket.destroy()
})
