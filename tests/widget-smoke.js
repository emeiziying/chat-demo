;async (page) => {
  let passed = 0
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
    passed++
  }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://127.0.0.1:8090/widget-demo.html')
  check((await page.locator('iframe').count()) === 0, 'iframe loads lazily')
  await page.getByRole('button', { name: '智能助手', exact: true }).click()
  let frame = page.frames().find((f) => f !== page.mainFrame())
  await frame.waitForSelector('textarea')
  check((await frame.getByRole('dialog').count()) === 0, 'embed does not force settings on startup')
  await frame.locator('textarea').fill('浮窗草稿：最小化后仍然保留。')
  const oldFrame = frame
  await frame.evaluate(() => {
    window.hiddenEvents = 0
    window.addEventListener('assistant:hidden', () => window.hiddenEvents++)
  })
  await page.getByRole('button', { name: '最小化聊天' }).click()
  await page.waitForFunction(
    () => document.querySelector('[data-deepseek-widget]').shadowRoot.querySelector('.panel').hidden
  )
  await frame.waitForFunction(() => window.hiddenEvents === 1)
  check(
    (await page.locator('iframe').count()) === 1,
    'minimize keeps iframe mounted and dispatches audio cancellation'
  )
  await page.getByRole('button', { name: '智能助手', exact: true }).click()
  check(page.frames().includes(oldFrame), 'reopen reuses the same iframe')
  check(
    (await frame.locator('textarea').inputValue()) === '浮窗草稿：最小化后仍然保留。',
    'draft survives minimize'
  )
  await frame.getByRole('button', { name: '打开边栏' }).click()
  await frame.getByRole('button', { name: '设置', exact: true }).waitFor()
  check(true, 'history drawer exposes settings')
  await frame.getByRole('button', { name: '收起边栏' }).click()
  await frame.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        origin: 'https://wrong.example',
        data: { type: 'assistant:init', locale: 'en-US' },
      })
    )
  )
  check(
    (await frame.evaluate(() => document.documentElement.lang)) === 'zh-CN',
    'bridge rejects wrong origin'
  )
  await frame.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        origin: location.origin,
        data: { type: 'assistant:init', locale: 'en-US' },
      })
    )
  )
  check(
    (await frame.evaluate(() => document.documentElement.lang)) === 'zh-CN',
    'bridge rejects wrong source'
  )
  await page.evaluate(() => {
    const f = document.querySelector('[data-deepseek-widget]').shadowRoot.querySelector('iframe')
    f.contentWindow.postMessage({ type: 'assistant:init', locale: 'en-US' }, location.origin)
  })
  await frame.waitForFunction(() => document.documentElement.lang === 'en-US')
  check(true, 'bridge accepts configured parent')
  check(
    (await frame.evaluate(() => localStorage.getItem('chat-demo:widget-demo:locale'))) === 'en-US',
    'settings use namespace'
  )
  await page.evaluate(() => {
    const f = document.querySelector('[data-deepseek-widget]').shadowRoot.querySelector('iframe')
    f.contentWindow.postMessage({ type: 'assistant:init', locale: 'zh-CN' }, location.origin)
  })
  await frame.waitForFunction(() => document.documentElement.lang === 'zh-CN')
  const bounds = await page.getByRole('region', { name: '智能助手' }).boundingBox()
  check(bounds.width === 440 && bounds.height === 680, 'desktop panel has intended dimensions')
  await page.screenshot({ path: 'output/playwright/widget-preview.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileBounds = await page.getByRole('region', { name: '智能助手' }).boundingBox()
  check(
    mobileBounds.x === 0 &&
      mobileBounds.y === 0 &&
      mobileBounds.width === 390 &&
      mobileBounds.height === 844,
    'mobile panel fills viewport'
  )
  check(
    !(await page.getByRole('button', { name: '智能助手', exact: true }).isVisible()),
    'mobile launcher does not cover input'
  )
  check(await frame.locator('textarea').isVisible(), 'mobile input remains visible')
  await page.screenshot({ path: 'output/playwright/widget-mobile.png' })
  await page.getByRole('button', { name: '最小化聊天' }).click()
  check(
    await page.getByRole('button', { name: '智能助手', exact: true }).isVisible(),
    'mobile minimize restores launcher'
  )
  await page.evaluate(() => window.DeepSeekWidget.mount().destroy())
  check(
    (await page.locator('[data-deepseek-widget]').count()) === 0,
    'destroy removes host and iframe'
  )
  await page.evaluate(() =>
    window.DeepSeekWidget.mount({ namespace: 'user-b', locale: 'zh-CN' }).open()
  )
  frame = page.frames().find((f) => f !== page.mainFrame())
  await frame.waitForSelector('textarea')
  await frame.waitForFunction(() => document.documentElement.lang === 'zh-CN')
  check(
    (await frame.locator('textarea').inputValue()) === '',
    'new identity does not inherit draft'
  )
  await frame.waitForFunction(async () =>
    (await indexedDB.databases()).some((db) => db.name === 'chat-demo:user-b')
  )
  const names = await frame.evaluate(async () => (await indexedDB.databases()).map((db) => db.name))
  check(
    names.includes('chat-demo:widget-demo') && names.includes('chat-demo:user-b'),
    'identities use separate IndexedDB databases'
  )
  check(
    (await frame.evaluate(() => localStorage.getItem('chat-demo:user-b:locale'))) === 'zh-CN',
    'new identity has separate settings'
  )
  await page.evaluate(() => window.DeepSeekWidget.mount())
  check((await page.locator('[data-deepseek-widget]').count()) === 1, 'mount is idempotent')
  const standalone = await page.context().newPage()
  await standalone.goto('http://127.0.0.1:8090/index.html')
  await standalone.getByRole('dialog').waitFor()
  check(
    (await standalone.locator('html').getAttribute('data-embed')) === null,
    'standalone mode is preserved'
  )
  await standalone.close()
  check(errors.length === 0, 'no runtime exceptions')
  await page.setViewportSize({ width: 1280, height: 900 })
  return { passed, runtimeErrors: errors, desktop: '1280x900', mobile: '390x844' }
}
