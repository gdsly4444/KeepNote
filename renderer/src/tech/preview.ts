export type PreviewBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'list'; ordered: boolean; items: string[] }

export function previewBlocks(source: string): PreviewBlock[] {
  const lines = withoutFrontmatter(source).replace(/\n+$/, '').split('\n')
  const blocks: PreviewBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }
    const fence = /^(```+|~~~+)(.*)$/.exec(line)
    if (fence?.[1]) {
      const mark = fence[1][0] ?? '`'
      const size = fence[1].length
      const language = (fence[2] ?? '').trim().split(/\s+/)[0] ?? ''
      const body: string[] = []
      index += 1
      while (index < lines.length && !closes(lines[index] ?? '', mark, size)) {
        body.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ kind: 'code', language, text: body.join('\n') })
      continue
    }
    const heading = /^(#{1,6}) (.*)$/.exec(line)
    if (heading?.[1] && heading[2] !== undefined) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }
    if (isTableRow(line) && isTableRule(lines[index + 1] ?? '')) {
      const rows = [tableCells(line)]
      index += 2
      while (index < lines.length && isTableRow(lines[index] ?? '')) {
        rows.push(tableCells(lines[index] ?? ''))
        index += 1
      }
      blocks.push({ kind: 'table', rows })
      continue
    }
    const bullet = /^[-*] (.*)$/.exec(line)
    const ordered = /^\d+\. (.*)$/.exec(line)
    if (bullet || ordered) {
      const items: string[] = []
      const numbered = Boolean(ordered)
      while (index < lines.length) {
        const item = numbered ? /^\d+\. (.*)$/.exec(lines[index] ?? '') : /^[-*] (.*)$/.exec(lines[index] ?? '')
        if (!item) break
        items.push(item[1] ?? '')
        index += 1
      }
      blocks.push({ kind: 'list', ordered: numbered, items })
      continue
    }
    const paragraph: string[] = []
    while (index < lines.length && (lines[index] ?? '').trim() !== '' && !startsBlock(lines[index] ?? '')) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') })
  }
  return blocks
}

function withoutFrontmatter(source: string): string {
  if (!source.startsWith('---\n')) return source
  const close = source.indexOf('\n---', 3)
  if (close === -1) return source
  return source.slice(close + 4).replace(/^\n/, '')
}

function closes(line: string, mark: string, size: number): boolean {
  return new RegExp(`^(${mark}{${size},})\\s*$`).test(line)
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.includes('|')
}

function isTableRule(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim())
}

function tableCells(line: string): string[] {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.map((cell) => cell.trim())
}

function startsBlock(line: string): boolean {
  return /^(```+|~~~+)/.test(line) || /^(#{1,6}) /.test(line) || isTableRow(line) || /^[-*] /.test(line) || /^\d+\. /.test(line)
}
