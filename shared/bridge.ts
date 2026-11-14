import type { LibraryStatus } from './library'

export type CommandName = 'ping' | 'open-library'

export type QueryName = 'ping' | 'library'

export type EventName = 'ready' | 'library-changed'

export type BridgeResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

export interface KeepNoteBridge {
  run(command: CommandName): Promise<BridgeResult<null>>
  query(name: QueryName): Promise<BridgeResult<LibraryStatus | null>>
  subscribe(event: EventName, listener: () => void): () => void
}
