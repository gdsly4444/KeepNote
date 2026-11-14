import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Shell } from './shell'
import { watchSystemTheme } from './tokens'

watchSystemTheme()

const root = document.getElementById('root')
if (!root) throw new Error('缺少根节点')

createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>
)
