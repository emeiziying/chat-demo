async function layoutSmoke(page) {
  const sizes = [
    [1920, 1080],
    [2560, 1080],
    [3840, 2160],
    [1366, 768],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]
  const namespace = `screen-layout-${Date.now()}`
  const errors = []
  let passed = 0
  const results = []
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
    passed++
  }
  // This layout suite never sends a real upstream request or uses a key.
  await page.route('https://api.deepseek.com/**', (route) => route.abort())
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] })
  await page.goto(`http://127.0.0.1:8090/screen-demo.html?namespace=${namespace}`)
  const panel = page.getByRole('region', { name: 'AI智能体' })
  const frame = page.frames().find((f) => f !== page.mainFrame())
  await frame.waitForSelector('textarea')
  let frameNavigations = 0
  page.on('framenavigated', (f) => {
    if (f === frame) frameNavigations++
  })
  const documentRect = (locator) =>
    locator.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      }
    })
  const closeEnough = (a, b) => Math.abs(a - b) < 1
  const waitForCard = (expanded) =>
    page.waitForFunction((expanded) => {
      const root = document.querySelector('[data-deepseek-widget]').shadowRoot
      const panel = root.querySelector('.panel')
      const target = document.querySelector(
        expanded ? '#screen-assistant' : '#assistant-placeholder'
      )
      return (
        panel.dataset.expanded === String(expanded) &&
        Math.abs(panel.getBoundingClientRect().height - target.getBoundingClientRect().height) <
          0.05 &&
        panel.getAnimations().every((animation) => animation.playState !== 'running')
      )
    }, expanded)

  for (const [width, height] of sizes) {
    const label = `${width}x${height}`
    await page.setViewportSize({ width, height })
    await page.evaluate(() => window.scrollTo(0, 0))
    await waitForCard(false)
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('#dashboard')
      const selectors = ['.top', '.note', '.left', '.center', '.hint', '.alarms', '.right']
      return {
        overflow:
          Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) >
          innerWidth + 1,
        canvas: {
          width: canvas.getBoundingClientRect().width,
          x: canvas.getBoundingClientRect().x,
        },
        transform: getComputedStyle(canvas).transform,
        regions: selectors.map((selector) => {
          const el = document.querySelector(selector)
          const r = el.getBoundingClientRect()
          return { selector, x: r.x, y: r.y, width: r.width, height: r.height }
        }),
      }
    })
    check(!layout.overflow, `${label}: no page horizontal overflow`)
    check(layout.transform === 'none', `${label}: dashboard is not globally scaled`)
    check(
      closeEnough(layout.canvas.width, width) && closeEnough(layout.canvas.x, 0),
      `${label}: canvas fills viewport width without letterboxing`
    )
    for (const region of layout.regions) {
      check(
        region.width > 0 && region.height > 0,
        `${label}: ${region.selector} has usable dimensions`
      )
    }
    for (let i = 0; i < layout.regions.length; i++) {
      for (let j = i + 1; j < layout.regions.length; j++) {
        const a = layout.regions[i]
        const b = layout.regions[j]
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        check(
          overlapX < 1 || overlapY < 1,
          `${label}: ${a.selector} and ${b.selector} do not overlap`
        )
      }
    }
    await frame.locator('textarea').fill(`响应式草稿 ${label}`)
    const input = await frame.locator('textarea').boundingBox()
    const iframe = await page.locator('iframe').boundingBox()
    check(
      input.width >= 180 &&
        input.height >= 28 &&
        input.y >= iframe.y - 1 &&
        input.y + input.height <= iframe.y + iframe.height + 1,
      `${label}: card input is usable and contained`
    )
    const small = await documentRect(panel)
    const slot = await documentRect(page.locator('#assistant-placeholder'))
    check(
      closeEnough(small.x, slot.x) &&
        closeEnough(small.y, slot.y) &&
        closeEnough(small.width, slot.width) &&
        closeEnough(small.height, slot.height),
      `${label}: small card matches reserved slot`
    )
    await page.getByRole('button', { name: '展开聊天', exact: true }).click()
    await waitForCard(true)
    const expanded = await documentRect(panel)
    const solar = await documentRect(page.locator('#solar-panel'))
    check(closeEnough(expanded.y, solar.y), `${label}: expansion aligns with solar card top`)
    check(
      closeEnough(expanded.x, small.x) &&
        closeEnough(expanded.width, small.width) &&
        closeEnough(expanded.y + expanded.height, small.y + small.height),
      `${label}: expansion preserves width and bottom edge`
    )
    check(
      page.frames().includes(frame) && frameNavigations === 0,
      `${label}: same iframe survives resizing and expansion`
    )
    check(
      (await frame.locator('textarea').inputValue()) === `响应式草稿 ${label}`,
      `${label}: draft survives expansion`
    )
    await page.getByRole('button', { name: '恢复聊天', exact: true }).click()
    await waitForCard(false)
    const restored = await documentRect(panel)
    check(
      closeEnough(restored.x, small.x) &&
        closeEnough(restored.y, small.y) &&
        closeEnough(restored.height, small.height),
      `${label}: restoration returns to original slot`
    )
    check(
      (await frame.locator('textarea').inputValue()) === `响应式草稿 ${label}`,
      `${label}: draft survives restoration`
    )
    await page.screenshot({ path: `output/playwright/screen-layout-${label}.png`, fullPage: true })
    results.push({ viewport: label, rightColumnWidth: restored.width, cardHeight: restored.height })
  }
  check(errors.length === 0, 'all responsive sizes have no runtime errors')
  return { passed, viewports: results, frameNavigations, runtimeErrors: errors, realApiCalls: 0 }
}
