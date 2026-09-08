import { api } from './useApi'

export interface Drama {
  id: number
  title: string
  description?: string
  style?: string
  aspectRatio?: string
  status: string
  thumbnail?: string
  totalEpisodes?: number
  contentSource?: string
  creationType?: string
  generationMode?: string
  updatedAt: string
}

export interface Episode {
  id: number
  dramaId: number
  episodeNumber: number
  title: string
  content?: string
  scriptContent?: string
  status: string
  videoUrl?: string
  resolution?: string
  duration?: number
  imageConfigId?: number
  videoConfigId?: number
}

export interface Storyboard {
  id: number
  episodeId: number
  storyboardNumber: number
  title?: string
  shotType?: string
  movement?: string
  description?: string
  imagePrompt?: string
  videoPrompt?: string
  firstFrameImage?: string
  lastFrameImage?: string
  referenceImages?: string
  videoUrl?: string
  composedVideoUrl?: string
  subtitleUrl?: string
  narrationText?: string
  audioUrl?: string
  inputFingerprint?: string
  artifactStatus?: 'missing' | 'current' | 'stale'
  status: string
  duration: number
  locked?: boolean
}

export type VideoBatchItem = {
  storyboardId: number
  prompt: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  referenceImages?: string[]
  resolution?: string
  duration?: number
  ratio?: string
  configId?: number
}

export function useWorkbench(episodeId: Ref<number>, dramaId: Ref<number>) {
  const episode = ref<Episode | null>(null)
  const storyboards = ref<Storyboard[]>([])
  const tasks = ref<any[]>([])
  const loading = ref(false)
  const showTasks = ref(false)

  async function refresh() {
    if (!episodeId.value) return
    episode.value = await api<Episode>(`/episodes/${episodeId.value}`)
    storyboards.value = await api<Storyboard[]>(`/storyboards?episodeId=${episodeId.value}`)
    tasks.value = await api<any[]>(`/tasks?dramaId=${dramaId.value}`)
  }

  async function generatePrompts(type: string, ids: number[]) {
    await api('/prompts/generate', {
      method: 'POST',
      body: JSON.stringify({ type, ids, dramaId: dramaId.value }),
    })
    await refresh()
  }

  async function batchGenerateImages(items: Array<{ type: string; targetId: number; prompt: string; configId?: number; frameType?: 'first' | 'last' }>) {
    await api('/tasks/image/batch', {
      method: 'POST',
      body: JSON.stringify({ items: items.map((i) => ({ ...i, dramaId: dramaId.value })) }),
    })
    showTasks.value = true
    await refresh()
  }

  async function batchGenerateVideos(items: VideoBatchItem[], opts?: { resolution?: string; ratio?: string }) {
    await api('/tasks/video/batch', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((i) => ({
          ...i,
          dramaId: dramaId.value,
          resolution: i.resolution || opts?.resolution || episode.value?.resolution,
          ratio: i.ratio || opts?.ratio,
        })),
      }),
    })
    showTasks.value = true
    await refresh()
  }

  async function patchStoryboard(id: number, fields: Partial<Storyboard> & Record<string, unknown>) {
    const updated = await api<Storyboard>(`/storyboards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    })
    const idx = storyboards.value.findIndex((s) => s.id === id)
    if (idx >= 0) storyboards.value[idx] = { ...storyboards.value[idx], ...updated }
    return updated
  }

  async function retryTask(id: number) {
    return api(`/tasks/${id}/retry`, { method: 'POST' })
  }

  async function composeStoryboard(id: number) {
    return api<{ url: string; subtitleUrl?: string }>(`/merge/compose/${id}`, { method: 'POST' })
  }

  async function mergeEpisode(storyboardIds?: number[]) {
    return api(`/merge/episode/${episodeId.value}`, {
      method: 'POST',
      body: JSON.stringify({ storyboardIds }),
    })
  }

  async function updateEpisodeResolution(resolution: string) {
    if (!episodeId.value) return
    episode.value = await api<Episode>(`/episodes/${episodeId.value}`, {
      method: 'PUT',
      body: JSON.stringify({ resolution }),
    })
  }

  async function updateEpisodeModels(fields: { imageConfigId?: number | null; videoConfigId?: number | null }) {
    if (!episodeId.value) return
    episode.value = await api<Episode>(`/episodes/${episodeId.value}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    })
  }

  const pipelineStatus = computed(() => {
    const hasScript = !!episode.value?.scriptContent
    const hasBoards = storyboards.value.length > 0
    const hasImages = storyboards.value.some((s) => s.firstFrameImage)
    const hasVideos = storyboards.value.some((s) => s.videoUrl)
    const hasMerged = !!episode.value?.videoUrl
    const hasPrompts = storyboards.value.some((s) => s.imagePrompt || s.videoPrompt)
    return { hasScript, hasBoards, hasImages, hasVideos, hasMerged, hasPrompts }
  })

  return {
    episode, storyboards, tasks, loading, showTasks, pipelineStatus,
    refresh, generatePrompts, batchGenerateImages, batchGenerateVideos,
    patchStoryboard, retryTask, composeStoryboard, mergeEpisode, updateEpisodeResolution,
    updateEpisodeModels,
  }
}
