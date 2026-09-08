import { api } from './useApi'

export function useAgent() {
  const loading = ref(false)
  const error = ref('')

  async function rewriteScript(episodeId: number, content: string, genre?: string) {
    loading.value = true
    error.value = ''
    try {
      return await api('/agent/rewrite-script', {
        method: 'POST',
        body: JSON.stringify({ episodeId, content, genre }),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '改写失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function generateScript(episodeId: number, brief: string, genre?: string, episodeCount?: number) {
    loading.value = true
    error.value = ''
    try {
      return await api('/agent/generate-script', {
        method: 'POST',
        body: JSON.stringify({ episodeId, brief, genre, episodeCount }),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '从大纲生成失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function extract(episodeId: number, dramaId: number, script?: string) {
    loading.value = true
    try {
      return await api('/agent/extract', {
        method: 'POST',
        body: JSON.stringify({ episodeId, dramaId, script }),
      })
    } finally {
      loading.value = false
    }
  }

  async function storyboard(episodeId: number, script?: string, replace = true) {
    loading.value = true
    try {
      return await api('/agent/storyboard', {
        method: 'POST',
        body: JSON.stringify({ episodeId, script, replace }),
      })
    } finally {
      loading.value = false
    }
  }

  async function chat(
    messages: Array<{ role: string; content: string }>,
    dramaId?: number,
    episodeId?: number,
  ) {
    loading.value = true
    error.value = ''
    try {
      return await api<{
        text: string
        steps: Array<{ index: number; finishReason: string; toolCalls: string[]; text: string }>
        toolCalls: Array<{ toolName: string; args?: unknown }>
      }>('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ messages, dramaId, episodeId }),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '对话失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, rewriteScript, generateScript, extract, storyboard, chat }
}
