// 自动重置 env 缓存,确保每个测试拿到的都是当前 process.env 的值
beforeEach(async () => {
  try {
    const { resetEnv } = await import('../src/config.js')
    resetEnv()
  } catch {}
})

const { getEnv, resetEnv } = await import('../src/config.js')

describe('env 解析', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    originalEnv = { ...process.env }
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    // 恢复原始环境变量(避免污染其他 test 文件)
    process.env = { ...originalEnv }
    resetEnv()
  })

  it('没设环境变量时,FACTORY 用占位地址且不崩溃', async () => {
    delete process.env.BSC_FACTORY
    delete process.env.ETH_FACTORY
    delete process.env.ROBINHOOD_FACTORY
    delete process.env.ARC_FACTORY
    resetEnv()
    const env = getEnv()
    expect(env.BSC_FACTORY).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(env.ETH_FACTORY).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('合法的 FACTORY 地址会被接受', async () => {
    process.env.BSC_FACTORY = '0x1234567890123456789012345678901234567890'
    resetEnv()
    const env = getEnv()
    expect(env.BSC_FACTORY).toBe('0x1234567890123456789012345678901234567890')
  })

  it('非法的 FACTORY 地址会抛错', async () => {
    process.env.BSC_FACTORY = 'not-an-address'
    resetEnv()
    expect(() => getEnv()).toThrow()
  })

  it('短地址会被拒', async () => {
    process.env.BSC_FACTORY = '0x1234'
    resetEnv()
    expect(() => getEnv()).toThrow()
  })

  it('PORT 默认 3001', async () => {
    delete process.env.PORT
    resetEnv()
    const env = getEnv()
    expect(env.PORT).toBe(3001)
  })

  it('PORT 转 number', async () => {
    process.env.PORT = '8080'
    resetEnv()
    const env = getEnv()
    expect(env.PORT).toBe(8080)
  })

  it('SYNC_FROM_BLOCK 转 bigint', async () => {
    process.env.SYNC_FROM_BLOCK = '12345'
    resetEnv()
    const env = getEnv()
    expect(env.SYNC_FROM_BLOCK).toBe(12345n)
  })
})
