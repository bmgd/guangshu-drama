<template>
  <div class="library-page">
    <div class="page-head">
      <div>
        <h1>素材库</h1>
        <p class="sub">跨项目浏览已生成媒体 · 光束短剧</p>
      </div>
      <NuxtLink to="/app/projects" class="ghost-link">返回项目</NuxtLink>
    </div>

    <div class="stats-row" v-if="stats">
      <span>共 {{ stats.total }} 项</span>
      <span v-for="(n, t) in stats.byType" :key="t">{{ t }}: {{ n }}</span>
      <span>约 {{ formatBytes(stats.storageBytes) }}</span>
    </div>

    <div class="filters">
      <input v-model="q" class="search" placeholder="搜索名称/描述…" @keyup.enter="load" />
      <select v-model="typeFilter" @change="load">
        <option value="">全部类型</option>
        <option value="image">图片</option>
        <option value="video">视频</option>
      </select>
      <button class="primary" @click="load">筛选</button>
    </div>

    <div class="grid">
      <div v-for="item in items" :key="item.id" class="card item">
        <img
          v-if="item.thumbnailUrl || (item.type === 'image' && item.url)"
          :src="thumbUrl(item.thumbnailUrl || item.url || '')"
          class="thumb"
          alt=""
        />
        <div v-else class="thumb placeholder">{{ item.type || '?' }}</div>
        <div class="meta">
          <strong>{{ item.name || item.category || `#${item.id}` }}</strong>
          <span class="muted">{{ item.type }} · {{ item.category || '-' }}</span>
          <p v-if="item.description" class="desc">{{ item.description }}</p>
          <NuxtLink
            v-if="item.dramaId"
            :to="`/app/projects/${item.dramaId}`"
            class="proj-link"
          >打开项目 #{{ item.dramaId }}</NuxtLink>
        </div>
      </div>
    </div>
    <div v-if="!items.length && !loading" class="empty card">暂无素材</div>
  </div>
</template>

<script setup lang="ts">
import { api } from '../../../composables/useApi'

definePageMeta({ layout: 'default' })

const { thumbUrl } = useMedia()
const items = ref<Array<{
  id: number
  name?: string | null
  description?: string | null
  type?: string | null
  category?: string | null
  url?: string | null
  thumbnailUrl?: string | null
  dramaId?: number | null
}>>([])
const stats = ref<{ total: number; byType: Record<string, number>; storageBytes: number } | null>(null)
const q = ref('')
const typeFilter = ref('')
const loading = ref(false)

function formatBytes(n: number) {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (typeFilter.value) params.set('type', typeFilter.value)
    if (q.value.trim()) params.set('q', q.value.trim())
    const qs = params.toString()
    items.value = await api(`/assets${qs ? `?${qs}` : ''}`)
    stats.value = await api('/assets/stats')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.library-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.page-head h1 { font-size: 22px; font-weight: 700; margin: 0; }
.sub { color: var(--color-text-3); font-size: 13px; margin-top: 4px; }
.ghost-link { font-size: 13px; color: var(--color-accent); }
.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 12px;
}
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.search { flex: 1; min-width: 160px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.item { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.thumb {
  width: 100%;
  aspect-ratio: 16/10;
  object-fit: cover;
  border-radius: 6px;
  background: var(--color-bg-2, #222);
}
.thumb.placeholder {
  display: grid;
  place-items: center;
  color: var(--color-text-3);
  font-size: 12px;
}
.meta { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.muted { color: var(--color-text-3); font-size: 11px; }
.desc {
  font-size: 12px;
  color: var(--color-text-3);
  margin: 4px 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.proj-link { font-size: 12px; color: var(--color-accent); margin-top: 4px; }
.empty { padding: 24px; text-align: center; color: var(--color-text-3); }
</style>
