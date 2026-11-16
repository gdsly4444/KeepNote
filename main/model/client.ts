export interface ModelMessage {
  role: 'user' | 'assistant' | 'tool'
  text: string
  name?: string
}

export interface ModelToolCall {
  name: string
  arguments: string
  complete: boolean
}

export interface ModelTurn {
  text: string
  calls: ModelToolCall[]
}

export interface ModelClient {
  readonly id: string
  complete(input: {
    messages: readonly ModelMessage[]
    signal: AbortSignal
    onText: (delta: string) => void
  }): Promise<ModelTurn>
}
