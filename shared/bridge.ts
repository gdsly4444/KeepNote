import type { DocumentType, LibraryStatus } from './library'

export type CommandName =
  | 'ping'
  | 'open-library'
  | 'today'
  | 'diary'
  | 'new'
  | 'open'
  | 'now'
  | 'leave'
  | 'log'

export type QueryName = 'ping' | 'library'

export type EventName = 'ready' | 'library-changed'

export type BridgeResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

export interface CommandArgs {
  text?: string
  type?: DocumentType
  title?: string
  path?: string
  currentPath?: string
}

export interface CommandSuccess {
  path: string
  title: string
  created: boolean
  message: string
}

export interface KeepNoteBridge {
  run(command: CommandName, args?: CommandArgs): Promise<BridgeResult<CommandSuccess | null>>
  query(name: QueryName): Promise<BridgeResult<LibraryStatus | null>>
  subscribe(event: EventName, listener: () => void): () => void
}
