export type DocumentType = 'work' | 'essay' | 'journal' | 'list' | 'tech'

export type TypeSource = 'marked' | 'default'

export interface OutlineItem {
  level: number
  text: string
}

export interface MarkdownDocument {
  kind: 'markdown'
  path: string
  name: string
  type: DocumentType
  typeSource: TypeSource
  title: string
  body: string
  outline: OutlineItem[]
}

export interface OtherFile {
  kind: 'file'
  path: string
  name: string
}

export type LibraryEntry = MarkdownDocument | OtherFile

export type LibraryStatus =
  | { state: 'closed' }
  | { state: 'empty' }
  | { state: 'failed'; message: string }
  | { state: 'ready'; entries: LibraryEntry[] }
