<template>
  <div class="project-card card card-hover" @click="emit('click')">
    <div class="card-thumb">
      <img v-if="drama.thumbnail" :src="drama.thumbnail" alt="" />
      <div v-else class="thumb-placeholder">
        <Clapperboard :size="28" style="opacity:0.4" />
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-title">{{ drama.title }}</h3>
      <p class="card-desc">{{ drama.description || '暂无描述' }}</p>
      <div class="card-meta">
        <span class="badge">{{ styleLabel }}</span>
        <span class="badge" :class="statusClass">{{ statusLabel }}</span>
        <span v-if="episodeCount != null" class="badge muted">{{ episodeCount }} 集</span>
        <span class="card-date">{{ relativeUpdated }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clapperboard } from 'lucide-vue-next'
import type { Drama } from '../../composables/useWorkbench'

const props = defineProps<{ drama: Drama }>()
const emit = defineEmits<{ click: [] }>()

const styleLabel = computed(() => props.drama.style || '3d')
const statusLabel = computed(() => {
  const map: Record<string, string> = { draft: '草稿', processing: '制作中', completed: '已完成' }
  return map[props.drama.status] || props.drama.status
})
const statusClass = computed(() => {
  if (props.drama.status === 'completed') return 'success'
  if (props.drama.status === 'processing') return 'accent'
  return ''
})
const episodeCount = computed(() => props.drama.totalEpisodes ?? null)

const relativeUpdated = computed(() => formatRelative(props.drama.updatedAt))

function formatRelative(iso: string) {
  try {
    const date = new Date(iso)
    const diffMs = Date.now() - date.getTime()
    if (Number.isNaN(diffMs)) return ''
    const sec = Math.floor(diffMs / 1000)
    if (sec < 60) return '刚刚'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} 分钟前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} 小时前`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day} 天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>

<style scoped>
.project-card { overflow: hidden; padding: 0; }
.card-thumb {
  aspect-ratio: 16/9;
  overflow: hidden;
  background: linear-gradient(135deg, oklch(0.22 0.03 280), oklch(0.18 0.02 300));
  display: grid;
  place-items: center;
}
.card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { color: var(--color-text-3); }
.card-body { padding: 14px 16px; }
.card-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.card-desc {
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
.card-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.badge.muted { opacity: 0.8; }
.card-date { margin-left: auto; font-size: 11px; color: var(--color-text-3); }
</style>
