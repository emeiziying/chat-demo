import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { setupTheme } from './app/theme.js'
import { ensureKatex } from './services/markdown/katex.js'
import './app/theme.css'
import './app/global.css'
import '../public/screen-theme.css'
import './embed/embed.css'
import { isCard, isEmbedded, isScreenTheme } from './embed/config.js'

if (isEmbedded) {
  document.documentElement.dataset.embed = 'true'
}

if (isCard) {
  document.documentElement.dataset.presentation = 'card'
}
if (isScreenTheme) {
  document.documentElement.dataset.chatTheme = 'screen'
}

ensureKatex()
setupTheme()

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
