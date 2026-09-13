/** Plugin-local SSE reader that works over Web HTTP and Desktop's Fetch carrier. */
import { fetchEventSource } from '@microsoft/fetch-event-source'

export class EgoEventSource {
  private readonly lifetime = new AbortController()
  private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>()
  onerror: ((event: Event) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null

  constructor(url: string) {
    void fetchEventSource(url, {
      signal: this.lifetime.signal,
      openWhenHidden: true,
      onopen: async (response) => {
        if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Ego event stream unavailable')
        this.onopen?.(new Event('open'))
      },
      onmessage: (message) => {
        const event = new MessageEvent<string>(message.event || 'message', { data: message.data, lastEventId: message.id })
        if (!message.event || message.event === 'message') this.onmessage?.(event)
        for (const listener of this.listeners.get(event.type) ?? []) listener(event)
      },
      onclose() { throw new Error('Ego event stream closed') },
      onerror: () => { this.onerror?.(new Event('error')) },
    }).catch(() => { if (!this.lifetime.signal.aborted) this.onerror?.(new Event('error')) })
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    let listeners = this.listeners.get(type)
    if (!listeners) { listeners = new Set(); this.listeners.set(type, listeners) }
    listeners.add(listener)
  }

  close(): void { this.lifetime.abort(); this.listeners.clear() }
}
