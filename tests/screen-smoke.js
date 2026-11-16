async function smoke(page) {
  const namespace = `screen-smoke-${Date.now()}`
  let passed = 0
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
    passed++
  }
  const errors = []
  const messages = []
  page.on('pageerror', (error) => errors.push(error.message))
  // All upstream traffic is intercepted. No real key or business API is used.
  await page.route('https://api.deepseek.com/**', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    }
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (!request.url().endsWith('/anthropic/v1/messages')) return route.abort()
    messages.push(request.postDataJSON())
    const answer =
      messages.length > 1
        ? '|设备编号|运行状态|采集时间|累计发电|告警描述|维护建议|\n|---|---|---|---|---|---|\n|SOLAR-DEVICE-00000000000001|正常运行|2026-11-16T15:03:10|888888888kWh|无告警|继续观察设备运行状态|\n\n```text\n' +
          'long-code-line-'.repeat(30) +
          '\n```'
        : '这是本地模拟回答，用于验证大屏卡片问答。\n\n今日光伏发电量 **888 kWh**，设备运行正常。展开窗口可以查看完整分析。'
    const events = [
      { type: 'message_start', message: { id: 'screen-smoke', role: 'assistant', content: [] } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: answer } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '光伏运行情况（模拟）' } },
      { type: 'message_stop' },
    ]
    await route.fulfill({
      status: 200,
      headers: { ...headers, 'content-type': 'text/event-stream' },
      body: events
        .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        .join(''),
    })
  })
  await page.addInitScript((namespace) => {
    localStorage.setItem(`chat-demo:${namespace}:api-key`, 'test-only-not-a-real-key')
    localStorage.setItem(`chat-demo:${namespace}:theme-preference`, 'light')
  }, namespace)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(`http://127.0.0.1:8090/screen-demo.html?namespace=${namespace}`)
  const host = page.locator('[data-deepseek-widget]')
  const panel = page.getByRole('region', { name: 'AI智能体' })
  const frame = page.frames().find((f) => f !== page.mainFrame())
  await frame.waitForSelector('textarea')
  await frame.waitForFunction(() => document.documentElement.dataset.chatTheme === 'screen')
  check((await page.locator('iframe').count()) === 1, 'card loads iframe immediately')
  const glass = await panel.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      filter: style.backdropFilter || style.webkitBackdropFilter,
      background: style.backgroundImage,
      border: style.borderTopColor,
      shadow: style.boxShadow,
    }
  })
  check(glass.filter.includes('blur(18px)'), 'host applies Gaussian backdrop blur')
  const businessSurface = await page.locator('#solar-panel').evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      background: style.backgroundImage,
      border: style.borderTopColor,
      shadow: style.boxShadow,
    }
  })
  check(
    glass.background === businessSurface.background && glass.background.includes('linear-gradient'),
    'chat and business cards share the same translucent gradient'
  )
  check(
    glass.border === businessSurface.border && glass.shadow === businessSurface.shadow,
    'chat and business cards share border and shadow'
  )
  const titleColor = await page
    .locator('[data-deepseek-widget]')
    .locator('.title')
    .evaluate((el) => getComputedStyle(el).color)
  check(
    titleColor ===
      (await page.locator('#solar-panel h2').evaluate((el) => getComputedStyle(el).color)),
    'chat title matches business card title color'
  )
  check(
    (await page.locator('iframe').evaluate((el) => getComputedStyle(el).colorScheme)) ===
      'normal' &&
      (await frame.evaluate(() => getComputedStyle(document.documentElement).colorScheme)) ===
        'normal',
    'iframe and document schemes match for a transparent UA canvas'
  )

  check(
    await frame.evaluate(
      () =>
        getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)' &&
        getComputedStyle(document.documentElement).backgroundColor === 'rgba(0, 0, 0, 0)'
    ),
    'iframe canvas stays transparent behind sharp chat content'
  )

  check(
    !(await page.getByRole('button', { name: 'AI智能体', exact: true }).isVisible()),
    'card has no floating launcher'
  )
  const small = await panel.boundingBox()
  const solar = await page.locator('#solar-panel').boundingBox()
  const placeholder = await page.locator('#assistant-placeholder').boundingBox()
  check(
    Math.abs(small.width - placeholder.width) < 1 &&
      Math.abs(small.height - placeholder.height) < 1,
    'card dimensions follow the responsive reserved slot'
  )
  check(Math.abs(small.y - placeholder.y) < 1, 'small card occupies reserved slot')
  check(await frame.locator('textarea').isVisible(), 'small card accepts direct text input')
  const inputBox = await frame.locator('textarea').boundingBox()
  const iframeBox = await page.locator('iframe').boundingBox()
  check(
    inputBox.y >= iframeBox.y && inputBox.y + inputBox.height <= iframeBox.y + iframeBox.height + 1,
    'input fits within small card'
  )
  check(
    await frame.evaluate(() => document.body.hasAttribute('data-ds-dark-theme')),
    'screen uses dark rendering for rich content'
  )
  check(
    (await frame.evaluate(
      (namespace) => localStorage.getItem(`chat-demo:${namespace}:theme-preference`),
      namespace
    )) === 'light',
    'screen theme does not overwrite personal preference'
  )
  check(
    (await frame
      .locator('textarea')
      .evaluate((el) => getComputedStyle(el.parentElement.parentElement).backgroundColor)) ===
      'rgba(13, 34, 48, 0.42)',
    'input uses screen semantic color'
  )
  await frame.locator('textarea').fill('当前光伏发电情况如何？')
  await frame.getByRole('button', { name: '发送', exact: true }).click()
  await frame.getByText('这是本地模拟回答，用于验证大屏卡片问答。').waitFor()
  await frame.getByRole('button', { name: '发送', exact: true }).waitFor()
  check(messages.length === 1, 'small card completes a mocked API question and answer')
  await frame.locator('textarea').fill('这条草稿在展开和恢复后保留')
  await page.screenshot({ path: 'output/playwright/screen-card.png' })
  let frameNavigations = 0
  page.on('framenavigated', (f) => {
    if (f === frame) frameNavigations++
  })
  await page.getByRole('button', { name: '展开聊天' }).click()
  await page.waitForFunction(() => {
    const panel = document
      .querySelector('[data-deepseek-widget]')
      .shadowRoot.querySelector('.panel')
    const container = document.querySelector('#screen-assistant')
    return (
      Math.abs(panel.getBoundingClientRect().height - container.getBoundingClientRect().height) < 1
    )
  })
  const large = await panel.boundingBox()
  check(Math.abs(large.y - solar.y) < 1, 'expanded top aligns exactly with solar card')
  check(
    Math.abs(large.x - small.x) < 1 && Math.abs(large.width - small.width) < 1,
    'expansion keeps width and horizontal position'
  )
  check(
    Math.abs(large.y + large.height - small.y - small.height) < 1,
    'expansion keeps bottom edge anchored'
  )
  check(
    page.frames().includes(frame) && frameNavigations === 0,
    'expansion preserves iframe without navigation'
  )
  check(
    (await frame.locator('textarea').inputValue()) === '这条草稿在展开和恢复后保留',
    'draft survives expansion'
  )
  check(
    await frame.getByText('这是本地模拟回答，用于验证大屏卡片问答。').isVisible(),
    'expanded view retains answer'
  )
  const hidden = await page.evaluate(() => {
    const root = document.querySelector('[data-deepseek-widget]').shadowRoot
    const r = root.querySelector('.panel').getBoundingClientRect()
    return (
      document.elementFromPoint(r.x + r.width / 2, r.y + 100)?.closest('[data-deepseek-widget]') !==
      null
    )
  })
  check(hidden, 'expanded panel covers underlying cards')
  check(
    Math.abs((await page.locator('#assistant-placeholder').boundingBox()).y - placeholder.y) < 1,
    'underlying layout retains reserved slot'
  )
  await page.screenshot({ path: 'output/playwright/screen-expanded.png' })
  await page.getByRole('button', { name: '恢复聊天' }).click()
  await page.waitForFunction(
    () =>
      Math.abs(
        document
          .querySelector('[data-deepseek-widget]')
          .shadowRoot.querySelector('.panel')
          .getBoundingClientRect().height -
          document.querySelector('#assistant-placeholder').getBoundingClientRect().height
      ) < 1
  )
  check(
    (await frame.locator('textarea').inputValue()) === '这条草稿在展开和恢复后保留',
    'draft survives restoration'
  )
  check(
    frameNavigations === 0 && messages.length === 1,
    'restore neither navigates nor resends question'
  )
  await frame.getByRole('button', { name: '打开边栏' }).click()
  await frame.getByRole('button', { name: '设置', exact: true }).click()
  const dialog = frame.getByRole('dialog')
  await dialog.waitFor()
  const dialogBox = await dialog.boundingBox()
  const smallFrame = await page.locator('iframe').boundingBox()
  check(dialogBox.height <= smallFrame.height + 1, 'settings fit small card height')
  await frame.getByRole('button', { name: '关闭', exact: true }).click()
  await frame.getByRole('button', { name: '收起边栏', exact: true }).click()
  await frame.locator('textarea').fill('展示长表格和代码')
  await frame.getByRole('button', { name: '发送', exact: true }).click()
  await frame.locator('.markdown-table-wrapper').waitFor()
  await frame.locator('.md-code-block pre').waitFor()
  check(
    await frame
      .locator('.markdown-table-wrapper')
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    'wide table scrolls inside message'
  )
  check(
    await frame.locator('.md-code-block pre').evaluate((el) => el.scrollWidth > el.clientWidth),
    'long code scrolls inside message'
  )
  check(
    await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'rich content does not widen iframe'
  )
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.evaluate(() => window.DeepSeekWidget.mount().expand())
  await page.waitForFunction(
    () =>
      Math.abs(
        document
          .querySelector('[data-deepseek-widget]')
          .shadowRoot.querySelector('.panel')
          .getBoundingClientRect().height -
          document.querySelector('#screen-assistant').getBoundingClientRect().height
      ) < 1
  )
  const scaled = await panel.boundingBox()
  const scaledSolar = await page.locator('#solar-panel').boundingBox()
  const responsiveColumn = await page.locator('#screen-assistant').boundingBox()
  check(
    Math.abs(scaled.y - scaledSolar.y) < 1 && Math.abs(scaled.width - responsiveColumn.width) < 1,
    'responsive dashboard preserves alignment and column width'
  )
  await page.evaluate(() => window.DeepSeekWidget.mount().close())
  await page.waitForFunction(
    () =>
      document.querySelector('[data-deepseek-widget]').shadowRoot.querySelector('.panel').dataset
        .expanded === 'false'
  )
  check(await panel.isVisible(), 'card close restores instead of hiding direct chat')
  check((await host.getAttribute('data-mode')) === 'card', 'card mode remains active')
  await frame.evaluate(
    (namespace) => localStorage.removeItem(`chat-demo:${namespace}:api-key`),
    namespace
  )
  await page.evaluate(() => window.DeepSeekWidget.mount().destroy())
  check((await host.count()) === 0, 'card destroy removes host')
  check(errors.length === 0, 'screen has no runtime exceptions')
  return { passed, requests: messages.length, realApiCalls: 0, runtimeErrors: errors }
}
