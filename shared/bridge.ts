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
  | 'ask'
  | 'apply-diff'
  | 'discard-diff'
  | 'cancel-agent'

export type QueryName = 'ping' | 'library' | 'desk' | 'complete' | 'changed' | 'session'

export type EventName = 'ready' | 'library-changed' | 'agent'

export type BridgeResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

export type AgentEntry = 'command' | 'sidebar' | 'selection'

export type DiffUnit = 'section' | 'entry' | 'paragraph' | 'task' | 'lines'

export interface CommandArgs {
  text?: string
  type?: DocumentType
  title?: string
  path?: string
  currentPath?: string
  selection?: string
  groupId?: string
  entry?: AgentEntry
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

export interface DiffGroup {
  id: string
  unit: DiffUnit
  before: string
  after: string
}

export interface TypeConversion {
  to: DocumentType
  preview: string
}

export interface Proposal {
  id: string
  path: string
  type: DocumentType
  groups: DiffGroup[]
  conversion: TypeConversion | null
}

export interface SessionTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface SessionView {
  turns: SessionTurn[]
  reads: string[]
  proposal: Proposal | null
  kept: Proposal[]
  running: boolean
  message: string
}

export interface AgentEvent {
  kind: 'text' | 'read' | 'diff' | 'status'
  text: string
  path: string
  proposal: Proposal | null
  state: '' | 'running' | 'done' | 'cancelled' | 'failed'
}

export type QueryValue = LibraryStatus | DeskView | CompletionItem[] | ChangedView | SessionView | null

export interface KeepNoteBridge {
  run(command: CommandName, args?: CommandArgs): Promise<BridgeResult<CommandSuccess | null>>
  query(name: QueryName, args?: QueryArgs): Promise<BridgeResult<QueryValue>>
  subscribe(event: EventName, listener: (payload: AgentEvent | null) => void): () => void
}
