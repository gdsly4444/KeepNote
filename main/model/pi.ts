import { createModels, type AssistantMessageEvent } from '@earendil-works/pi-ai'
import type { ModelClient, ModelMessage, ModelToolCall } from './client'

export function createPiModel(env: NodeJS.ProcessEnv = process.env): ModelClient {
  const provider = env.KEEPNOTE_MODEL_PROVIDER || 'anthropic'
  const modelId = env.KEEPNOTE_MODEL || 'claude-sonnet-4-5'
  const key = env.KEEPNOTE_API_KEY
  return {
    id: `${provider}/${modelId}`,
    async complete(input) {
      if (!key) throw new Error('模型不可用')
      const models = createModels()
      const model = models.getModel(provider, modelId)
      if (!model) throw new Error('模型不可用')
      const stream = models.stream(
        model,
        { messages: input.messages.map(toMessage) },
        { apiKey: key, signal: input.signal }
      )
      let text = ''
      const calls: ModelToolCall[] = []
      for await (const event of stream) {
        const piece = readEvent(event)
        if (piece.text) {
          text += piece.text
          input.onText(piece.text)
        }
        if (piece.call) calls.push(piece.call)
        if (piece.failed) throw new Error('模型不可用')
      }
      return { text, calls }
    }
  }
}

function toMessage(message: ModelMessage): { role: 'user'; content: string; timestamp: number } {
  const text = message.role === 'tool' ? `${message.name ?? 'tool'}\n${message.text}` : message.text
  return { role: 'user', content: text, timestamp: Date.now() }
}

function readEvent(event: AssistantMessageEvent): { text: string; call: ModelToolCall | null; failed: boolean } {
  if (event.type === 'text_delta') return { text: event.delta, call: null, failed: false }
  if (event.type === 'toolcall_end') {
    return {
      text: '',
      call: {
        name: event.toolCall.name,
        arguments: JSON.stringify(event.toolCall.arguments ?? {}),
        complete: !event.toolCall.argumentsError
      },
      failed: false
    }
  }
  if (event.type === 'error' && event.reason !== 'aborted') return { text: '', call: null, failed: true }
  return { text: '', call: null, failed: false }
}
