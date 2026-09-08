<template>
  <div v-if="open" class="task-drawer">
    <div class="drawer-header">
      <h3>任务列表</h3>
      <button class="icon-btn" @click="emit('close')"><X :size="16" /></button>
    </div>
    <div class="drawer-body">
      <div v-for="task in tasks" :key="task.id" class="task-row">
        <div class="task-meta">
          <span class="badge" :class="statusBadge(task.status)">
            {{ statusLabel(task.status) }}
          </span>
          <span>#{{ task.id }} · {{ task.type }}</span>
          <button
            v-if="task.status === 'failed'"
            class="retry-btn"
            title="重试"
            @click="emit('retry', task.id)"
          >
            重试
          </button>
          <button
            v-if="task.status === 'processing' || task.status === 'pending'"
            class="cancel-btn"
            title="取消"
            @click="emit('cancel', task.id)"
          >
            取消
          </button>
        </div>
        <span class="task-prompt">{{ task.prompt?.slice(0, 50) || '无提示词' }}</span>
        <div v-if="task.progress != null" class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${Math.min(100, Math.max(0, task.progress))}%` }" />
          </div>
          <span class="progress-label">{{ task.progress }}%</span>
        </div>
        <span v-else-if="isProcessing(task.status)" class="task-progress">
          处理中...
          <template v-if="elapsedHint(task)"> · {{ elapsedHint(task) }}</template>
        </span>
        <button
          v-if="task.events?.length"
          class="events-toggle"
          type="button"
          @click="toggleEvents(task.id)"
        >
          {{ expanded.has(task.id) ? '收起事件' : `事件 (${task.events.length})` }}
        </button>
        <ul v-if="expanded.has(task.id) && task.events?.length" class="events-list">
          <li v-for="ev in task.events.slice(0, 8)" :key="ev.id">
            <span class="ev-name">{{ ev.event }}</span>
            <span v-if="ev.message" class="ev-msg">{{ ev.message }}</span>
            <span v-if="ev.progress != null" class="ev-prog">{{ ev.progress }}%</span>
          </li>
        </ul>
        <span v-if="task.errorMsg" class="task-error">{{ task.errorMsg }}</span>
      </div>
      <div v-if="!tasks.length" class="empty">暂无任务，生成图片或视频后会显示在这里</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { TaskItem } from '../../composables/useTasksStore'

defineProps<{
  open: boolean
  tasks: TaskItem[]
}>()

const emit = defineEmits<{
  close: []
  retry: [id: number]
  cancel: [id: number]
}>()

const expanded = ref(new Set<number>())
const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  tickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
})
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})

function toggleEvents(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function isProcessing(status: string) {
  return status === 'processing' || status === 'pending'
}

function elapsedHint(task: TaskItem) {
  void nowTick.value
  if (!task.createdAt || !isProcessing(task.status)) return ''
  const start = Date.parse(task.createdAt)
  if (!Number.isFinite(start)) return ''
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000))
  if (sec < 60) return `已运行 ${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `已运行 ${min}m${rem}s`
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    processing: '处理中',
    pending: '排队',
    completed: '完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return map[status] || status
}

function statusBadge(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'cancelled') return ''
  return 'accent'
}
</script>

<style scoped>
.task-drawer {
  position: fixed;
  right: 0;
  top: var(--header-height);
  bottom: 0;
  width: min(380px, 90vw);
  background: var(--color-bg-card);
  border-left: 1px solid var(--color-hairline);
  z-index: 60;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-panel);
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-hairline);
}
.drawer-header h3 { font-size: 14px; font-weight: 600; }
.drawer-body { flex: 1; overflow-y: auto; padding: 12px; }
.task-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-hairline-soft);
  font-size: 12px;
}
.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.retry-btn, .cancel-btn {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 11px;
}
.cancel-btn { margin-left: 0; }
.task-prompt { color: var(--color-text-3); }
.task-progress { color: var(--color-accent); font-size: 11px; }
.task-error { color: var(--color-danger); font-size: 11px; }
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--color-hairline-soft);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}
.progress-label { font-size: 11px; color: var(--color-text-3); min-width: 32px; }
.events-toggle {
  align-self: flex-start;
  padding: 0;
  font-size: 11px;
  color: var(--color-text-3);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}
.events-list {
  margin: 0;
  padding-left: 14px;
  color: var(--color-text-3);
  font-size: 11px;
}
.events-list li { margin: 2px 0; }
.ev-name { font-weight: 600; margin-right: 4px; }
.ev-prog { margin-left: 4px; opacity: 0.8; }
.empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-text-3);
  font-size: 13px;
}
</style>
