/** Authentication shared by the browser-control routes and settings gateway. */
import type { IncomingMessage } from 'node:http'
import type { EgoContext } from './types.ts'

/** Return the owning Host's rejection, or accept a positively identified private Desktop request. */
export function egoRequestRejection(ctx: EgoContext, request: IncomingMessage): number | undefined {
  const privateHttp = ctx.get?.('desktopPrivateHttp') as { isTrusted(request: IncomingMessage): boolean } | undefined
  if (privateHttp?.isTrusted(request)) return undefined
  const connection = ctx.get?.('connection') as { requestRejection(request: IncomingMessage): number | undefined } | undefined
  return connection === undefined ? 401 : connection.requestRejection(request)
}
