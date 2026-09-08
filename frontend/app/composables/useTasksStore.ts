import { api } from './useApi'

export interface TaskItem {
  id: number
  type: string
  status: string
  prompt?: string
  errorMsg?: string
  storyboardId?: number
  createdAt?: string
  progress?: number | null
  events?: Array<{
    id: number
    event: string
    message?: string | null
    progress?: number | null
    createdAt: string
  }>
}

export function useTasksStore() {
  const tasks = useState<TaskItem[]>('tasks', () => [])
  const stats = computed(() => {
    const running = tasks.value.filter((t) => t.status === 'processing').length
    const queued = tasks.value.filter((t) => t.status === 'pending').length
    const completed = tasks.value.filter((t) => t.status === 'completed').length
    const failed = tasks.value.filter((t) => t.status === 'failed').length
    return { running, queued, completed, failed, total: tasks.value.length }
  })

  async function fetchTasks(dramaId?: number) {
    const query = dramaId ? `?dramaId=${dramaId}` : ''
    tasks.value = await api<TaskItem[]>(`/tasks${query}`)
    return tasks.value
  }

  return { tasks, stats, fetchTasks }
}
