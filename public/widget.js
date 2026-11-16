/** DeepSeek floating chat. No framework or runtime dependency. MIT. */
;(() => {
  'use strict'
  if (window.DeepSeekWidget) return
  const scriptUrl = document.currentScript?.src
  const defaultSrc = new URL('index.html', scriptUrl || location.href).href
  let instance = null

  window.DeepSeekWidget = {
    mount(options = {}) {
      if (instance) return instance
      const src = new URL(options.src || defaultSrc, location.href)
      if (!['https:', 'http:'].includes(src.protocol)) {
        throw new Error('Widget src must use HTTP or HTTPS.')
      }
      if (options.namespace && !/^[a-zA-Z0-9_.:@-]{1,128}$/.test(options.namespace)) {
        throw new Error('Invalid widget namespace. Use 1–128 letters, digits, _, ., :, @ or -.')
      }
      src.searchParams.set('mode', 'embed')
      src.searchParams.set('parentOrigin', location.origin)
      if (options.namespace) src.searchParams.set('namespace', options.namespace)
      const host = document.createElement('div')
      host.setAttribute('data-deepseek-widget', '')
      // The host carries positioning so even aggressive business-page CSS stays outside.
      host.style.cssText =
        'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000;'
      const shadow = host.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      style.textContent = `
        :host { color-scheme: light; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }
        button { font: inherit; cursor: pointer; }
        button:focus-visible, iframe:focus-visible { outline: 3px solid #6f98ff; outline-offset: 3px; }
        .launcher { position: absolute; right: 24px; bottom: 24px; pointer-events: auto;
          display: flex; align-items: center; gap: 10px; padding: 0 20px; height: 52px;
          border: 1px solid #ffffff40; border-radius: 28px; color: white; background: #365cf5;
          box-shadow: 0 6px 24px #274ac938; transition: transform .18s, background .18s; }
        .launcher:hover { background: #294cda; transform: translateY(-2px); }
        .mark { font-size: 22px; line-height: 1; }
        .panel { position: absolute; right: 24px; bottom: 88px; width: min(440px, calc(100vw - 32px));
          height: min(680px, calc(100dvh - 112px)); display: flex; flex-direction: column;
          pointer-events: auto; overflow: hidden; border: 1px solid #dfe5f0; border-radius: 20px;
          background: #fff; box-shadow: 0 18px 72px #17265326, 0 2px 12px #1726530d; }
        .bar { display: flex; flex: 0 0 58px; align-items: center; gap: 10px; padding: 0 16px 0 20px;
          color: #19243c; background: #fff; border-bottom: 1px solid #edf0f6; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #365cf5; }
        .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        .minimize { display: grid; place-items: center; width: 32px; height: 32px; border: 0;
          border-radius: 9px; background: transparent; color: #66718a; font-size: 22px; }
        .minimize:hover { background: #f0f3fa; }
        iframe { display: block; flex: 1; min-height: 0; width: 100%; border: 0; background: #fff; }
        @media (max-width: 600px) {
          .launcher[aria-expanded="true"] { display: none; }
          .launcher { right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); }
          .panel { inset: 0; width: 100%; height: 100%; border-radius: 0; border: 0; }
          .bar { padding-top: env(safe-area-inset-top); flex-basis: calc(58px + env(safe-area-inset-top)); }
        }
        @media (prefers-reduced-motion: reduce) { .launcher { transition: none; } }
      `
      const launcher = document.createElement('button')
      launcher.type = 'button'
      launcher.className = 'launcher'
      launcher.setAttribute('aria-expanded', 'false')
      launcher.setAttribute('aria-controls', 'assistant-panel')
      launcher.setAttribute('aria-label', options.title || '智能助手')
      const mark = document.createElement('span')
      mark.className = 'mark'
      mark.setAttribute('aria-hidden', 'true')
      mark.textContent = '✦'
      const label = document.createElement('span')
      label.textContent = options.title || '智能助手'
      launcher.append(mark, label)
      const panel = document.createElement('section')
      panel.id = 'assistant-panel'
      panel.className = 'panel'
      panel.hidden = true
      panel.setAttribute('role', 'region')
      panel.setAttribute('aria-label', options.title || '智能助手')
      const bar = document.createElement('div')
      bar.className = 'bar'
      const dot = document.createElement('span')
      dot.className = 'dot'
      const title = document.createElement('span')
      title.className = 'title'
      title.textContent = options.title || '智能助手'
      const minimize = document.createElement('button')
      minimize.type = 'button'
      minimize.className = 'minimize'
      minimize.textContent = '−'
      minimize.setAttribute(
        'aria-label',
        options.locale === 'en-US' ? 'Minimize chat' : '最小化聊天'
      )
      bar.append(dot, title, minimize)
      panel.append(bar)
      shadow.append(style, panel, launcher)
      let frame = null
      let visible = false
      let destroyed = false
      const send = (data) => frame?.contentWindow?.postMessage(data, src.origin)
      const onMessage = (event) => {
        if (!frame || event.source !== frame.contentWindow || event.origin !== src.origin) return
        if (event.data?.type === 'assistant:ready') {
          send({ type: 'assistant:init', locale: options.locale, theme: options.theme })
          send({ type: 'assistant:visibility', visible })
        }
      }
      const open = () => {
        if (destroyed) return
        visible = true
        panel.hidden = false
        launcher.setAttribute('aria-expanded', 'true')
        if (!frame) {
          frame = document.createElement('iframe')
          frame.title = options.title || '智能助手'
          frame.allow = 'microphone'
          frame.src = src.href
          panel.append(frame)
        }
        send({ type: 'assistant:visibility', visible: true })
        minimize.focus({ preventScroll: true })
      }
      const close = () => {
        if (destroyed) return
        visible = false
        send({ type: 'assistant:visibility', visible: false })
        panel.hidden = true
        launcher.setAttribute('aria-expanded', 'false')
        launcher.focus({ preventScroll: true })
      }
      const onKeyDown = (event) => {
        if (event.key === 'Escape' && visible) close()
      }
      launcher.addEventListener('click', () => (visible ? close() : open()))
      minimize.addEventListener('click', close)
      shadow.addEventListener('keydown', onKeyDown)
      window.addEventListener('message', onMessage)
      document.body.append(host)
      instance = {
        open,
        close,
        destroy() {
          if (destroyed) return
          close()
          destroyed = true
          window.removeEventListener('message', onMessage)
          host.remove()
          instance = null
        },
      }
      return instance
    },
  }
})()
