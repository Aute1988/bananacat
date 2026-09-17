/**
 * IPFS 上传服务
 *
 * 支持的存储后端(通过环境变量切换):
 *  - Pinata (推荐,免费 1GB):  https://www.pinata.cloud
 *  - Infura IPFS (免费):        https://infura.io/product/ipfs
 *  - 本地(开发):存到 backend/uploads/,返回本地 URL
 *
 * 使用:
 *   const url = await uploadFile(buffer, 'logo.png', 'image/png')
 */

const fs = await import('fs/promises')
const path = await import('path')
const crypto = await import('crypto')

const PINATA_API_KEY = process.env.PINATA_API_KEY
const PINATA_SECRET = process.env.PINATA_SECRET
const PINATA_JWT = process.env.PINATA_JWT         // 新版推荐用 JWT
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID
const INFURA_PROJECT_SECRET = process.env.INFURA_PROJECT_SECRET

/**
 * 上传文件到 IPFS,返回可访问的 URL(优先 ipfs:// 否则 https gateway)
 */
export async function uploadToIPFS(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ cid: string; url: string }> {
  // 优先级: Pinata > Infura > 本地 fallback
  if (PINATA_JWT || (PINATA_API_KEY && PINATA_SECRET)) {
    return uploadToPinata(buffer, filename, mimeType)
  }
  if (INFURA_PROJECT_ID && INFURA_PROJECT_SECRET) {
    return uploadToInfura(buffer, filename)
  }
  return uploadToLocal(buffer, filename)
}

// ============================================================
// Pinata(推荐)
// ============================================================

/**
 * 带超时的 fetch 封装
 */
async function fetchWithTimeout(url: string, options: RequestInit, ms = 30_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function uploadToPinata(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ cid: string; url: string }> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename)

  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS'

  const headers: Record<string, string> = {}
  if (PINATA_JWT) {
    headers['Authorization'] = `Bearer ${PINATA_JWT}`
  } else {
    headers['pinata_api_key'] = PINATA_API_KEY!
    headers['pinata_secret_api_key'] = PINATA_SECRET!
  }

  const res = await fetchWithTimeout(url, { method: 'POST', headers, body: form })
  if (!res.ok) {
    throw new Error(`Pinata ${res.status}: ${await res.text()}`)
  }
  const data = await res.json() as { IpfsHash: string }
  const cid = data.IpfsHash
  return {
    cid,
    url: `https://gateway.pinata.cloud/ipfs/${cid}`,
  }
}

// ============================================================
// Infura IPFS
// ============================================================

async function uploadToInfura(
  buffer: Buffer,
  filename: string
): Promise<{ cid: string; url: string }> {
  const auth = Buffer.from(`${INFURA_PROJECT_ID}:${INFURA_PROJECT_SECRET}`).toString('base64')
  const url = `https://ipfs.infura.io:5001/api/v0/add?wrap-with-directory=false`

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)]), filename)

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Infura ${res.status}: ${await res.text()}`)
  const data = await res.json() as { Hash: string }
  return {
    cid: data.Hash,
    url: `https://ipfs.io/ipfs/${data.Hash}`,
  }
}

// ============================================================
// 本地 fallback(开发用)
// ============================================================

async function uploadToLocal(
  buffer: Buffer,
  filename: string
): Promise<{ cid: string; url: string }> {
  const uploadDir = path.resolve(process.cwd(), 'uploads')
  await fs.mkdir(uploadDir, { recursive: true })

  // 生成 CID(简化版,用 hash 前缀)
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const cid = `Qm${hash.slice(0, 46)}`  // 伪 CID

  const ext = path.extname(filename)
  const localName = `${cid}${ext}`
  await fs.writeFile(path.join(uploadDir, localName), buffer)

  const baseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
  return { cid, url: `${baseUrl}/uploads/${localName}` }
}

/**
 * 校验上传大小限制(默认 5MB,Logo 一般够)
 */
export function validateFile(size: number, maxMB = 5): void {
  const maxBytes = maxMB * 1024 * 1024
  if (size > maxBytes) {
    throw new Error(`文件过大(上限 ${maxMB}MB)`)
  }
}
