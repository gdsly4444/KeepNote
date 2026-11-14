export type CommandName = 'ping'

export type QueryName = 'ping'

export type EventName = 'ready'

export type CommandResult = { ok: true } | { ok: false; code: string; message: string }

export interface KeepNoteBridge {
  run(command: CommandName): Promise<CommandResult>
  query(name: QueryName): Promise<CommandResult>
  subscribe(event: EventName, listener: () => void): () => void
}
