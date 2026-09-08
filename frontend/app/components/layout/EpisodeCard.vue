<template>
  <div
    class="episode-card"
    :class="{ active }"
    @click="emit('click')"
  >
    <div class="ep-thumb">
      <img v-if="episode.thumbnail" :src="episode.thumbnail" alt="" />
      <div v-else class="thumb-placeholder">E{{ episode.episodeNumber }}</div>
    </div>
    <div class="ep-info">
      <div class="ep-title">第{{ episode.episodeNumber }}集</div>
      <div class="ep-sub">{{ episode.title }}</div>
      <div class="ep-meta">
        <span class="badge" :class="statusClass">{{ statusLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Episode } from '../../composables/useWorkbench'

const props = defineProps<{
  episode: Episode
  active?: boolean
}>()

const emit = defineEmits<{ click: [] }>()

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    draft: '草稿',
    processing: '制作中',
    completed: '已完成',
  }
  return map[props.episode.status] || props.episode.status
})

const statusClass = computed(() => {
  if (props.episode.status === 'completed') return 'success'
  if (props.episode.status === 'processing') return 'accent'
  return ''
})
</script>

<style scoped>
.episode-card {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.episode-card:hover { background: oklch(1 0 0 / 0.04); }
.episode-card.active {
  background: oklch(0.26 0.012 265);
  border-color: var(--color-hairline);
}
.ep-thumb {
  width: 48px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.ep-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, oklch(0.24 0.02 280), oklch(0.20 0.02 300));
  color: var(--color-text-3);
}
.ep-info { flex: 1; min-width: 0; }
.ep-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.ep-sub {
  font-size: 11px;
  color: var(--color-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ep-meta { margin-top: 4px; }
</style>
