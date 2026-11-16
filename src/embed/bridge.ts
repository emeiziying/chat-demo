import { setLocale, setThemePreference } from '../services/settings.js'
import { stopReadAloud } from '../services/speech/readAloud.js'
import { parentOrigin } from './config.js'

export const HIDDEN_EVENT = 'assistant:hidden'

/** The host must be the configured parent window at the exact configured origin. */
export const bindEmbedBridge = () => {
  if (!parentOrigin) {
    return undefined
  }
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) {
      return
    }
    const data: unknown = event.data
    if (!data || typeof data !== 'object' || !('type' in data)) {
      return
    }
    if (data.type === 'assistant:init') {
      if ('locale' in data && (data.locale === 'zh-CN' || data.locale === 'en-US')) {
        setLocale(data.locale)
      }
      if (
        'theme' in data &&
        (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system')
      ) {
        setThemePreference(data.theme)
      }
    }
    if (data.type === 'assistant:visibility' && 'visible' in data && data.visible === false) {
      stopReadAloud()
      window.dispatchEvent(new Event(HIDDEN_EVENT))
    }
  }
  window.addEventListener('message', onMessage)
  window.parent.postMessage({ type: 'assistant:ready' }, parentOrigin)
  return () => window.removeEventListener('message', onMessage)
}
