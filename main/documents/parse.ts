import { normalizeNewlines } from '../platform'
import type { DocumentType, MarkdownDocument, OutlineItem, TypeSource } from '../../shared'

const documentTypes: readonly DocumentType[] = ['work', 'essay', 'journal', 'list', 'tech']

export function parseMarkdown(file: { path: string; name: string }, source: string): MarkdownDocument {
  const text = normalizeNewlines(source)
  const type = readType(text)
  const outline = readOutline(withoutFrontmatter(text))
  return {
    kind: 'markdown',
    path: file.path,
    name: file.name,
    type: type.value,
    typeSource: type.source,
    title: readTitle(file.name, type.value, outline),
    body: text,
    outline
  }
}

function readType(text: string): { value: DocumentType; source: TypeSource } {
  const block = frontmatter(text)
  if (block === null) return { value: 'essay', source: 'default' }
  for (const line of block.split('\n')) {
    const match = /^type:\s*['"]?([A-Za-z]+)['"]?\s*$/.exec(line.trim())
    if (!match) continue
    const value = match[1]
    if (isDocumentType(value)) return { value, source: 'marked' }
    return { value: 'essay', source: 'default' }
  }
  return { value: 'essay', source: 'default' }
}

function isDocumentType(value: string): value is DocumentType {
  return documentTypes.some((type) => type === value)
}

function frontmatter(text: string): string | null {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---', 4)
  if (end === -1) return null
  return text.slice(4, end)
}

function withoutFrontmatter(text: string): string {
  if (!text.startsWith('---\n')) return text
  const end = text.indexOf('\n---', 4)
  if (end === -1) return text
  return text.slice(end + 4).replace(/^\n/, '')
}

function readOutline(text: string): OutlineItem[] {
  const outline: OutlineItem[] = []
  let fenced = false
  for (const line of text.split('\n')) {
    if (line.startsWith('```') || line.startsWith('~~~')) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const match = /^(#{1,6})[ \t]+(.*)$/.exec(line)
    if (!match) continue
    const heading = match[2].trim().replace(/\s+#+\s*$/, '')
    if (!heading) continue
    outline.push({ level: match[1].length, text: heading })
  }
  return outline
}

function readTitle(name: string, type: DocumentType, outline: OutlineItem[]): string {
  const stem = name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name
  if ((type === 'work' || type === 'journal') && /^\d{4}-\d{2}-\d{2}$/.test(stem)) return stem
  return outline.find((item) => item.level === 1)?.text ?? stem
}
