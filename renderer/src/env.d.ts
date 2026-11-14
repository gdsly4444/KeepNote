import type { KeepNoteBridge } from '../../shared'

declare global {
  interface Window {
    keepnote?: KeepNoteBridge
  }
}

export {}
