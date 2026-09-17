/**
 * ipfs.ts 单元测试
 * 覆盖:文件大小校验、base64 格式校验
 */
import { describe, it, expect } from 'vitest'
import { validateFile } from '../src/ipfs.js'

describe('validateFile', () => {
  it('5MB 内合法', () => {
    expect(() => validateFile(1024)).not.toThrow()
    expect(() => validateFile(5 * 1024 * 1024)).not.toThrow()
  })

  it('超过 5MB 抛错', () => {
    expect(() => validateFile(5 * 1024 * 1024 + 1)).toThrow('文件过大')
  })

  it('可以自定义上限', () => {
    expect(() => validateFile(2 * 1024 * 1024, 1)).toThrow('文件过大')
    expect(() => validateFile(500 * 1024, 1)).not.toThrow()
  })

  it('边界值:刚好等于上限', () => {
    expect(() => validateFile(1024 * 1024, 1)).not.toThrow()
  })
})
