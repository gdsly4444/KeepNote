import { describe, expect, it } from 'vitest'
import type { DocumentType, Proposal } from '../../shared'
import type { ModelClient, ModelMessage, ModelToolCall } from '../model'
import { createAgent, type AgentAsk, type AgentSession } from './index'

const essay = ['---', 'type: essay', '---', '', '# 决定', '', '秘密正文', '', '## 背景', '', '选区里的句子', ''].join('\n')

describe('agent loop', () => {
  it('asks with the outline and selection, and reads a section instead of the whole note', async () => {
    const notes = files({ '决定.md': essay })
    const seen: ModelMessage[][] = []
    const agent = session(notes, script(seen, [
      call('readSection', { path: '决定.md', heading: '背景' }),
      done()
    ]))
    await agent.ask(request('解释这一节'))
    expect(seen[0]?.map((message) => message.text).join('\n')).not.toContain('秘密正文')
    expect(seen[0]?.[0]?.text).toContain('背景')
    expect(seen[0]?.[0]?.text).toContain('选区里的句子')
    expect(agent.view().reads).toEqual(['决定.md'])
    expect(agent.history().find((record) => record.role === 'tool')?.text).toContain('选区里的句子')
    expect(agent.history().find((record) => record.role === 'tool')?.text).not.toContain('秘密正文')
    expect(notes.reads).toEqual(['决定.md'])
  })

  it('searches the index without reading note bodies and refuses a path outside the vault', async () => {
    const notes = files({ '决定.md': essay })
    const agent = session(notes, script([], [
      call('searchNotes', { query: '决定' }),
      call('shell', { command: 'ls' }),
      call('readSection', { path: '../secret.md', heading: '背景' }),
      done()
    ]))
    await agent.ask(request('找决定'))
    expect(notes.reads).toEqual([])
    expect(agent.view().reads).toEqual([])
  })

  it('does not run a tool whose arguments were cut off', async () => {
    const notes = files({ '决定.md': essay })
    const agent = session(notes, {
      id: 'cut',
      async complete() {
        return { text: '', calls: [{ name: 'proposeDiff', arguments: '{"groups":', complete: false }] }
      }
    })
    const result = await agent.ask(request('改写'))
    expect(result.proposal).toBeNull()
    expect(notes.reads).toEqual([])
  })

  it('cancels the request and leaves every file unwritten', async () => {
    const notes = files({ '决定.md': essay })
    let release: () => void = () => undefined
    const agent = session(notes, {
      id: 'slow',
      complete(input) {
        return new Promise((_resolve, reject) => {
          release = () => reject(new Error('已取消'))
          input.signal.addEventListener('abort', release)
        })
      }
    })
    const pending = agent.ask(request('改写'))
    agent.cancel()
    const result = await pending
    expect(result.message).toBe('已取消')
    expect(result.proposal).toBeNull()
    expect(notes.writes).toEqual([])
  })

  it('keeps a tool call with its result when the next request is compressed', async () => {
    const notes = files({ '决定.md': essay })
    const seen: ModelMessage[][] = []
    const agent = session(notes, script(seen, [
      call('readSection', { path: '决定.md', heading: '背景' }),
      done(),
      done()
    ]), 30)
    await agent.ask(request('先读'))
    await agent.ask(request('再问'))
    const packed = seen.at(-1)?.map((message) => message.text).join('\n') ?? ''
    const named = packed.includes('readSection')
    expect(named).toBe(packed.includes('选区里的句子'))
    expect(agent.history().some((record) => record.role === 'tool' && record.folded && record.text.includes('readSection') && record.text.includes('选区里的句子'))).toBe(true)
  })

  it('returns the same diff from the command line, the sidebar, and the selection bar', async () => {
    const agent = session(files({ '决定.md': essay }), fixedDiff())
    const proposals: Proposal[] = []
    for (const entry of ['command', 'sidebar', 'selection'] as const) {
      const result = await agent.ask({ ...request('把这句改短'), entry, selection: '选区里的句子' })
      if (result.proposal) proposals.push(result.proposal)
    }
    expect(agent.history().filter((record) => record.role === 'user').map((record) => record.text)).toEqual([
      expect.stringContaining('入口: command'),
      expect.stringContaining('入口: sidebar'),
      expect.stringContaining('入口: selection')
    ])
    expect(proposals).toHaveLength(3)
    expect(proposals.map((item) => item.groups.map((group) => ({ unit: group.unit, before: group.before, after: group.after })))).toEqual([
      [{ unit: 'paragraph', before: '选区里的句子', after: '短句' }],
      [{ unit: 'paragraph', before: '选区里的句子', after: '短句' }],
      [{ unit: 'paragraph', before: '选区里的句子', after: '短句' }]
    ])
  })

  it('keeps a discarded proposal and does not write it', async () => {
    const notes = files({ '决定.md': essay })
    const agent = session(notes, fixedDiff())
    await agent.ask(request('把这句改短'))
    agent.discard()
    expect(agent.pending()).toBeNull()
    expect(agent.view().kept[0]?.groups[0]?.after).toBe('短句')
    expect(notes.writes).toEqual([])
  })

  it('turns list prose and a tech page of only prose into a conversion preview', async () => {
    const list = await propose(files({}), 'list', call('proposeDiff', {
      groups: [{ unit: 'task', before: '- [ ] 旧', after: '这是一段无法勾选的散文' }]
    }))
    expect(list.proposal?.groups).toEqual([])
    expect(list.proposal?.conversion).toMatchObject({ to: 'essay', preview: '这是一段无法勾选的散文' })

    const tech = await propose(files({}), 'tech', call('proposeDiff', {
      groups: [{ unit: 'lines', before: '```sh\nls\n```', after: '改成一篇只有段落的页面' }]
    }))
    expect(tech.proposal?.groups).toEqual([])
    expect(tech.proposal?.conversion?.to).toBe('essay')
  })

  it('offers a new note instead of converting a work record', async () => {
    const notes = files({ 'work/2026/11/2026-11-14.md': '# 2026-11-14\n\n## 记录\n' })
    const result = await propose(notes, 'work', call('proposeDiff', {
      conversion: 'list',
      groups: [{ unit: 'task', before: '在做', after: '- [ ] 另做' }]
    }))
    expect(result.proposal?.conversion).toBeNull()
    expect(result.proposal?.path).toBe('另存.md')
    expect(result.proposal?.groups[0]?.before).toBe('')
    expect(notes.writes).toEqual([])
  })

  it('uses the same tools when the model client is swapped', async () => {
    const first = await propose(files({ '决定.md': essay }), 'essay', call('proposeDiff', {
      groups: [{ unit: 'paragraph', before: '选区里的句子', after: '短句' }]
    }), 'alpha')
    const second = await propose(files({ '决定.md': essay }), 'essay', call('proposeDiff', {
      groups: [{ unit: 'paragraph', before: '选区里的句子', after: '短句' }]
    }), 'beta')
    expect(first.proposal?.groups.map((group) => group.after)).toEqual(second.proposal?.groups.map((group) => group.after))
  })
})

