import { previewBlocks, type PreviewBlock } from './preview'

export function TechPreview({ source }: { source: string }) {
  return (
    <div className="tech-preview" aria-label="预览">
      {previewBlocks(source).map((block, index) => renderBlock(block, index))}
    </div>
  )
}

function renderBlock(block: PreviewBlock, index: number) {
  if (block.kind === 'heading') {
    if (block.level <= 1) return <h1 key={index}>{block.text}</h1>
    if (block.level === 2) return <h2 key={index}>{block.text}</h2>
    return <h3 key={index}>{block.text}</h3>
  }
  if (block.kind === 'code') {
    return (
      <pre key={index}>
        <code>{block.text}</code>
      </pre>
    )
  }
  if (block.kind === 'table') {
    return (
      <table key={index}>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  if (block.kind === 'list') {
    const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)
    return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>
  }
  return <p key={index}>{block.text}</p>
}
