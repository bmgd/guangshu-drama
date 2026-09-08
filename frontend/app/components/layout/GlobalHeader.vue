<template>
  <header class="global-header glass-panel">
    <div class="header-left">
      <button v-if="showBack" class="icon-btn" title="返回项目列表" @click="goBack">
        <ChevronLeft :size="18" />
      </button>
      <div v-if="projectTitle" class="project-title">
        <span class="brand-dot" />
        {{ projectTitle }}
      </div>
      <div v-else class="project-title">
        <span class="brand-dot" />
        光束短剧
      </div>
    </div>

    <div class="header-center">
      <PhaseStepper
        v-if="showStepper"
        :current-phase="currentPhase"
        :completed-phases="completedPhases"
      />
    </div>

    <div class="header-right">
      <template v-if="showModelSelect">
        <ModelSelect
          label="生图"
          service-type="image"
          :model-value="imageConfigId ?? null"
          @update:model-value="(v) => emit('update:imageConfigId', v)"
        />
        <ModelSelect
          label="视频"
          service-type="video"
          :model-value="videoConfigId ?? null"
          @update:model-value="(v) => emit('update:videoConfigId', v)"
        />
      </template>
      <label v-if="showResolution" class="resolution-select">
        <span>分辨率</span>
        <select :value="resolution" @change="onResolutionChange">
          <option v-for="opt in resolutionOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </label>
      <button
        v-if="showTasks"
        class="icon-btn task-btn"
        :class="{ active: stats.running > 0 }"
        title="任务"
        @click="emit('toggleTasks')"
      >
        <Activity :size="16" />
        <span v-if="stats.running > 0" class="task-badge">{{ stats.running }}</span>
      </button>
      <NuxtLink to="/app/library" class="icon-btn" title="素材库">
        <Library :size="16" />
      </NuxtLink>
      <NuxtLink to="/app/settings" class="icon-btn" title="设置">
        <Settings :size="16" />
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ChevronLeft, Settings, Activity, Library } from 'lucide-vue-next'
import PhaseStepper from './PhaseStepper.vue'
import ModelSelect from '../ModelSelect.vue'

withDefaults(defineProps<{
  showBack?: boolean
  showStepper?: boolean
  showTasks?: boolean
  showResolution?: boolean
  showModelSelect?: boolean
  currentPhase?: string
  completedPhases?: string[]
  projectTitle?: string
  resolution?: string
  resolutionOptions?: string[]
  imageConfigId?: number | null
  videoConfigId?: number | null
}>(), {
  resolutionOptions: () => ['480p', '720p', '1080p'],
})

const emit = defineEmits<{
  toggleTasks: []
  'update:resolution': [value: string]
  'update:imageConfigId': [value: number | null]
  'update:videoConfigId': [value: number | null]
}>()

const router = useRouter()
const { stats } = useTasksStore()

function goBack() {
  router.push('/app/projects')
}

function onResolutionChange(e: Event) {
  emit('update:resolution', (e.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.global-header {
  height: var(--header-height);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 12px;
  flex-shrink: 0;
  z-index: 40;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.header-center { display: flex; justify-content: center; }
.header-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.project-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text);
}
.brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
}
.resolution-select {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-3);
}
.resolution-select select {
  min-width: 88px;
  padding: 4px 8px;
  font-size: 12px;
}
.task-btn { position: relative; }
.task-btn.active { color: var(--color-accent); }
.task-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--color-accent);
  color: oklch(0.12 0 0);
  font-size: 9px;
  font-weight: 700;
  display: grid;
  place-items: center;
}
</style>
