import { samePath } from '../platform'
import type { ChangedNote, ChangedView } from '../../shared'

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

export function outputTitles(source: string): string[] {
  const lines = source.split('\n')
  const range = sectionRange(lines, '产出')
  if (!range) return []
  const titles: string[] = []
  for (const line of lines.slice(range.start + 1, range.end)) {
    const match = /^- \[\[(.+)\]\]$/.exec(line.trim())
    if (match?.[1]) titles.push(match[1])
  }
  return titles
}

export function classifyChanged(
  changed: readonly ChangedNote[],
  recorded: readonly string[],
  workPath: string,
  known: readonly ChangedNote[]
): ChangedView {
  const recordedTitles = new Set(recorded)
  const pending = changed.filter((note) => !samePath(note.path, workPath) && !recordedTitles.has(note.title))
  const accepted: ChangedNote[] = []
  const seen = new Set<string>()
  for (const title of recorded) {
    if (seen.has(title)) continue
    seen.add(title)
    const found = known.find((note) => note.title === title)
    accepted.push(found ? { path: found.path, title: found.title, type: found.type } : { path: '', title, type: 'essay' })
  }
  return { pending, accepted }
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
