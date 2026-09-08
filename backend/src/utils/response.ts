import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export function ok<T>(data: T, message = 'success') {
  return { code: 0, message, data }
}

export function fail(message: string, code = 1) {
  return { code, message, data: null }
}

export function jsonOk<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json(ok(data), status)
}

export function jsonFail(c: Context, message: string, status: ContentfulStatusCode = 400, code = 1) {
  return c.json(fail(message, code), status)
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}
