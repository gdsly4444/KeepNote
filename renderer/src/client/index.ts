import type { KeepNoteBridge } from '../../../shared'

export function getKeepNote(): KeepNoteBridge | undefined {
  return window.keepnote
}
