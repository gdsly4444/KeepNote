export function workTemplate(day: string): string {
  return document('work', [`# ${day}`, '', '## 在做', '', '## 记录', '', '## 产出', '', '## 留下'])
}

export function journalTemplate(day: string, time: string): string {
  return document('journal', [`# ${day}`, '', `## ${time}`])
}

export function appendJournalEntry(source: string, time: string, text: string): string {
  const lines = source.replace(/\n+$/, '').split('\n')
  let heading = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('## ')) heading = index
  }
  const entry = [`## ${time}`, '', text]
  if (heading >= 0 && lines.slice(heading + 1).every((line) => line.trim() === '')) {
    return finish([...lines.slice(0, heading), ...entry])
  }
  return finish([...lines, '', ...entry])
}

export function noteTemplate(type: 'essay' | 'list' | 'tech', title: string): string {
  return document(type, [`# ${title}`])
}

export function setSection(text: string, heading: string, body: string): string | null {
  const lines = text.split('\n')
  const range = sectionRange(lines, heading)
  if (!range) return null
  const following = lines[range.end]
  const tail = following?.startsWith('## ') ? ['', ...lines.slice(range.end)] : lines.slice(range.end)
  return finish([...lines.slice(0, range.start + 1), '', body, ...tail])
}

export function appendSection(text: string, heading: string, line: string): string | null {
  const lines = text.split('\n')
  const range = sectionRange(lines, heading)
  if (!range) return null
  let end = range.end
  while (end > range.start + 1 && lines[end - 1] === '') end -= 1
  const following = lines[range.end]
  const before = end === range.start + 1 ? [''] : []
  const after = following?.startsWith('## ') ? [''] : []
  return finish([
    ...lines.slice(0, range.start + 1),
    ...before,
    ...lines.slice(range.start + 1, end),
    line,
    ...after,
    ...lines.slice(range.end)
  ])
}

function document(type: string, body: readonly string[]): string {
  return finish(['---', `type: ${type}`, '---', '', ...body])
}

function sectionRange(lines: readonly string[], heading: string): { start: number; end: number } | null {
  const start = lines.indexOf(`## ${heading}`)
  if (start < 0) return null
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index
      break
    }
  }
  return { start, end }
}

function finish(lines: readonly string[]): string {
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}
