export interface WorkEntry {
  kind: 'entry'
  time: string
  text: string
  link: string
}

export interface WorkRaw {
  kind: 'raw'
  text: string
}

export type WorkRecord = WorkEntry | WorkRaw

export interface WorkOutput {
  title: string
  linked: boolean
}

export interface WorkTask {
  checked: boolean
  text: string
}

export interface WorkNote {
  head: string
  date: string
  doing: string
  records: WorkRecord[]
  output: WorkOutput[]
  left: WorkTask[]
}

export function parseWork(body: string): WorkNote {
  const split = splitFrontmatter(body)
  const lines = split.content.replace(/\n+$/, '').split('\n')
  let date = ''
  let start = 0
  if (lines[0]?.startsWith('# ')) {
    date = lines[0].slice(2).trim()
    start = lines[1] === '' ? 2 : 1
  }
  const buckets = { 在做: [] as string[], 记录: [] as string[], 产出: [] as string[], 留下: [] as string[] }
  let current: keyof typeof buckets | null = null
  for (const line of lines.slice(start)) {
    const name = sectionName(line)
    if (name) {
      current = name
      continue
    }
    if (current) buckets[current].push(line)
  }
  return {
    head: split.head,
    date,
    doing: buckets.在做.join('\n').trim(),
    records: parseRecords(buckets.记录),
    output: parseOutput(buckets.产出),
    left: parseTasks(buckets.留下)
  }
}

export function serializeWork(note: WorkNote): string {
  const blocks = [
    [`# ${note.date}`],
    block('在做', note.doing ? [note.doing] : []),
    block('记录', note.records.map(recordLine)),
    block('产出', note.output.map((item) => (item.linked ? `- [[${item.title}]]` : `- ${item.title}`))),
    block('留下', note.left.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`))
  ]
  return `${note.head}${blocks.map((lines) => lines.join('\n')).join('\n\n')}\n`
}

function sectionName(line: string): '在做' | '记录' | '产出' | '留下' | null {
  const match = /^## (在做|记录|产出|留下)$/.exec(line)
  if (match?.[1] === '在做' || match?.[1] === '记录' || match?.[1] === '产出' || match?.[1] === '留下') return match[1]
  return null
}

function parseRecords(lines: readonly string[]): WorkRecord[] {
  const records: WorkRecord[] = []
  for (const line of lines) {
    if (line.trim() === '') continue
    const match = /^- (\d{2}:\d{2}) (.*)$/.exec(line)
    if (!match) {
      records.push({ kind: 'raw', text: line })
      continue
    }
    const rest = match[2] ?? ''
    const link = /^(.*) \[\[(.+)\]\]$/.exec(rest)
    records.push({
      kind: 'entry',
      time: match[1] ?? '',
      text: link?.[1] ?? rest,
      link: link?.[2] ?? ''
    })
  }
  return records
}

function parseOutput(lines: readonly string[]): WorkOutput[] {
  const output: WorkOutput[] = []
  for (const line of lines) {
    if (line.trim() === '') continue
    const linked = /^- \[\[(.+)\]\]$/.exec(line)
    if (linked?.[1]) {
      output.push({ title: linked[1], linked: true })
      continue
    }
    const plain = /^- (.+)$/.exec(line)
    if (plain?.[1]) output.push({ title: plain[1], linked: false })
  }
  return output
}

function parseTasks(lines: readonly string[]): WorkTask[] {
  const tasks: WorkTask[] = []
  for (const line of lines) {
    const match = /^- \[([ x])\] (.*)$/.exec(line)
    if (!match) continue
    tasks.push({ checked: match[1] === 'x', text: match[2] ?? '' })
  }
  return tasks
}

function recordLine(record: WorkRecord): string {
  if (record.kind === 'raw') return record.text
  const link = record.link ? ` [[${record.link}]]` : ''
  return `- ${record.time} ${record.text}${link}`
}

export interface WorkField {
  section: 'doing' | 'record' | 'output' | 'left'
  index: number
}

export function lineForField(source: string, field: WorkField): number {
  const heading = sectionHeading(field.section)
  const lines = source.split('\n')
  let inSection = false
  let seen = -1
  let headingLine = 0
  for (let line = 0; line < lines.length; line += 1) {
    const text = lines[line] ?? ''
    if (isSectionHeading(text)) {
      inSection = text === heading
      if (text === heading) headingLine = line
      continue
    }
    if (!inSection || text.trim() === '') continue
    if (field.section === 'doing') return line
    if (field.section === 'output' && !text.startsWith('- ')) continue
    if (field.section === 'left' && !taskLine.test(text)) continue
    seen += 1
    if (seen === field.index) return line
  }
  return headingLine
}

export function fieldForLine(source: string, line: number): WorkField {
  const lines = source.split('\n')
  let section: WorkField['section'] = 'doing'
  let record = -1
  let output = -1
  let left = -1
  for (let index = 0; index <= line && index < lines.length; index += 1) {
    const text = lines[index] ?? ''
    if (text === '## 在做') section = 'doing'
    else if (text === '## 记录') section = 'record'
    else if (text === '## 产出') section = 'output'
    else if (text === '## 留下') section = 'left'
    else if (text.trim() !== '') {
      if (section === 'record') record += 1
      if (section === 'output' && text.startsWith('- ')) output += 1
      if (section === 'left' && taskLine.test(text)) left += 1
    }
  }
  if (section === 'record') return { section, index: Math.max(record, 0) }
  if (section === 'output') return { section, index: Math.max(output, 0) }
  if (section === 'left') return { section, index: Math.max(left, 0) }
  return { section: 'doing', index: 0 }
}

export function sourceLineAt(source: string, offset: number): number {
  const lines = source.split('\n')
  let cursor = 0
  for (let line = 0; line < lines.length; line += 1) {
    const next = cursor + (lines[line]?.length ?? 0) + 1
    if (offset < next) return line
    cursor = next
  }
  return Math.max(lines.length - 1, 0)
}

export function sourceOffset(source: string, line: number): number {
  const lines = source.split('\n')
  const safe = Math.min(Math.max(line, 0), Math.max(lines.length - 1, 0))
  let offset = 0
  for (let index = 0; index < safe; index += 1) offset += (lines[index]?.length ?? 0) + 1
  return offset
}

const taskLine = /^- \[[ x]\] /

function sectionHeading(section: WorkField['section']): string {
  if (section === 'doing') return '## 在做'
  if (section === 'record') return '## 记录'
  if (section === 'output') return '## 产出'
  return '## 留下'
}

function isSectionHeading(text: string): boolean {
  return text === '## 在做' || text === '## 记录' || text === '## 产出' || text === '## 留下'
}

function block(title: string, lines: readonly string[]): string[] {
  if (lines.length === 0) return [`## ${title}`]
  return [`## ${title}`, '', ...lines]
}

function splitFrontmatter(body: string): { head: string; content: string } {
  const text = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.startsWith('---\n')) return { head: '', content: text }
  const close = text.indexOf('\n---', 3)
  if (close === -1) return { head: '', content: text }
  let end = close + 4
  if (text[end] === '\n') end += 1
  if (text[end] === '\n') end += 1
  return { head: text.slice(0, end), content: text.slice(end) }
}
