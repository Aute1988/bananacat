/**
 * LogoUpload - IPFS Logo 上传组件
 *
 * 工作原理:
 *   1. 用户拖拽 / 选择图片
 *   2. 压缩到 ≤ 1024px,自动 JPEG/PNG
 *   3. 转 Base64 后 post 到 /api/upload/base64
 *   4. 后端上传到 Pinata(或其他)
 *   5. 返回 ipfs://CID 和 gateway URL
 *   6. 表单 imageUrl 自动填入
 */
import { useState, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const MAX_FILE_MB = 5
const MAX_DIMENSION = 1024

interface Props {
  value: string
  onChange: (url: string, cid?: string) => void
}

export default function LogoUpload({ value, onChange }: Props) {
  const [uploadState, setUploadState] = useState<'idle' | 'compressing' | 'uploading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [cid, setCid] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件 (PNG, JPG, GIF, WebP)')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`文件超过 ${MAX_FILE_MB}MB`)
      return
    }

    // ===== 压缩 =====
    setUploadState('compressing')
    try {
      const dataUrl = await compressImage(file)

      // ===== 上传 =====
      setUploadState('uploading')
      const res = await fetch(`${API_BASE}/api/upload/base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: file.name }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '上传失败' }))
        throw new Error(err.error || '上传失败')
      }

      const { cid, url } = await res.json()
      setCid(cid)
      onChange(url, cid)
      setUploadState('done')
      setTimeout(() => setUploadState('idle'), 3000)
    } catch (err: any) {
      setError(err.message || '处理失败')
      setUploadState('error')
    }
  }

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_DIMENSION
            width = MAX_DIMENSION
          } else {
            width = (width / height) * MAX_DIMENSION
            height = MAX_DIMENSION
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        // JPEG 压缩到 0.85
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="cursor-pointer border-2 border-dashed border-white/10 hover:border-yellow-500/30 rounded-xl p-4 text-center transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {value ? (
          <div className="space-y-2">
            <img src={value} alt="logo" className="w-24 h-24 mx-auto rounded-xl object-cover border-2 border-yellow-500/30" />
            <p className="text-xs text-green-400">✅ Logo 已上传</p>
            {cid && <p className="text-xs text-gray-500 font-mono truncate">CID: {cid}</p>}
            <p className="text-xs text-gray-400">点击或拖拽新图片替换</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-2">{uploadState === 'idle' ? '🖼️' : ''}</div>
            <p className="text-sm text-gray-300">点击或拖拽图片到此处上传</p>
            <p className="text-xs text-gray-500 mt-1">PNG / JPG / GIF / WebP,最大 {MAX_FILE_MB}MB</p>
          </>
        )}
      </div>

      {/* 状态条 */}
      {uploadState !== 'idle' && (
        <div className="mt-2 text-xs flex items-center justify-center gap-2">
          {uploadState === 'compressing' && <span className="text-blue-400">🔄 压缩中...</span>}
          {uploadState === 'uploading' && <span className="text-yellow-400 animate-pulse">📤 上传到 IPFS...</span>}
          {uploadState === 'done' && <span className="text-green-400">✅ 完成</span>}
          {uploadState === 'error' && <span className="text-red-400">❌ {error}</span>}
        </div>
      )}

      {error && uploadState !== 'error' && (
        <p className="text-xs text-red-400 mt-2">⚠️ {error}</p>
      )}

      {/* 或手动粘贴 URL */}
      <div className="mt-3">
        <label className="text-xs text-gray-500">或手动填写 IPFS URL:</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ipfs://... 或 https://..."
          className="banana-input text-sm mt-1"
        />
      </div>
    </div>
  )
}
