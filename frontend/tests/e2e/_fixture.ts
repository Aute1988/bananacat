/**
 * 自定义 test fixture - 自动给每个 page 注入 pageerror / console 监听,
 * 这样白屏时能从日志看到原因,而不是只看到 timeout。
 */
import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    page.on('pageerror', err => {
      console.error(`\n[pageerror][${testInfo.title}]`, err.message)
      if (err.stack) console.error(err.stack)
    })
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`\n[console.error][${testInfo.title}]`, msg.text())
      }
    })
    page.on('requestfailed', req => {
      const url = req.url()
      // 忽略 favicon / sourcemap 等噪音
      if (url.includes('favicon') || url.endsWith('.map')) return
      console.warn(
        `\n[requestfailed][${testInfo.title}]`,
        req.method(),
        url,
        '→',
        req.failure()?.errorText
      )
    })
    await use(page)
  },
})

export { expect }
