export interface Desk {
  day: string
  root: string | null
  path: string | null
}

export interface DeskIo {
  read(path: string): string | null
  write(path: string, text: string): void
}

export interface DeskStore {
  read(): Desk
  write(desk: Desk): void
}

const empty: Desk = { day: '', root: null, path: null }

export function createDeskStore(file: string, io: DeskIo): DeskStore {
  return {
    read() {
      const text = io.read(file)
      if (!text) return empty
      return parseDesk(text)
    },
    write(desk) {
      io.write(file, JSON.stringify(desk))
    }
  }
}

function parseDesk(text: string): Desk {
  try {
    const value = JSON.parse(text) as Partial<Desk>
    return {
      day: typeof value.day === 'string' ? value.day : '',
      root: typeof value.root === 'string' ? value.root : null,
      path: typeof value.path === 'string' ? value.path : null
    }
  } catch {
    return empty
  }
}
