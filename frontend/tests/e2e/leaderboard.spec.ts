import { test, expect } from './_fixture'

test.describe('排行榜', () => {
  test('打开排行榜页面看到 7 个 Tab', async ({ page }) => {
    await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' })
    // 等导航栏出现说明 Layout 已挂载
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10_000 })

    // 等页面标题出现 - 证明 LeaderboardPage 已挂载
    await expect(page.locator('text=Launchpad 排行榜').first()).toBeVisible({ timeout: 10_000 })

    // 7 个 Tab 关键字(zh-CN) - 注意 LeaderboardPage TABS 数组里有空格: "24h 涨幅" "7 天趋势"
    const tabs = [
      '综合热门',
      '24h 交易量',
      '24h 涨幅',
      '7 天趋势',
      '最新创建',
      '即将毕业',
      '顶级发币者',
    ]
    for (const label of tabs) {
      // 用 text 精确匹配按钮内容(label 是按钮 textContent 的一部分)
      const btn = page.locator('button').filter({ hasText: label }).first()
      await expect(btn).toBeAttached({ timeout: 15_000 })
    }

    // 额外断言:确认 Tab 容器存在
    await expect(page.locator('div.flex.gap-2.min-w-max').first()).toBeVisible()
  })

  test('切换 Tab 内容更新', async ({ page }) => {
    await page.goto('/leaderboard')

    // 点击"🆕 最新创建" Tab
    await page.locator('button').filter({ hasText: '最新创建' }).first().click()

    // 应该看到标题或加载状态 / empty state
    // tab desc 是 "刚发出来的代币"
    await expect(page.locator('text=/刚发出来的代币|暂无数据|🍌/').first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('文档', () => {
  test('打开文档看到左侧目录', async ({ page }) => {
    await page.goto('/docs')

    // 标题(zh-CN: "使用文档")
    await expect(page.locator('text=使用文档').first()).toBeVisible()

    // 左侧目录的章节 id(根据 DocsPage.tsx 的 sections 数组)
    const sectionIds = ['getStarted', 'create', 'trade', 'lp', 'leaderboard', 'comment', 'settings', 'faq', 'support']
    for (const id of sectionIds) {
      // 左侧目录里是 <a href="#id">
      await expect(page.locator(`aside a[href="#${id}"]`).first()).toBeVisible()
    }
  })

  test('点击目录锚点滚动', async ({ page }) => {
    await page.goto('/docs')

    // 点击"快速开始"目录项(对应 section id="getStarted")
    const link = page.locator('aside a[href="#getStarted"]').first()
    await expect(link).toBeVisible()
    await link.click()
    await page.waitForTimeout(500)

    // 滚动后 section 应该可见
    const section = page.locator('section#getStarted')
    await expect(section).toBeInViewport()
  })
})

test.describe('API 错误处理', () => {
  test('404 路由显示正常', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist')
    // 404 或 SPA fallback 都正常
    expect(res?.status()).toBeLessThan(500)
  })

  test('API 错误响应格式', async ({ request }) => {
    // 用错地址格式触发错误 - 服务端应该返回 4xx
    // (400 校验失败 / 429 rate-limit / 403 forbidden 都算符合预期)
    const res = await request.get('http://localhost:3001/api/leaderboard?type=invalid')
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('rate limit 触发', async ({ request }) => {
    // 短时间内打 25 次评论接口
    const promises: Promise<any>[] = []
    for (let i = 0; i < 25; i++) {
      promises.push(
        request.post('http://localhost:3001/api/comments', {
          data: {
            tokenAddress: '0xtoken',
            chainId: 97,
            userAddress: '0x1234567890123456789012345678901234567890',
            content: 'spam',
          },
        })
      )
    }
    const results = await Promise.all(promises)

    // 至少有一个是 429
    const rateLimited = results.some(r => r.status() === 429)
    expect(rateLimited).toBe(true)
  })
})
