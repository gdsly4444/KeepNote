export interface ListHeading {
  kind: 'heading'
  level: number
  text: string
}

export interface ListTask {
  kind: 'task'
  depth: number
  checked: boolean
  text: string
}

export interface ListLoose {
  kind: 'loose'
  text: string
}

export type ListRow = ListHeading | ListTask | ListLoose

export interface ListNote {
  head: string
  title: string
  rows: ListRow[]
}

export function parseList(body: string): ListNote {
  const split = splitFrontmatter(body)
  const lines = split.content.replace(/\n+$/, '').split('\n')
  let title = ''
  const rows: ListRow[] = []
  for (const line of lines) {
    if (line.trim() === '') continue
    if (!title && rows.length === 0 && line.startsWith('# ')) {
      title = line.slice(2).trim()
      continue
    }
    const heading = /^(#{1,6}) (.*)$/.exec(line)
    if (heading?.[1] && heading[2] !== undefined) {
      rows.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }
    const task = /^( *)- \[([ x])\] (.*)$/.exec(line)
    if (task) {
      rows.push({
        kind: 'task',
        depth: Math.floor((task[1] ?? '').length / 2),
        checked: task[2] === 'x',
        text: task[3] ?? ''
      })
      continue
    }
    rows.push({ kind: 'loose', text: line })
  }
  return { head: split.head, title, rows }
}

export function serializeList(note: ListNote): string {
  const lines: string[] = []
  if (note.title) lines.push(`# ${note.title}`, '')
  for (const row of note.rows) {
    if (row.kind === 'heading' && lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
    lines.push(rowLine(row))
  }
  return `${note.head}${lines.join('\n').replace(/\n+$/, '')}\n`
}

function rowLine(row: ListRow): string {
  if (row.kind === 'heading') return `${'#'.repeat(row.level)} ${row.text}`
  if (row.kind === 'loose') return row.text
  return `${'  '.repeat(row.depth)}- [${row.checked ? 'x' : ' '}] ${row.text}`
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
