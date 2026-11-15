import type { CommandArgs, CommandName, DocumentType } from '../../../shared'

const names = ['today', 'diary', 'log', 'now', 'leave', 'new', 'open'] as const

type LineCommand = (typeof names)[number]

export function readCommandLine(input: string): { command: CommandName; args: CommandArgs } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const gap = trimmed.indexOf(' ')
  const name = gap === -1 ? trimmed : trimmed.slice(0, gap)
  const rest = gap === -1 ? '' : trimmed.slice(gap + 1).trim()
  if (!isCommand(name)) return null
  if (name === 'today') return rest ? null : { command: 'today', args: {} }
  if (name === 'diary' || name === 'log' || name === 'now' || name === 'leave') {
    return { command: name, args: rest ? { text: rest } : {} }
  }
  if (name === 'open') return rest ? { command: 'open', args: { path: rest } } : { command: 'open', args: {} }
  return readNew(rest)
}

function readNew(rest: string): { command: CommandName; args: CommandArgs } | null {
  const gap = rest.indexOf(' ')
  const type = gap === -1 ? rest : rest.slice(0, gap)
  const title = gap === -1 ? '' : rest.slice(gap + 1).trim()
  if (!isType(type)) return null
  return { command: 'new', args: title ? { type, title } : { type } }
}

function isCommand(value: string): value is LineCommand {
  return names.some((name) => name === value)
}

function isType(value: string): value is DocumentType {
  return value === 'work' || value === 'essay' || value === 'journal' || value === 'list' || value === 'tech'
}
