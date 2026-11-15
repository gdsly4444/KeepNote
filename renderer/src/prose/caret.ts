import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { blockIndexAt, blockOffset, offsetOfLine } from './markdown'

const nestedBlocks = new Set(['bulletList', 'orderedList', 'taskList', 'blockquote'])

export function sourceLineOf(editor: Editor, content: string): number {
  const index = editor.state.selection.$from.index(0)
  return blockOffset(content, index).line + lineWithin(editor)
}

export function placeCaret(editor: Editor, column: ParentNode | null, content: string, line: number): void {
  const index = blockIndexAt(content, offsetOfLine(content, line))
  const within = line - blockOffset(content, index).line
  const doc = editor.state.doc
  const safe = Math.min(Math.max(index, 0), Math.max(doc.childCount - 1, 0))
  let pos = 0
  for (let child = 0; child < safe; child += 1) pos += doc.child(child).nodeSize
  const node = doc.child(safe)
  const target = positionInBlock(node, pos, within)
  const selection = TextSelection.near(doc.resolve(Math.min(Math.max(target, 0), doc.content.size)))
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
  const block = column?.querySelectorAll('.ProseMirror > *')[safe]
  lineElement(block, node.type.name, within)?.scrollIntoView({ block: 'nearest' })
}

function lineWithin(editor: Editor): number {
  const from = editor.state.selection.$from
  if (from.depth < 1) return 0
  const name = from.node(1).type.name
  if (name === 'codeBlock') {
    const text = editor.state.doc.textBetween(from.start(1), from.pos, '\n')
    return 1 + (text.match(/\n/g)?.length ?? 0)
  }
  if (nestedBlocks.has(name)) return from.index(1)
  return 0
}

function positionInBlock(
  node: { type: { name: string }, childCount: number, child: (index: number) => { nodeSize: number }, textContent: string },
  pos: number,
  within: number
): number {
  if (node.type.name === 'codeBlock') {
    const lines = node.textContent.split('\n')
    const textLine = Math.min(Math.max(within - 1, 0), Math.max(lines.length - 1, 0))
    let textOffset = 0
    for (let item = 0; item < textLine; item += 1) textOffset += (lines[item]?.length ?? 0) + 1
    return pos + 1 + textOffset
  }
  if (!nestedBlocks.has(node.type.name) || node.childCount === 0) return pos
  const child = Math.min(Math.max(within, 0), node.childCount - 1)
  let childPos = pos + 1
  for (let item = 0; item < child; item += 1) childPos += node.child(item).nodeSize
  return childPos
}

function lineElement(block: Element | undefined, name: string, within: number): Element | undefined {
  if (!block) return undefined
  if (name === 'blockquote') return block.querySelectorAll('p')[Math.max(within, 0)] ?? block
  if (nestedBlocks.has(name)) return block.querySelectorAll('li')[Math.max(within, 0)] ?? block
  return block
}
