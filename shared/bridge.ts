import type { DocumentType, LibraryStatus } from './library'

export type CommandName =
  | 'ping'
  | 'open-library'
  | 'today'
  | 'diary'
  | 'new'
  | 'open'
  | 'save'
  | 'now'
  | 'leave'
  | 'log'
  | 'accept'

export type QueryName = 'ping' | 'library' | 'desk' | 'complete' | 'changed'

export type EventName = 'ready' | 'library-changed'

export type BridgeResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

export interface CommandArgs {
  text?: string
  type?: DocumentType
  title?: string
  path?: string
  currentPath?: string
}

export interface QueryArgs {
  text?: string
}

export interface CommandSuccess {
  path: string
  title: string
  created: boolean
  message: string
}

export interface DeskView {
  today: string
  day: string
  name: string
  path: string | null
}

export interface CompletionItem {
  kind: 'command' | 'type' | 'note'
  label: string
  value: string
}

export interface ChangedNote {
  path: string
  title: string
  type: DocumentType
}

export interface ChangedView {
  pending: ChangedNote[]
  accepted: ChangedNote[]
}

export type QueryValue = LibraryStatus | DeskView | CompletionItem[] | ChangedView | null

export interface KeepNoteBridge {
  run(command: CommandName, args?: CommandArgs): Promise<BridgeResult<CommandSuccess | null>>
  query(name: QueryName, args?: QueryArgs): Promise<BridgeResult<QueryValue>>
  subscribe(event: EventName, listener: () => void): () => void
}
