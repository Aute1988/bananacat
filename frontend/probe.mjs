import { chromium } from '@playwright/test'

const URL = 'http://127.0.0.1:5173/bananacat/'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1395, height: 694 } })
const page = await ctx.newPage()

const consoleMsgs = []
const pageErrors = []
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => pageErrors.push(`PAGEERROR: ${e.message}\n${e.stack || ''}`))
page.on('requestfailed', r =>
  pageErrors.push(`REQFAIL: ${r.url()} - ${r.failure()?.errorText}`)
)

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 })
} catch (e) {
  console.log('GOTO ERROR:', e.message)
}

await page.waitForTimeout(4000)

// full-page screenshot
await page.screenshot({ path: '/tmp/banana-full.png', fullPage: true })
// viewport screenshot
await page.screenshot({ path: '/tmp/banana-viewport.png', fullPage: false })

const dump = await page.evaluate(() => {
  const out = {}
  out.viewport = { w: window.innerWidth, h: window.innerHeight }
  const root = document.getElementById('root')
  out.hasRoot = !!root
  out.rootHTMLLen = root ? root.innerHTML.length : -1
  out.rootStyle = root ? root.getAttribute('style') : null
  out.rootComputed = root ? {
    minHeight: getComputedStyle(root).minHeight,
    height: getComputedStyle(root).height,
    position: getComputedStyle(root).position,
    zIndex: getComputedStyle(root).zIndex,
    rect: root.getBoundingClientRect(),
  } : null
  // first 4 children of root
  const kids = root ? Array.from(root.children).slice(0, 4) : []
  out.rootKids = kids.map(k => {
    const cs = getComputedStyle(k)
    return {
      tag: k.tagName,
      cls: k.className,
      pos: cs.position,
      zIndex: cs.zIndex,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      minH: cs.minHeight,
      h: cs.height,
      w: cs.width,
      font: cs.fontSize,
      rect: k.getBoundingClientRect(),
      childCount: k.children.length,
    }
  })
  // nav element?
  const nav = document.querySelector('nav')
  out.hasNav = !!nav
  if (nav) {
    const r = nav.getBoundingClientRect()
    out.navRect = { l: r.left, t: r.top, w: r.width, h: r.height }
  }
  // h1?
  const h1 = document.querySelector('h1')
  out.hasH1 = !!h1
  if (h1) {
    const r = h1.getBoundingClientRect()
    const cs = getComputedStyle(h1)
    out.h1 = {
      text: h1.textContent.slice(0, 80),
      fontSize: cs.fontSize,
      color: cs.color,
      visibility: cs.visibility,
      rect: { l: r.left, t: r.top, w: r.width, h: r.height },
    }
  }
  // hero gradient text?
  const hero = document.querySelector('.text-gradient-banana, .text-gradient-cosmic')
  out.hasHeroGradient = !!hero
  // body / html style
  out.bodyHTMLHeight = document.body.scrollHeight
  out.docHTMLHeight = document.documentElement.scrollHeight
  return out
})

console.log('=== CONSOLE MSGS ===')
consoleMsgs.forEach(m => console.log(m))
console.log('=== PAGE ERRORS ===')
pageErrors.forEach(e => console.log(e))
console.log('=== DOM DUMP ===')
console.log(JSON.stringify(dump, null, 2))

await browser.close()
