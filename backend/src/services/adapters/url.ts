/**
 * 将本地静态路径转为可被外部 AI 厂商拉取的绝对 URL。
 * - 已是 http(s) 则原样返回
 * - /static/... 或相对路径则拼接 PUBLIC_BASE_URL / 传入的 publicBaseUrl
 */
export function resolveMediaUrl(localOrAbsolute?: string | null, publicBaseUrl?: string): string | undefined {
  if (!localOrAbsolute) return undefined
  const trimmed = localOrAbsolute.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const base = (publicBaseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:5679').replace(/\/$/, '')
  if (trimmed.startsWith('/static')) return `${base}${trimmed}`
  if (trimmed.startsWith('static/')) return `${base}/${trimmed}`
  return `${base}/static/${trimmed.replace(/^\/+/, '')}`
}

export async function resolveMediaUrlForProvider(
  localOrAbsolute?: string | null,
  opts?: { publicBaseUrl?: string; allowDataUrl?: boolean; localFilePath?: string },
): Promise<string | undefined> {
  if (!localOrAbsolute && !opts?.localFilePath) return undefined
  const raw = (localOrAbsolute || '').trim()
  if (opts?.allowDataUrl && /^data:/i.test(raw)) return raw
  if (raw) return resolveMediaUrl(raw, opts?.publicBaseUrl)
  if (opts?.localFilePath) return resolveMediaUrl(opts.localFilePath, opts.publicBaseUrl)
  return undefined
}

export function requirePublicMediaUrl(url: string | undefined): string {
  if (!url) throw new Error('缺少媒体地址')
  if (/localhost|127\.0\.0\.1/.test(url) && !process.env.PUBLIC_BASE_URL && /\/static/.test(url)) {
    throw new Error('本地参考图需要配置 PUBLIC_BASE_URL 供云端模型拉取，或使用公网 URL')
  }
  return url
}

export function assertReachableMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (/localhost|127\.0\.0\.1/.test(url) && !process.env.PUBLIC_BASE_URL) {
    throw new Error('参考图为本地地址，请设置环境变量 PUBLIC_BASE_URL 为可被模型访问的公网地址')
  }
  return url
}
