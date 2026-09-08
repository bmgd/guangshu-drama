<template>
  <div class="studio-shell">
    <GlobalHeader
      :show-back="true"
      :show-stepper="showStepper"
      :show-tasks="true"
      :show-resolution="showResolution"
      :show-model-select="showModelSelect"
      :current-phase="currentPhase"
      :completed-phases="completedPhases"
      :project-title="projectTitle"
      :resolution="resolution"
      :resolution-options="resolutionOptions"
      :image-config-id="imageConfigId"
      :video-config-id="videoConfigId"
      @toggle-tasks="showTaskDrawer = !showTaskDrawer"
      @update:resolution="onResolutionUpdate"
      @update:image-config-id="(v) => emit('update:imageConfigId', v)"
      @update:video-config-id="(v) => emit('update:videoConfigId', v)"
    />

    <div v-if="!configReady" class="banner">
      <span>尚未配置 AI 模型服务，部分功能不可用</span>
      <NuxtLink to="/app/settings" class="btn primary">前往设置</NuxtLink>
    </div>

    <div class="studio-body">
      <AssetSidebar
        v-if="dramaId"
        :drama-id="dramaId"
        :episodes="episodes"
        :characters="characters"
        :scenes="scenes"
        :props-list="propsList"
        :active-episode-id="activeEpisodeId"
        :active-nav="activeNav"
        @select-episode="onSelectEpisode"
        @add-episode="emit('addEpisode')"
      />

      <main class="studio-main">
        <div class="studio-content">
          <slot />
        </div>
      </main>

      <div
        class="agent-panel"
        :class="{ collapsed: !assistantPanelOpen }"
        :style="{ width: assistantPanelOpen ? `${displayedWidth}px` : '0' }"
      >
        <AssistantResizeHandle
          v-if="assistantPanelOpen"
          :width="displayedWidth"
          :is-resizing="isResizing"
          @resize-start="onResizeStart"
          @resize-double-click="onResizeDoubleClick"
        />
        <div
          class="agent-panel-inner"
          :class="{ hidden: !assistantPanelOpen }"
        >
          <AgentCopilot
            :loading="agentLoading"
            :drama-id="dramaId"
            :episode-id="activeEpisodeId"
            @rewrite="emit('agentRewrite')"
            @extract="emit('agentExtract')"
            @storyboard="emit('agentStoryboard')"
            @pipeline="emit('agentPipeline')"
          />
        </div>
      </div>
    </div>

    <button
      class="agent-float-btn"
      :class="{ hidden: assistantPanelOpen }"
      title="打开 Agent 助手"
      @click="toggleAssistantPanel"
    >
      <Bot :size="20" />
    </button>

    <TaskDrawer
      :open="showTaskDrawer"
      :tasks="tasks"
      @close="showTaskDrawer = false"
      @retry="onRetry"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import GlobalHeader from '../components/layout/GlobalHeader.vue'
import AssetSidebar from '../components/layout/AssetSidebar.vue'
import TaskDrawer from '../components/layout/TaskDrawer.vue'
import AgentCopilot from '../components/copilot/AgentCopilot.vue'
import AssistantResizeHandle from '../components/layout/AssistantResizeHandle.vue'
import type { Episode } from '../composables/useWorkbench'
import { clampAssistantPanelWidth } from '../composables/useAppStore'
import { api } from '../composables/useApi'

const props = defineProps<{
  dramaId?: number
  episodes?: Episode[]
  characters?: any[]
  scenes?: any[]
  propsList?: any[]
  activeEpisodeId?: number
  activeNav?: string
  showStepper?: boolean
  showResolution?: boolean
  showModelSelect?: boolean
  currentPhase?: string
  completedPhases?: string[]
  projectTitle?: string
  agentLoading?: boolean
  resolution?: string
  resolutionOptions?: string[]
  imageConfigId?: number | null
  videoConfigId?: number | null
}>()

const emit = defineEmits<{
  selectEpisode: [ep: Episode]
  addEpisode: []
  agentRewrite: []
  agentExtract: []
  agentStoryboard: []
  agentPipeline: []
  'update:resolution': [value: string]
  'update:imageConfigId': [value: number | null]
  'update:videoConfigId': [value: number | null]
}>()

const {
  assistantPanelOpen,
  assistantPanelWidth,
  configReady,
  toggleAssistantPanel,
  setAssistantPanelWidth,
  ASSISTANT_PANEL_DEFAULT_WIDTH,
} = useAppStore()

const { tasks, fetchTasks } = useTasksStore()
const router = useRouter()
const showTaskDrawer = ref(false)
const notifiedReview = ref(new Set<number>())

const isResizing = ref(false)
const draftWidth = ref<number | null>(null)
const displayedWidth = computed(() => draftWidth.value ?? assistantPanelWidth.value)

let dragStart: { x: number; width: number } | null = null

function onResizeStart(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  dragStart = { x: e.clientX, width: assistantPanelWidth.value }
  isResizing.value = true
  draftWidth.value = assistantPanelWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (ev: MouseEvent) => {
    if (!dragStart) return
    if ((ev.buttons & 1) === 0) { finish(); return }
    draftWidth.value = clampAssistantPanelWidth(dragStart.width + (dragStart.x - ev.clientX))
  }
  const finish = () => {
    if (draftWidth.value != null) setAssistantPanelWidth(draftWidth.value)
    draftWidth.value = null
    dragStart = null
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', finish)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', finish)
}

function onResizeDoubleClick() {
  setAssistantPanelWidth(ASSISTANT_PANEL_DEFAULT_WIDTH)
}

function onSelectEpisode(ep: Episode) {
  emit('selectEpisode', ep)
  if (props.dramaId) {
    router.push(`/app/projects/${props.dramaId}/episodes/${ep.episodeNumber}?episodeId=${ep.id}`)
  }
}

function onResolutionUpdate(value: string) {
  emit('update:resolution', value)
}

function maybeNotifyReview(task: { id: number; status: string; errorMsg?: string }) {
  if (task.status !== 'failed' || !task.errorMsg?.includes('CONTENT_REVIEW')) return
  if (notifiedReview.value.has(task.id)) return
  notifiedReview.value.add(task.id)
  toast.error('内容审核未通过，建议切换模型后重试')
}

async function onRetry(taskId: number) {
  try {
    await api(`/tasks/${taskId}/retry`, { method: 'POST' })
    if (props.dramaId) await fetchTasks(props.dramaId)
  } catch (err) {
    console.error(err)
  }
}

async function onCancel(taskId: number) {
  try {
    await api(`/tasks/${taskId}/cancel`, { method: 'POST' })
    if (props.dramaId) await fetchTasks(props.dramaId)
  } catch (err) {
    console.error(err)
  }
}

watch(tasks, (list) => {
  for (const t of list) maybeNotifyReview(t)
}, { deep: true })

onMounted(async () => {
  try {
    const res = await $fetch<{ data: { configured: boolean } }>('/api/v1/ai-configs/status')
    configReady.value = res.data.configured
  } catch {
    configReady.value = false
  }
  if (props.dramaId) fetchTasks(props.dramaId)
})

watch(() => props.dramaId, (id) => {
  if (id) fetchTasks(id)
})
</script>

<style scoped>
.agent-panel-inner {
  height: 100%;
  transition: opacity 0.2s;
}
.agent-panel-inner.hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
