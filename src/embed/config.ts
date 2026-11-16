/** Embed parameters are configuration, never authentication or authorization. */
const params = new URLSearchParams(window.location.search)
export const isEmbedded = params.get('mode') === 'embed'
const namespace = params.get('namespace') ?? ''
export const storagePrefix =
  isEmbedded && /^[a-zA-Z0-9_.:@-]{1,128}$/.test(namespace) ? `chat-demo:${namespace}` : 'chat-demo'

export const parentOrigin = (() => {
  if (!isEmbedded || window.parent === window) {
    return null
  }
  try {
    const origin = new URL(params.get('parentOrigin') ?? '').origin
    return origin !== 'null' ? origin : null
  } catch {
    return null
  }
})()
