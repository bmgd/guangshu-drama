import { createHash } from 'node:crypto'

/** 分镜输入指纹：描述 / 提示词 / 旁白变更后视为过期 */
export function computeStoryboardFingerprint(sb: {
  description?: string | null
  imagePrompt?: string | null
  videoPrompt?: string | null
  narrationText?: string | null
}) {
  const payload = [
    sb.description || '',
    sb.imagePrompt || '',
    sb.videoPrompt || '',
    sb.narrationText || '',
  ].join('\n---\n')
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 32)
}

export type ArtifactStatus = 'missing' | 'current' | 'stale'

export function computeArtifactStatus(sb: {
  videoUrl?: string | null
  inputFingerprint?: string | null
  description?: string | null
  imagePrompt?: string | null
  videoPrompt?: string | null
  narrationText?: string | null
}): ArtifactStatus {
  if (!sb.videoUrl) return 'missing'
  const current = computeStoryboardFingerprint(sb)
  if (sb.inputFingerprint && sb.inputFingerprint === current) return 'current'
  return 'stale'
}
