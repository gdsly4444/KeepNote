export interface TextNode {
  type: 'text'
  text: string
  marks?: { type: 'bold' | 'italic' | 'code' }[]
}

export interface EssayNode {
  type: string
  attrs?: Record<string, unknown>
  content?: EssayNode[]
  text?: string
  marks?: { type: string }[]
}

export interface EssayDoc {
  type: 'doc'
  content: EssayNode[]
}

export interface ParsedContent {
  doc: EssayDoc
  starts: number[]
  lines: number[]
}

const taskLine = /^- \[([ x])\] (.*)$/
const bulletLine = /^- (.*)$/
const orderedLine = /^(\d+)\. (.*)$/
const imageLine = /^!\[([^\]]*)\]\(([^)]+)\)$/
const headingLine = /^(#{1,6}) (.*)$/

export function splitFrontmatter(body: string): { head: string; content: string } {
  const text = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.startsWith('---\n')) return { head: '', content: text }
  const close = text.indexOf('\n---', 3)
  if (close === -1) return { head: '', content: text }
  let end = close + 4
  if (text[end] === '\n') end += 1
  if (text[end] === '\n') end += 1
  return { head: text.slice(0, end), content: text.slice(end) }
}

export function joinDocument(head: string, content: string): string {
  return head + content
}

export function parseContent(content: string): ParsedContent {
  const lines = contentLines(content)
  const blocks: EssayNode[] = []
  const starts: number[] = []
  const startLines: number[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line === '') {
      index += 1
      continue
    }
    starts.push(offsetAt(lines, index))
    startLines.push(index)
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const body: string[] = []
      index += 1
      while (index < lines.length && lines[index] !== '```') {
        body.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(codeBlock(language, body.join('\n')))
      continue
    }
    const heading = headingLine.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: parseInlines(heading[2])
      })
      index += 1
      continue
    }
    if (line.startsWith('> ')) {
      const contentNodes: EssayNode[] = []
      while (index < lines.length && lines[index].startsWith('> ')) {
        contentNodes.push(paragraph(parseInlines(lines[index].slice(2))))
        index += 1
      }
      blocks.push({ type: 'blockquote', content: contentNodes })
      continue
    }
    if (taskLine.test(line)) {
      const items: EssayNode[] = []
      while (index < lines.length && taskLine.test(lines[index])) {
        const match = taskLine.exec(lines[index])
        items.push({
          type: 'taskItem',
          attrs: { checked: match?.[1] === 'x' },
          content: [paragraph(parseInlines(match?.[2] ?? ''))]
        })
        index += 1
      }
      blocks.push({ type: 'taskList', content: items })
      continue
    }
    if (bulletLine.test(line)) {
      const items: EssayNode[] = []
      while (index < lines.length && bulletLine.test(lines[index]) && !taskLine.test(lines[index])) {
        const match = bulletLine.exec(lines[index])
        items.push({ type: 'listItem', content: [paragraph(parseInlines(match?.[1] ?? ''))] })
        index += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }
    if (orderedLine.test(line)) {
      const items: EssayNode[] = []
      while (index < lines.length && orderedLine.test(lines[index])) {
        const match = orderedLine.exec(lines[index])
        items.push({ type: 'listItem', content: [paragraph(parseInlines(match?.[2] ?? ''))] })
        index += 1
      }
      blocks.push({ type: 'orderedList', attrs: { start: 1 }, content: items })
      continue
    }
    const image = imageLine.exec(line)
    if (image) {
      blocks.push({ type: 'image', attrs: { alt: image[1], src: image[2] } })
      index += 1
      continue
    }
    blocks.push(paragraph(parseInlines(line)))
    index += 1
  }
  if (blocks.length === 0) blocks.push({ type: 'paragraph' })
  return { doc: { type: 'doc', content: blocks }, starts, lines: startLines }
}

export function serializeDocument(doc: { content?: EssayNode[] }): string {
  const blocks = (doc.content ?? [])
    .map(serializeBlock)
    .filter((block): block is string => block !== null && block !== '')
  if (blocks.length === 0) return ''
  return `${blocks.join('\n\n')}\n`
}

export function blockOffset(content: string, index: number): { offset: number; line: number } {
  const parsed = parseContent(content)
  const last = Math.max(parsed.starts.length - 1, 0)
  const safe = Math.min(Math.max(index, 0), last)
  return { offset: parsed.starts[safe] ?? 0, line: parsed.lines[safe] ?? 0 }
}

