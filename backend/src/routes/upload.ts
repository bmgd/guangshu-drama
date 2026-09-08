import { Hono } from 'hono'
import { jsonOk, jsonFail } from '../utils/response.js'
import { saveBuffer, guessExt } from '../utils/storage.js'

export const uploadRouter = new Hono()

uploadRouter.post('/', async (c) => {
  const body = await c.req.parseBody({ all: true })
  const raw = body.file
  const file = Array.isArray(raw) ? raw[0] : raw
  if (!file || typeof file === 'string') return jsonFail(c, '请上传文件')
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > 50 * 1024 * 1024) return jsonFail(c, '文件不能超过 50MB')
  const ext = guessExt(file.type || 'application/octet-stream')
  const saved = saveBuffer(buffer, 'uploads', ext)
  return jsonOk(c, { url: saved.url, path: saved.relative, size: buffer.length, mimeType: file.type })
})
