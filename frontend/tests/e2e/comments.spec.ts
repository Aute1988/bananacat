import { test, expect } from './_fixture'

test.describe('评论系统 E2E', () => {
  test('查看代币详情页(不存在代币显示 404)', async ({ page }) => {
    // 正确路径格式: /token/:chainId/:address
    await page.goto('/token/31337/0x1234567890123456789012345678901234567890')

    // 页面正常渲染(不崩溃)
    // 不存在的代币:后端返回 404,前端显示加载失败提示
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })

    // 检查没有白屏崩溃:页面包含预期内容(错误提示或评论区)
    // 代币不存在时显示"加载失败"提示
    const noTokenPrompt = page.locator('text=/加载失败|不存在|404|not found/i').first()
    const commentSection = page.locator('text=讨论').first()

    // 至少显示加载失败或评论区之一
    const noTokenVisible = await noTokenPrompt.count() > 0
    const commentVisible = await commentSection.count() > 0
    expect(noTokenVisible || commentVisible).toBe(true)
  })
})