export function blockIndexAt(content: string, offset: number): number {
  const parsed = parseContent(content)
  let index = 0
  for (let cursor = 0; cursor < parsed.starts.length; cursor += 1) {
    if ((parsed.starts[cursor] ?? 0) <= offset) index = cursor
  }
  return index
}

export function lineIndexAt(content: string, offset: number): number {
  const lines = contentLines(content)
  let cursor = 0
  for (let line = 0; line < lines.length; line += 1) {
    const next = cursor + (lines[line]?.length ?? 0) + 1
    if (offset < next) return line
    cursor = next
  }
  return Math.max(lines.length - 1, 0)
}

export function offsetOfLine(content: string, line: number): number {
  const lines = contentLines(content)
  const safe = Math.min(Math.max(line, 0), Math.max(lines.length - 1, 0))
  return offsetAt(lines, safe)
}

function contentLines(content: string): string[] {
  const lines = content.split('\n')
  if (content.endsWith('\n')) lines.pop()
  return lines
}

function offsetAt(lines: string[], line: number): number {
  let offset = 0
  for (let index = 0; index < line; index += 1) offset += lines[index].length + 1
  return offset
}

function paragraph(content: TextNode[]): EssayNode {
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function codeBlock(language: string, text: string): EssayNode {
  const node: EssayNode = { type: 'codeBlock', attrs: { language: language || null } }
  if (text) node.content = [{ type: 'text', text }]
  return node
}

function parseInlines(line: string): TextNode[] {
  const nodes: TextNode[] = []
  let buffer = ''
  const flush = (): void => {
    if (!buffer) return
    nodes.push({ type: 'text', text: buffer })
    buffer = ''
  }
  let index = 0
  while (index < line.length) {
    if (line[index] === '`') {
      const end = line.indexOf('`', index + 1)
      if (end > index + 1) {
        flush()
        nodes.push({ type: 'text', text: line.slice(index + 1, end), marks: [{ type: 'code' }] })
        index = end + 1
        continue
      }
    }
    if (line.startsWith('**', index)) {
      const end = line.indexOf('**', index + 2)
      if (end > index + 2) {
        flush()
        nodes.push({ type: 'text', text: line.slice(index + 2, end), marks: [{ type: 'bold' }] })
        index = end + 2
        continue
      }
    }
    if (line[index] === '*' && line[index + 1] !== '*') {
      const end = line.indexOf('*', index + 1)
      if (end > index + 1 && line[end + 1] !== '*') {
        flush()
        nodes.push({ type: 'text', text: line.slice(index + 1, end), marks: [{ type: 'italic' }] })
        index = end + 1
        continue
      }
    }
    buffer += line[index]
    index += 1
  }
  flush()
  return nodes
}

function serializeBlock(node: EssayNode): string | null {
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
    return `${'#'.repeat(level)} ${serializeInlines(node)}`
  }
  if (node.type === 'paragraph') return serializeInlines(node)
  if (node.type === 'blockquote') {
    return (node.content ?? []).map((child) => `> ${serializeInlines(child)}`).join('\n')
  }
  if (node.type === 'bulletList') {
    return (node.content ?? []).map((item) => `- ${serializeInlines(item.content?.[0] ?? { type: 'paragraph' })}`).join('\n')
  }
  if (node.type === 'orderedList') {
    return (node.content ?? [])
      .map((item, index) => `${index + 1}. ${serializeInlines(item.content?.[0] ?? { type: 'paragraph' })}`)
      .join('\n')
  }
  if (node.type === 'taskList') {
    return (node.content ?? [])
      .map((item) => `- [${item.attrs?.checked === true ? 'x' : ' '}] ${serializeInlines(item.content?.[0] ?? { type: 'paragraph' })}`)
      .join('\n')
  }
  if (node.type === 'codeBlock') {
    const language = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
    const text = (node.content ?? []).map((child) => child.text ?? '').join('')
    return `\`\`\`${language}\n${text}\n\`\`\``
  }
  if (node.type === 'image') {
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
    return `![${alt}](${src})`
  }
  return null
}

function serializeInlines(node: EssayNode): string {
  return (node.content ?? [])
    .map((child) => {
      const text = child.text ?? ''
      const mark = child.marks?.[0]?.type
      if (mark === 'code') return `\`${text}\``
      if (mark === 'bold') return `**${text}**`
      if (mark === 'italic') return `*${text}*`
      return text
    })
    .join('')
}
