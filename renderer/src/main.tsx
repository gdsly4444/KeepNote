import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Shell } from './shell'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('缺少根节点')

createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>
)
