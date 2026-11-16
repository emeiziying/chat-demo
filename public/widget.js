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
      const card = options.mode === 'card'
      if (options.mode && !['card', 'floating'].includes(options.mode)) {
        throw new Error('Widget mode must be card or floating.')
      }
      const container = card
        ? typeof options.container === 'string'
          ? document.querySelector(options.container)
          : options.container
        : document.body
      if (!(container instanceof HTMLElement)) {
        throw new Error('Card mode requires an existing container element.')
      }
      if (card && getComputedStyle(container).position === 'static') {
        throw new Error('Card container must have position: relative, absolute or fixed.')
      }
      const src = new URL(options.src || defaultSrc, location.href)
      if (!['https:', 'http:'].includes(src.protocol)) {
        throw new Error('Widget src must use HTTP or HTTPS.')
      }
      if (options.namespace && !/^[a-zA-Z0-9_.:@-]{1,128}$/.test(options.namespace)) {
        throw new Error('Invalid widget namespace. Use 1–128 letters, digits, _, ., :, @ or -.')
      }
      src.searchParams.set('mode', 'embed')
      src.searchParams.set('parentOrigin', location.origin)
      if (card) src.searchParams.set('presentation', 'card')
      if (options.theme === 'screen') src.searchParams.set('chatTheme', 'screen')
      if (options.namespace) src.searchParams.set('namespace', options.namespace)
      const host = document.createElement('div')
      host.setAttribute('data-deepseek-widget', '')
      host.dataset.mode = card ? 'card' : 'floating'
      if (options.theme === 'screen') host.dataset.theme = 'screen'
      // Card coordinates share the dashboard's containing block and transform scale.
      host.style.cssText = `all:initial;position:${card ? 'absolute' : 'fixed'};inset:0;pointer-events:none;z-index:${card ? '10' : '2147483000'};`
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
        :host([data-mode="card"]) .panel {
          inset: auto 0 0; width: 100%; height: min(var(--assistant-card-height, 285px), 100%);
          border-radius: 12px; transition: height 240ms ease; box-shadow: 0 8px 28px #06132233;
        }
        :host([data-mode="card"]) .panel[data-expanded="true"] { height: 100%; }
        :host([data-mode="card"]) .launcher { display: none; }
        :host([data-mode="card"]) .bar { flex-basis: 44px; padding: 0 14px; }
        :host([data-theme="screen"]) { color-scheme: dark; }
        :host([data-theme="screen"]) .panel {
          border-color: var(--assistant-border, #69c6e847);
          background: var(--assistant-surface, #102d40f5);
          box-shadow: inset 0 0 18px #62b8f010, 0 8px 28px #06132255;
        }
        :host([data-theme="screen"]) .bar {
          color: var(--assistant-text, #eaf6ff); background: transparent; border-color: #69c6e82b;
        }
        :host([data-theme="screen"]) .dot { background: var(--assistant-accent, #35c6b4); box-shadow: 0 0 10px #35c6b450; }
        :host([data-theme="screen"]) .title { color: var(--assistant-accent, #35c6b4); }
        :host([data-theme="screen"]) .minimize { color: #9ecbdc; }
        :host([data-theme="screen"]) .minimize:hover { background: #a3d3ed14; }
        :host([data-theme="screen"]) iframe { background: #102d40; }
        @media (prefers-reduced-motion: reduce) { .launcher, .panel { transition: none; } }
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
      panel.hidden = !card
      panel.dataset.expanded = 'false'
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
      minimize.textContent = card ? '⛶' : '−'
      minimize.setAttribute(
        'aria-label',
        card
          ? options.locale === 'en-US'
            ? 'Expand chat'
            : '展开聊天'
          : options.locale === 'en-US'
            ? 'Minimize chat'
            : '最小化聊天'
      )
      bar.append(dot, title, minimize)
      panel.append(bar)
      shadow.append(style, panel, launcher)
      let frame = null
      let visible = false
      let destroyed = false
      let expanded = false
      if (card) {
        minimize.setAttribute('aria-expanded', 'false')
        minimize.setAttribute('aria-controls', panel.id)
      }
      const setExpanded = (value) => {
        if (!card || destroyed || value === expanded) return
        expanded = value
        panel.dataset.expanded = String(value)
        minimize.setAttribute('aria-expanded', String(value))
        minimize.setAttribute(
          'aria-label',
          options.locale === 'en-US'
            ? value
              ? 'Restore chat'
              : 'Expand chat'
            : value
              ? '恢复聊天'
              : '展开聊天'
        )
        minimize.textContent = value ? '⊡' : '⛶'
        host.dispatchEvent(
          new CustomEvent('assistant:expand-change', {
            bubbles: true,
            detail: { expanded: value },
          })
        )
      }
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
        if (!card) minimize.focus({ preventScroll: true })
      }
      const close = () => {
        if (destroyed) return
        if (card) {
          setExpanded(false)
          return
        }
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
      minimize.addEventListener('click', () => (card ? setExpanded(!expanded) : close()))
      shadow.addEventListener('keydown', onKeyDown)
      window.addEventListener('message', onMessage)
      container.append(host)
      instance = {
        open,
        close,
        expand: () => setExpanded(true),
        collapse: () => setExpanded(false),
        toggleExpanded: () => setExpanded(!expanded),
        destroy() {
          if (destroyed) return
          send({ type: 'assistant:visibility', visible: false })
          destroyed = true
          window.removeEventListener('message', onMessage)
          host.remove()
          instance = null
        },
      }
      if (card) open()
      return instance
    },
  }
})()
