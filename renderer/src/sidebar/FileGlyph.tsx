import { fileKind } from './model'

export function FileGlyph({ name }: { name: string }) {
  const kind = fileKind(name)
  return (
    <svg className="file-glyph" viewBox="0 0 16 16" aria-hidden="true">
      {kind === 'pdf' ? <path d="M3 1.5h6.2L13 5.2V14.5H3zM9 2.2V5h2.7" /> : null}
      {kind === 'image' ? <path d="M2.5 3.5h11v9h-11zM5 10.5l2-2 1.5 1.5 2-2.5 2 3" /> : null}
      {kind === 'file' ? <path d="M4 1.5h5.2L12 4.2V14.5H4z" /> : null}
    </svg>
  )
}
