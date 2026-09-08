export function mapProviderError(provider: string, status: number, body: string): Error {
  const snippet = (body || '').replace(/\s+/g, ' ').slice(0, 200)
  const lower = `${body || ''}`.toLowerCase()
  const label = provider || '厂商'

  if (
    /审核|敏感|违规|风控|content.?policy|moderation|sensitive|risk|blocked|safety/i.test(body || '')
    || /审核|敏感|违规|风控/.test(body || '')
  ) {
    return new Error(`[CONTENT_REVIEW] ${label}内容审核未通过: ${snippet || '请求被拒绝'}`)
  }

  if (status === 401 || status === 403 || /unauthorized|invalid.?api.?key|authentication|鉴权|密钥/.test(lower)) {
    return new Error(`[AUTH] ${label}鉴权失败，请检查 API Key: ${snippet || `HTTP ${status}`}`)
  }

  if (status === 429 || /rate.?limit|too many requests|限流|配额/.test(lower)) {
    return new Error(`[RATE_LIMIT] ${label}请求过于频繁，请稍后重试: ${snippet || `HTTP ${status}`}`)
  }

  if (status === 408 || /timeout|timed?\s*out|超时/.test(lower)) {
    return new Error(`[TIMEOUT] ${label}请求超时: ${snippet || `HTTP ${status}`}`)
  }

  return new Error(`[PROVIDER_ERROR] ${label}请求失败 (HTTP ${status}): ${snippet || '未知错误'}`)
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  ms = 60000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || /aborted|timeout/i.test(err.message))) {
      throw new Error(`[TIMEOUT] 请求超时（${ms}ms）: ${url}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
