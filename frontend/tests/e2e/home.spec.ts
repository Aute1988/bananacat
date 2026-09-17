import { test, expect } from './_fixture'

test.describe('首页', () => {
  test('打开首页看到香蕉猫主题', async ({ page }) => {
    await page.goto('/')

    // 检查标题(包含 香蕉猫 / Banana Cat 任一即可,兼容中英文)
    await expect(page).toHaveTitle(/香蕉猫|Banana Cat/i)

    // 检查 Hero 标题
    await expect(page.locator('text=香蕉猫').first()).toBeVisible()

    // 检查主题色 (黄色 banner)
    const banner = page.locator('text=🍌🐱').first()
    await expect(banner).toBeVisible()
  })

  test('导航栏所有链接可见', async ({ page }) => {
    await page.goto('/')

    // Layout.tsx 中导航链接的中文 label(key)
    const navKeys = ['首页', '发币', '排行榜', '代币列表', '我的代币', '数据分析', '使用文档']
    for (const text of navKeys) {
      // 任意 a 链接文本包含关键字即可(emoji 前缀在前面)
      await expect(page.locator(`nav a`).filter({ hasText: text }).first()).toBeVisible()
    }
  })

  test('切换暗色/亮色主题', async ({ page }) => {
    await page.goto('/')

    // 默认深色
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))

    // 点击主题切换按钮(svg) - ThemeToggle 按钮的 title 包含"切换"
    await page.locator('button[title*="切换"]').first().click()

    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(newTheme).not.toBe(initialTheme)
  })

  test('切换语言到英文', async ({ page }) => {
    await page.goto('/')

    // 找到语言切换器按钮(默认显示当前语言)
    const langBtn = page.locator('button').filter({ hasText: /🇨🇳|🇬🇧|简体中文|English/ }).first()
    await langBtn.click()

    // 下拉里选 English(包含 🇬🇧 标志)
    await page.locator('button').filter({ hasText: '🇬🇧' }).first().click()

    // 验证 html lang="en"
    await expect.poll(
      async () => page.evaluate(() => document.documentElement.lang),
      { timeout: 5_000 }
    ).toBe('en')
  })

  test('PWA manifest 存在', async ({ page }) => {
    await page.goto('/')
    const response = await page.request.get('/manifest.json')
    expect(response.status()).toBe(200)

    const manifest = await response.json()
    expect(manifest.name).toBeTruthy()
    expect(manifest.icons).toBeInstanceOf(Array)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  test('访问 API 健康检查(后端)', async ({ request }) => {
    const res = await request.get('http://localhost:3001/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
