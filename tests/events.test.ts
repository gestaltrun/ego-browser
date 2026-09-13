// @vitest-environment jsdom
/** Desktop's Fetch carrier must deliver named SSE frames and stop on unmount. */
import { afterEach, expect, it, vi } from 'vitest'
import { EgoEventSource } from '../src/client/events.ts'

afterEach(() => vi.unstubAllGlobals())

it('reads named events through fetch and aborts its owned stream on close', async () => {
  const frame = Promise.withResolvers<MessageEvent<string>>()
  const opened = Promise.withResolvers<void>()
  const aborted = Promise.withResolvers<void>()
  let stream!: ReadableStreamDefaultController<Uint8Array>
  const mockFetch = vi.fn(async (_url: unknown, options: RequestInit) => {
    options.signal!.addEventListener('abort', () => { stream.close(); aborted.resolve() }, { once: true })
    return new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller } }), { headers: { 'content-type': 'text/event-stream' } })
  })
  vi.stubGlobal('fetch', mockFetch)
  const source = new EgoEventSource('dsh-app://app/api/ego/stream')
  try {
    source.onopen = () => opened.resolve()
    source.addEventListener('frame', event => frame.resolve(event))
    await opened.promise
    stream.enqueue(new TextEncoder().encode('event: frame\nid: 7\ndata: {"targetId":"owned","data":"jpeg"}\n\n'))
    expect((await frame.promise).data).toBe('{"targetId":"owned","data":"jpeg"}')
    expect(mockFetch.mock.calls[0][0]).toBe('dsh-app://app/api/ego/stream')
  } finally {
    source.close()
    await aborted.promise
  }
})
