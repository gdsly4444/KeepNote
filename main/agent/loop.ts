import type { AgentEntry, AgentEvent, DiffGroup, DiffUnit, DocumentType, Proposal, SessionView } from '../../shared'
import type { ModelClient, ModelMessage } from '../model'

const toolNames = ['readSection', 'searchNotes', 'proposeDiff', 'createNote', 'logWork'] as const

const units: Record<DocumentType, readonly DiffUnit[]> = {
  essay: ['paragraph'],
  work: ['section', 'entry'],
  journal: ['entry'],
  list: ['task'],
  tech: ['lines']
}

export interface AgentRecord {
  role: 'user' | 'assistant' | 'tool' | 'summary'
  text: string
  name: string
  folded: boolean
}

export interface AgentAsk {
  text: string
  path: string
  type: DocumentType
  outline: string
  selection: string
  entry: AgentEntry
}

export interface AgentSession {
  ask(input: AgentAsk): Promise<{ message: string; proposal: Proposal | null }>
  cancel(): void
  discard(): void
  pending(): Proposal | null
  accept(groupId?: string): void
  view(): SessionView
  history(): AgentRecord[]
}

export function createAgent(deps: {
  model: ModelClient
  notes: { read(path: string): Promise<string | null> }
  search(query: string): { path: string; title: string }[]
  todayPath(): string
  time(): string
  budget: number
  onEvent?: (event: AgentEvent) => void
}): AgentSession {
  const records: AgentRecord[] = []
  const kept: Proposal[] = []
  let proposal: Proposal | null = null
  let reads: string[] = []
  let running = false
  let message = ''
  let controller: AbortController | null = null
  let serial = 0

  const emit = (event: AgentEvent): void => {
    deps.onEvent?.(event)
  }

  return {
    ask(input) {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      running = true
      reads = []
      message = ''
      emit(status('running', ''))
      return runTurn(input, signal).finally(() => {
        if (controller?.signal === signal) running = false
      })
    },
    cancel() {
      controller?.abort()
    },
    discard() {
      if (!proposal) return
      kept.push(proposal)
      proposal = null
      message = '已放弃，提议还留着'
    },
    pending() {
      return proposal
    },
    accept(groupId) {
      if (!proposal) return
      const groups = groupId ? proposal.groups.filter((group) => group.id !== groupId) : []
      kept.push(proposal)
      proposal = groups.length > 0 ? { ...proposal, id: nextId(), groups } : null
    },
    view() {
      return {
        turns: records.filter((record) => record.role === 'user' || record.role === 'assistant').map((record) => ({
          role: record.role === 'assistant' ? 'assistant' : 'user',
          text: record.text
        })),
        reads: [...reads],
        proposal,
        kept: kept.map(copyProposal),
        running,
        message
      }
    },
    history() {
      return records.map((record) => ({ ...record }))
    }
  }

  async function runTurn(input: AgentAsk, signal: AbortSignal): Promise<{ message: string; proposal: Proposal | null }> {
    records.push({ role: 'user', text: prompt(input), name: '', folded: false })
    let guard = 0
    while (guard < 4) {
      guard += 1
      if (signal.aborted) return finish('已取消', 'cancelled')
      let turn: { text: string; calls: { name: string; arguments: string; complete: boolean }[] }
      try {
        turn = await deps.model.complete({
          messages: pack(),
          signal,
          onText: (delta) => emit(event('text', delta, '', null, ''))
        })
      } catch (error) {
        if (signal.aborted) return finish('已取消', 'cancelled')
        return finish(error instanceof Error && error.message ? error.message : '模型不可用', 'failed')
      }
      if (signal.aborted) return finish('已取消', 'cancelled')
      if (turn.text) records.push({ role: 'assistant', text: turn.text, name: '', folded: false })
      const calls = turn.calls.filter((call) => call.complete && parseObject(call.arguments))
      if (calls.length === 0) return finish(turn.text || message || '没有要改的地方', 'done')
      for (const call of calls) {
        if (signal.aborted) return finish('已取消', 'cancelled')
        const args = parseObject(call.arguments)
        if (!args) continue
        const before = proposal
        const result = await runTool(input, args, call.name)
        records.push({ role: 'tool', text: `${call.name}\n${result}`, name: call.name, folded: false })
        if (proposal !== before) return finish(result, 'done')
      }
    }
    return finish(message || '这一轮到此为止', 'done')
  }

  async function runTool(input: AgentAsk, args: Record<string, unknown>, name: string): Promise<string> {
    if (!toolNames.some((tool) => tool === name)) return '没有这个工具'
    if (name === 'readSection') return readSection(args)
    if (name === 'searchNotes') return searchNotes(args)
    if (name === 'proposeDiff') return propose(input, args)
    if (name === 'createNote') return create(args)
    return logWork(args)
  }

  async function readSection(args: Record<string, unknown>): Promise<string> {
    const path = stringValue(args.path)
    const heading = stringValue(args.heading)
    if (!path || !insideVault(path)) return '不读库外文件'
    const source = await deps.notes.read(path)
    if (source === null) return '没有这篇'
    rememberRead(path)
    const section = heading ? sectionText(source, heading) : ''
    return section || '这一节是空的'
  }

  function searchNotes(args: Record<string, unknown>): string {
    const query = stringValue(args.query)
    if (!query) return '缺少要找的名字'
    const found = deps.search(query)
    if (found.length === 0) return '没有命中'
    return found.map((note) => `${note.title} ${note.path}`).join('\n')
  }

  function propose(input: AgentAsk, args: Record<string, unknown>): string {
    const wanted = documentType(args.conversion)
    const raw = groupsFrom(args.groups)
    if ((input.type === 'work' || input.type === 'journal') && wanted && wanted !== input.type) {
      proposal = newDocument(wanted, '另存', raw.map((group) => group.after).join('\n\n'))
      emit(event('diff', '', proposal.path, proposal, ''))
      return '工作记录和日记不转换，已另拟一篇'
    }
    proposal = fit(input.type, input.path || proposalPath(input), raw)
    emit(event('diff', '', proposal.path, proposal, ''))
    if (proposal.conversion) return '类型对不上，先不写入'
    return proposal.groups.length > 0 ? '已提出差异' : '没有能放进这篇的改动'
  }

  function create(args: Record<string, unknown>): string {
    const type = documentType(args.type)
    const title = stringValue(args.title)
    const body = stringValue(args.body)
    if (!type || !title) return '缺少类型或标题'
    proposal = newDocument(type, title, body ?? '')
    emit(event('diff', '', proposal.path, proposal, ''))
    return '已提出新文档，还没有写入'
  }

  async function logWork(args: Record<string, unknown>): Promise<string> {
    const text = stringValue(args.text)
    if (!text) return '缺少要记的内容'
    const path = deps.todayPath()
    if (!insideVault(path)) return '不读库外文件'
    const source = await deps.notes.read(path)
    if (source === null || !source.includes('## 记录\n')) return '这篇里没有「记录」'
    rememberRead(path)
    const line = `- ${deps.time()} ${text}`
    proposal = {
      id: nextId(),
      path,
      type: 'work',
      groups: [{ id: nextId(), unit: 'entry', before: '## 记录\n', after: `## 记录\n\n${line}\n` }],
      conversion: null
    }
    emit(event('diff', '', path, proposal, ''))
    return '已提出一条记录，还没有写入'
  }

  function finish(text: string, state: 'done' | 'cancelled' | 'failed'): { message: string; proposal: Proposal | null } {
    message = text
    emit(status(state, text))
    return { message, proposal }
  }

  function rememberRead(path: string): void {
    if (!reads.includes(path)) reads.push(path)
    emit(event('read', '', path, null, ''))
  }

  function pack(): ModelMessage[] {
    compress()
    return records.filter((record) => !record.folded).map((record) => ({
      role: record.role === 'assistant' ? 'assistant' : record.role === 'tool' ? 'tool' : 'user',
      text: record.text,
      name: record.name
    }))
  }

  function compress(): void {
    const size = (): number => records.filter((record) => !record.folded).reduce((total, record) => total + record.text.length, 0)
    if (size() <= deps.budget) return
    const open = records.filter((record) => !record.folded && record.role !== 'summary')
    const fold = open.slice(0, -1)
    if (fold.length === 0) return
    for (const record of fold) record.folded = true
    records.push({ role: 'summary', text: fold.map((record) => record.text).join('\n'), name: '', folded: false })
  }

  function fit(type: DocumentType, path: string, raw: RawGroup[]): Proposal {
    if (type === 'list' && raw.some((group) => !taskBlock(group.after))) {
      return { id: nextId(), path, type, groups: [], conversion: { to: 'essay', preview: raw.map((group) => group.after).join('\n') } }
    }
    if (type === 'tech' && raw.some((group) => group.before.includes('```') && !group.after.includes('```'))) {
      return { id: nextId(), path, type, groups: [], conversion: { to: 'essay', preview: raw.map((group) => group.after).join('\n') } }
    }
    const groups: DiffGroup[] = raw
      .filter((group) => units[type].includes(group.unit))
      .map((group) => ({ id: nextId(), unit: group.unit, before: group.before, after: group.after }))
    return { id: nextId(), path, type, groups, conversion: null }
  }

  function newDocument(type: DocumentType, title: string, body: string): Proposal {
    const safe = title.replace(/[<>:"/\\|?*]/g, '').trim() || '无题'
    return {
      id: nextId(),
      path: `${safe}.md`,
      type,
      groups: [{
        id: nextId(),
        unit: 'section',
        before: '',
        after: `---\ntype: ${type}\n---\n\n# ${safe}\n\n${body}\n`
      }],
      conversion: null
    }
  }

  function nextId(): string {
    serial += 1
    return `d${serial}`
  }
}

function prompt(input: AgentAsk): string {
  return [`入口: ${input.entry}`, `路径: ${input.path}`, `类型: ${input.type}`, `大纲: ${input.outline}`, `选区: ${input.selection}`, `话: ${input.text}`].join('\n')
}

function proposalPath(input: AgentAsk): string {
  return input.path || '未命名.md'
}

function status(state: 'running' | 'done' | 'cancelled' | 'failed', text: string): AgentEvent {
  return event('status', text, '', null, state)
}

function event(kind: AgentEvent['kind'], text: string, path: string, proposal: Proposal | null, state: AgentEvent['state']): AgentEvent {
  return { kind, text, path, proposal, state }
}

function copyProposal(value: Proposal): Proposal {
  return { ...value, groups: value.groups.map((group) => ({ ...group })), conversion: value.conversion ? { ...value.conversion } : null }
}

interface RawGroup {
  unit: DiffUnit
  before: string
  after: string
}

function groupsFrom(value: unknown): RawGroup[] {
  if (!Array.isArray(value)) return []
  const groups: RawGroup[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const unit = diffUnit(record.unit)
    const before = stringValue(record.before)
    const after = stringValue(record.after)
    if (!unit || before === null || after === null) continue
    groups.push({ unit, before, after })
  }
  return groups
}

function taskBlock(text: string): boolean {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.length > 0 && lines.every((line) => /^- \[[ x]\] /.test(line) || /^#{1,6} /.test(line))
}

function sectionText(source: string, heading: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => line.replace(/^#{1,6}\s+/, '').trim() === heading)
  if (start < 0) return ''
  const mark = /^(#{1,6})\s/.exec(lines[start] ?? '')
  const level = mark?.[1]?.length ?? 1
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    const next = /^(#{1,6})\s/.exec(line)
    if (next?.[1] && next[1].length <= level) break
    body.push(line)
  }
  return body.join('\n').trim()
}

function insideVault(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..')
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function documentType(value: unknown): DocumentType | null {
  if (value === 'work' || value === 'essay' || value === 'journal' || value === 'list' || value === 'tech') return value
  return null
}

function diffUnit(value: unknown): DiffUnit | null {
  if (value === 'section' || value === 'entry' || value === 'paragraph' || value === 'task' || value === 'lines') return value
  return null
}
