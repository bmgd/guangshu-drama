import { api } from './useApi'
import type { Drama, Episode } from './useWorkbench'

export interface ProjectData {
  drama: Drama | null
  episodes: Episode[]
  characters: any[]
  scenes: any[]
  props: any[]
}

export function useProjectsStore() {
  const dramas = useState<Drama[]>('dramas', () => [])
  const currentDramaId = useState<number | null>('currentDramaId', () => null)
  const currentProjectData = useState<ProjectData>('currentProjectData', () => ({
    drama: null,
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
  }))
  const loading = useState('projectsLoading', () => false)

  async function fetchDramas() {
    loading.value = true
    try {
      dramas.value = await api<Drama[]>('/dramas')
    } finally {
      loading.value = false
    }
  }

  async function loadProject(dramaId: number) {
    currentDramaId.value = dramaId
    const [drama, episodes, characters, scenes, props] = await Promise.all([
      api<Drama>(`/dramas/${dramaId}`),
      api<Episode[]>(`/episodes?dramaId=${dramaId}`),
      api<any[]>(`/characters?dramaId=${dramaId}`),
      api<any[]>(`/scenes?dramaId=${dramaId}`),
      api<any[]>(`/props?dramaId=${dramaId}`),
    ])
    currentProjectData.value = { drama, episodes, characters, scenes, props }
    return currentProjectData.value
  }

  function getDramaTitle(id: number) {
    return dramas.value.find((d) => d.id === id)?.title || `项目 #${id}`
  }

  return {
    dramas,
    currentDramaId,
    currentProjectData,
    loading,
    fetchDramas,
    loadProject,
    getDramaTitle,
  }
}