function request(text: string): AgentAsk {
  return { text, path: '决定.md', type: 'essay', outline: '决定\n背景', selection: '选区里的句子', entry: 'command' }
}

function propose(
  notes: ReturnType<typeof files>,
  type: DocumentType,
  tool: ModelToolCall,
  id = 'fake'
): Promise<{ proposal: Proposal | null }> {
  const agent = session(notes, {
    id,
    async complete() {
      return { text: '', calls: [tool] }
    }
  })
  return agent.ask({ ...request('整理'), type, path: type === 'work' ? 'work/2026/11/2026-11-14.md' : '决定.md' })
}

function session(notes: ReturnType<typeof files>, model: ModelClient, budget = 8000): AgentSession {
  return createAgent({
    model,
    notes,
    search: () => [{ path: '决定.md', title: '决定' }],
    todayPath: () => 'work/2026/11/2026-11-14.md',
    time: () => '10:12',
    budget
  })
}

function files(seed: Record<string, string>): {
  read(path: string): Promise<string | null>
  reads: string[]
  writes: string[]
} {
  const reads: string[] = []
  const writes: string[] = []
  return {
    reads,
    writes,
    async read(path) {
      reads.push(path)
      return seed[path] ?? null
    }
  }
}

function call(name: string, args: Record<string, unknown>): ModelToolCall {
  return { name, arguments: JSON.stringify(args), complete: true }
}

function done(): ModelToolCall {
  return { name: 'none', arguments: '{}', complete: true }
}

function script(seen: ModelMessage[][], steps: ModelToolCall[]): ModelClient {
  let cursor = 0
  return {
    id: 'script',
    async complete(input) {
      seen.push(input.messages.map((message) => ({ ...message })))
      const step = steps[cursor]
      cursor += 1
      if (!step || step.name === 'none') return { text: step ? '好' : '', calls: [] }
      return { text: '', calls: [step] }
    }
  }
}

function fixedDiff(): ModelClient {
  return {
    id: 'fixed',
    async complete() {
      return {
        text: '',
        calls: [call('proposeDiff', { groups: [{ unit: 'paragraph', before: '选区里的句子', after: '短句' }] })]
      }
    }
  }
}
