import type { BridgeResult, CommandArgs, CommandSuccess, DocumentType, MarkdownDocument } from '../../shared'
import { baseName, normalizeNewlines, portablePath, samePath } from '../platform'
import type { ListedFile } from '../vault'
import { appendSection, journalTemplate, noteTemplate, setSection, workTemplate } from './text'

const documentTypes = ['work', 'essay', 'journal', 'list', 'tech'] as const

export interface CommandClock {
  today(): string
  time(): string
}

export interface NoteStore {
  listFiles(root: string): Promise<ListedFile[]>
  readMarkdown(root: string, relativePath: string): Promise<string>
  writeMarkdown(root: string, relativePath: string, text: string): Promise<void>
}

export interface CommandTools {
  root: string
  clock: CommandClock
  notes: NoteStore
  parse(file: { path: string; name: string }, source: string): MarkdownDocument
}

export interface RegisteredCommand {
  name: string
  appliesTo: 'any' | readonly DocumentType[]
  run(args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>>
}

export interface CommandRegistry {
  execute(name: string, args?: CommandArgs): Promise<BridgeResult<CommandSuccess>>
  register(command: RegisteredCommand): void
}

export interface CommandDeps {
  notes: NoteStore
  parse: CommandTools['parse']
  root(): string | null
  clock: CommandClock
}

export function systemClock(): CommandClock {
  return {
    today() {
      const now = new Date()
      return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
    },
    time() {
      const now = new Date()
      return `${two(now.getHours())}:${two(now.getMinutes())}`
    }
  }
}

export function createCommandRegistry(deps: CommandDeps): CommandRegistry {
  const table = new Map<string, RegisteredCommand>()

  const register = (command: RegisteredCommand): void => {
    table.set(command.name, command)
  }

  register({ name: 'today', appliesTo: 'any', run: runToday })
  register({ name: 'diary', appliesTo: 'any', run: runDiary })
  register({ name: 'new', appliesTo: 'any', run: runNew })
  register({ name: 'open', appliesTo: 'any', run: runOpen })
  register({ name: 'now', appliesTo: 'any', run: runNow })
  register({ name: 'leave', appliesTo: 'any', run: runLeave })
  register({ name: 'log', appliesTo: 'any', run: runLog })

  return {
    register,
    async execute(name, args) {
      const command = table.get(name)
      if (!command) return fail('unknown-command', '未知命令')
      const root = deps.root()
      if (!root) return fail('library-closed', '还没有打开库')
      const tools: CommandTools = { root, clock: deps.clock, notes: deps.notes, parse: deps.parse }
      try {
        const input = readArgs(args)
        if (command.appliesTo !== 'any') {
          if (!input.currentPath) return fail('wrong-type', '这条命令需要当前文档')
          const current = await readNote(tools, input.currentPath)
          if (!current.ok) return current
          if (!command.appliesTo.includes(current.value.type)) {
            return fail('wrong-type', '这条命令不用于这种文档')
          }
        }
        return await command.run(input, tools)
      } catch (error) {
        return fail('command-failed', readable(error))
      }
    }
  }
}

async function runToday(_args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  const day = tools.clock.today()
  const note = await ensureDaily(tools, 'work', workTemplate(day))
  if (!note.ok) return note
  return done(tools, note.value, note.value.created ? '写下了今天的工作记录' : '今天的工作记录已经在了')
}

async function runDiary(_args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  const day = tools.clock.today()
  const note = await ensureDaily(tools, 'journal', journalTemplate(day, tools.clock.time()))
  if (!note.ok) return note
  return done(tools, note.value, note.value.created ? '写下了今天的日记' : '今天的日记已经在了')
}

async function runNew(args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  if (args.type === 'work') return runToday(args, tools)
  if (args.type === 'journal') return runDiary(args, tools)
  if (args.type !== 'essay' && args.type !== 'list' && args.type !== 'tech') {
    return fail('invalid-type', '不认识这个类型')
  }
  const heading = fileHeading(args.title)
  if (!heading) {
    return sentence(args.title) ? fail('invalid-title', '这个标题不能当作文件名') : fail('missing-title', '缺少标题')
  }
  const relative = portablePath(`${heading}.md`)
  const existing = await findFile(tools, relative)
  if (existing === 'many') return fail('ambiguous', '有多篇同名')
  if (existing) return fail('already-exists', '已经有同名文档')
  const source = noteTemplate(args.type, heading)
  await tools.notes.writeMarkdown(tools.root, relative, source)
  return { ok: true, value: { path: relative, title: heading, created: true, message: `写下了「${heading}」` } }
}

async function runOpen(args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  if (!args.path) return fail('missing-path', '缺少要打开的文档')
  const note = await readNote(tools, args.path)
  if (!note.ok) return note
  return {
    ok: true,
    value: { path: note.value.path, title: note.value.title, created: false, message: `打开了「${note.value.title}」` }
  }
}

async function runNow(args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  const text = sentence(args.text)
  if (!text) return fail('missing-text', '缺少要改的内容')
  return editToday(tools, (source) => setSection(source, '在做', text), '改了今天的在做', '这篇里没有「在做」')
}

async function runLeave(args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  const text = sentence(args.text)
  if (!text) return fail('missing-text', '缺少要留下的内容')
  return editToday(
    tools,
    (source) => appendSection(source, '留下', `- [ ] ${text}`),
    '留在今天的工作记录里',
    '这篇里没有「留下」'
  )
}

async function runLog(args: CommandArgs, tools: CommandTools): Promise<BridgeResult<CommandSuccess>> {
  const text = sentence(args.text)
  if (!text) return fail('missing-text', '缺少要记的内容')
  const time = tools.clock.time()
  let title: string | undefined
  if (args.currentPath) {
    const current = await readNote(tools, args.currentPath)
    if (!current.ok) return current
    title = current.value.title
  }
  const link = title ? ` [[${title}]]` : ''
  return editToday(
    tools,
    (source) => appendSection(source, '记录', `- ${time} ${text}${link}`),
    `${time} 已记入今天`,
    '这篇里没有「记录」'
  )
}

async function editToday(
  tools: CommandTools,
  change: (source: string) => string | null,
  message: string,
  missing: string
): Promise<BridgeResult<CommandSuccess>> {
  const note = await loadDaily(tools, 'work', workTemplate(tools.clock.today()))
  if (!note.ok) return note
  const next = change(note.value.source)
  if (!next) return fail('missing-section', missing)
  await tools.notes.writeMarkdown(tools.root, note.value.path, next)
  return done(tools, { ...note.value, source: next }, message)
}

async function ensureDaily(
  tools: CommandTools,
  folder: 'work' | 'journal',
  template: string
): Promise<BridgeResult<{ path: string; source: string; created: boolean }>> {
  const note = await loadDaily(tools, folder, template)
  if (!note.ok) return note
  if (note.value.created) await tools.notes.writeMarkdown(tools.root, note.value.path, note.value.source)
  return note
}

async function loadDaily(
  tools: CommandTools,
  folder: 'work' | 'journal',
  template: string
): Promise<BridgeResult<{ path: string; source: string; created: boolean }>> {
  const relative = dailyPath(folder, tools.clock.today())
  const existing = await findFile(tools, relative)
  if (existing === 'many') return fail('ambiguous', '有多篇同名')
  if (!existing) return { ok: true, value: { path: relative, source: template, created: true } }
  if (!existing.markdown) return fail('not-markdown', '这不是笔记')
  const source = normalizeNewlines(await tools.notes.readMarkdown(tools.root, existing.path))
  return { ok: true, value: { path: existing.path, source, created: false } }
}

function dailyPath(folder: 'work' | 'journal', day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const year = match?.[1]
  const month = match?.[2]
  if (!year || !month) throw new Error('日期无效')
  return portablePath(folder, year, month, `${day}.md`)
}

async function findFile(tools: CommandTools, relativePath: string): Promise<ListedFile | 'many' | null> {
  const files = await tools.notes.listFiles(tools.root)
  const matches = files.filter((file) => samePath(file.path, relativePath))
  if (matches.length > 1) return 'many'
  return matches[0] ?? null
}

async function readNote(
  tools: CommandTools,
  relativePath: string
): Promise<BridgeResult<{ path: string; source: string; title: string; type: DocumentType }>> {
  const found = await findFile(tools, relativePath)
  if (found === 'many') return fail('ambiguous', '有多篇同名')
  if (!found) return fail('not-found', '没有这篇')
  if (!found.markdown) return fail('not-markdown', '这不是笔记')
  const source = normalizeNewlines(await tools.notes.readMarkdown(tools.root, found.path))
  const parsed = tools.parse({ path: found.path, name: found.name }, source)
  return { ok: true, value: { path: found.path, source, title: parsed.title, type: parsed.type } }
}

function done(
  tools: CommandTools,
  note: { path: string; source: string; created: boolean },
  message: string
): BridgeResult<CommandSuccess> {
  const parsed = tools.parse({ path: note.path, name: baseName(note.path) }, note.source)
  return { ok: true, value: { path: note.path, title: parsed.title, created: note.created, message } }
}

function fileHeading(title: string | undefined): string | null {
  const heading = title?.trim().replace(/\.md$/i, '') ?? ''
  if (heading === '' || heading === '.' || heading === '..') return null
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(heading) || heading.endsWith('.') || heading.endsWith(' ')) return null
  return heading
}

function sentence(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text === '' ? null : text
}

function readArgs(value: CommandArgs | undefined): CommandArgs {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    text: stringField(record.text),
    type: isDocumentType(record.type) ? record.type : undefined,
    title: stringField(record.title),
    path: present(stringField(record.path)),
    currentPath: present(stringField(record.currentPath))
  }
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function present(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && documentTypes.some((type) => type === value)
}

function fail(code: string, message: string): BridgeResult<never> {
  return { ok: false, code, message }
}

function readable(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '命令没有完成'
}

function two(value: number): string {
  return String(value).padStart(2, '0')
}
