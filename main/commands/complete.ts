import type { CompletionItem } from '../../shared'

interface NamedNote {
  title: string
  name: string
}

const commands: readonly { name: string; value: string }[] = [
  { name: 'today', value: 'today' },
  { name: 'diary', value: 'diary ' },
  { name: 'log', value: 'log ' },
  { name: 'now', value: 'now ' },
  { name: 'leave', value: 'leave ' },
  { name: 'new', value: 'new ' },
  { name: 'open', value: 'open ' },
  { name: 'accept', value: 'accept ' },
  { name: 'ask', value: 'ask ' }
]

const types = ['essay', 'journal', 'list', 'tech', 'work'] as const

export function completeLine(text: string, notes: readonly NamedNote[]): CompletionItem[] {
  const trimmed = text.trimStart()
  if (!trimmed.trim()) return []
  const gap = trimmed.indexOf(' ')
  if (gap === -1) {
    const needle = trimmed.trim().toLowerCase()
    const named = commands
      .filter((command) => command.name.startsWith(needle))
      .map((command) => ({ kind: 'command' as const, label: command.name, value: command.value }))
    return [...named, ...matchNotes(needle, notes).map((item) => ({ ...item, value: `open ${item.label}` }))].slice(0, 8)
  }
  const name = trimmed.slice(0, gap)
  const rest = trimmed.slice(gap + 1).trim().toLowerCase()
  if (name === 'new') {
    return types
      .filter((type) => type.startsWith(rest))
      .map((type) => ({ kind: 'type', label: type, value: `new ${type} ` }))
  }
  if ((name === 'open' || name === 'accept') && rest) {
    return matchNotes(rest, notes)
      .map((item) => ({ ...item, value: `${name} ${item.label}` }))
      .slice(0, 8)
  }
  return []
}

function matchNotes(needle: string, notes: readonly NamedNote[]): CompletionItem[] {
  if (!needle) return []
  const items: CompletionItem[] = []
  for (const note of notes) {
    const stem = note.name.replace(/\.md$/i, '')
    const byTitle = note.title.toLowerCase().startsWith(needle)
    const byName = stem.toLowerCase().startsWith(needle)
    if (!byTitle && !byName) continue
    const label = byTitle ? note.title : stem
    if (items.some((item) => item.label === label)) continue
    items.push({ kind: 'note', label, value: label })
  }
  return items
}
