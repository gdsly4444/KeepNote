import type { DocumentType, LibraryEntry, MarkdownDocument, OutlineItem } from '../../../shared'

export interface CodeMark {
  language: string
  firstLine: string
  line: number
}

export interface ContextItem {
  id: string
  label: string
  kind: 'heading' | 'code'
  text: string
  index: number
  line: number
}

const marks: Record<DocumentType, string> = {
  work: '记录',
  essay: '长文',
  journal: '日记',
  list: '清单',
  tech: '技术'
}

const names: Record<DocumentType, string> = {
  work: '工作记录',
  essay: '长文',
  journal: '日记',
  list: '清单',
  tech: '技术笔记'
}

export function typeMark(type: DocumentType): string {
  return marks[type]
}

export function typeName(type: DocumentType): string {
  return names[type]
}

export function recentNotes(
  entries: readonly LibraryEntry[],
  type: 'work' | 'journal',
  limit = 7
): MarkdownDocument[] {
  return entries
    .filter((entry): entry is MarkdownDocument => {
      return entry.kind === 'markdown' && entry.type === type && /^\d{4}-\d{2}-\d{2}$/.test(entry.title)
    })
    .sort((left, right) => {
      if (left.title === right.title) return 0
      return left.title < right.title ? 1 : -1
    })
    .slice(0, limit)
}

export function fileKind(name: string): 'image' | 'pdf' | 'file' {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'gif' || extension === 'webp' || extension === 'svg') {
    return 'image'
  }
  if (extension === 'pdf') return 'pdf'
  return 'file'
}

export function contextItems(
  type: DocumentType,
  outline: readonly OutlineItem[],
  blocks: readonly CodeMark[]
): ContextItem[] {
  const headings = outline.filter((item) => type === 'essay' || type === 'tech' || type === 'list' || item.level >= 2)
  const seen = new Map<string, number>()
  const items = headings.map((item, position) => {
    const index = seen.get(item.text) ?? 0
    seen.set(item.text, index + 1)
    return {
      id: `heading-${position}`,
      label: item.text,
      kind: 'heading' as const,
      text: item.text,
      index,
      line: 0
    }
  })
  if (type !== 'tech') return items
  return [
    ...items,
    ...blocks.map((block, index) => ({
      id: `code-${index}`,
      label: block.language ? `${block.language} ${block.firstLine}` : block.firstLine,
      kind: 'code' as const,
      text: block.firstLine,
      index,
      line: block.line
    }))
  ]
}

export function contextEmpty(type: DocumentType): string {
  if (type === 'journal') return '还没有条目'
  if (type === 'list') return '还没有分组'
  if (type === 'tech') return '还没有代码块'
  return '还没有大纲'
}
