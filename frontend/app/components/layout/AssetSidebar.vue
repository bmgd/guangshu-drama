<template>
  <aside class="asset-sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <span v-if="!collapsed" class="sidebar-title">工作区</span>
      <button class="icon-btn collapse-btn" :title="collapsed ? '展开' : '收起'" @click="toggleSidebar">
        <ChevronLeft v-if="!collapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
    </div>

    <nav class="nav-section">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="capsule-nav"
        :class="{ active: activeNav === item.key }"
        :title="item.label"
        @click="navigate(item)"
      >
        <component :is="item.icon" :size="16" />
        <span v-if="!collapsed">{{ item.label }}</span>
        <span v-if="!collapsed && item.meta" class="nav-meta">{{ item.meta }}</span>
      </button>
    </nav>

    <div v-if="!collapsed" class="assets-section">
      <div class="assets-header">
        <span>素材</span>
      </div>
      <div class="filter-row">
        <button
          v-for="f in filters"
          :key="f.key"
          class="filter-chip"
          :class="{ active: typeFilter === f.key }"
          @click="typeFilter = f.key"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="assets-list">
        <button
          v-for="item in filteredAssets"
          :key="`${item.type}-${item.id}`"
          class="asset-item"
          @click="openPreview(item)"
        >
          <img v-if="item.imageUrl" :src="thumbUrl(item.imageUrl)" class="asset-thumb" alt="" />
          <span v-else class="asset-thumb placeholder">{{ item.name?.[0] || '?' }}</span>
          <span class="asset-name">{{ item.name }}</span>
          <button
            v-if="item.assetId != null"
            class="fav-btn"
            :class="{ on: item.isFavorite }"
            title="收藏"
            @click.stop="toggleFavorite(item)"
          >
            <Star :size="12" :fill="item.isFavorite ? 'currentColor' : 'none'" />
          </button>
        </button>
        <div v-if="!filteredAssets.length" class="assets-empty">暂无素材</div>
      </div>
    </div>

    <div v-if="!collapsed" class="episodes-section">
      <div class="episodes-header">
        <span>分集</span>
        <button class="icon-btn" title="新增集" @click="emit('addEpisode')">
          <Plus :size="14" />
        </button>
      </div>
      <div class="episodes-list">
        <EpisodeCard
          v-for="ep in episodes"
          :key="ep.id"
          :episode="ep"
          :active="activeEpisodeId === ep.id"
          @click="emit('selectEpisode', ep)"
        />
        <div v-if="!episodes.length" class="episodes-empty">暂无分集</div>
      </div>
    </div>
    <div v-else class="episodes-collapsed">
      <button
        v-for="ep in episodes"
        :key="ep.id"
        class="ep-mini"
        :class="{ active: activeEpisodeId === ep.id }"
        :title="ep.title"
        @click="emit('selectEpisode', ep)"
      >
        {{ ep.episodeNumber }}
      </button>
    </div>

    <div v-if="preview" class="modal-backdrop" @click.self="preview = null">
      <div class="modal preview-modal">
        <div class="preview-head">
          <h3>{{ preview.name }}</h3>
          <button class="icon-btn" @click="preview = null"><X :size="16" /></button>
        </div>
        <img v-if="preview.imageUrl" :src="thumbUrl(preview.imageUrl)" class="preview-img" alt="" />
        <p v-else class="assets-empty">暂无预览图</p>
        <p class="preview-desc">{{ preview.description || preview.type }}</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  ChevronLeft, ChevronRight, Plus, Star, X,
  LayoutDashboard, Users, Landmark, Package,
} from 'lucide-vue-next'
import EpisodeCard from './EpisodeCard.vue'
import type { Episode } from '../../composables/useWorkbench'
import { api } from '../../composables/useApi'

type AssetFilter = 'all' | 'character' | 'scene' | 'prop'

type SidebarAsset = {
  id: number
  name: string
  type: AssetFilter
  imageUrl?: string | null
  description?: string | null
  assetId?: number
  isFavorite?: boolean
}

type MediaAsset = {
  id: number
  url?: string | null
  thumbnailUrl?: string | null
  category?: string | null
  isFavorite?: boolean | null
  name?: string | null
}

const props = defineProps<{
  dramaId: number
  episodes: Episode[]
  characters: any[]
  scenes: any[]
  propsList: any[]
  activeEpisodeId?: number
  activeNav?: string
}>()

const emit = defineEmits<{
  selectEpisode: [ep: Episode]
  addEpisode: []
  navigate: [key: string]
}>()

const { sidebarCollapsed: collapsed, toggleSidebar } = useAppStore()
const { thumbUrl } = useMedia()
const router = useRouter()

const typeFilter = ref<AssetFilter>('all')
const mediaAssets = ref<MediaAsset[]>([])
const preview = ref<SidebarAsset | null>(null)

const filters: { key: AssetFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '角色' },
  { key: 'scene', label: '场景' },
  { key: 'prop', label: '道具' },
]

const navItems = computed(() => [
  { key: 'overview', label: '项目概览', icon: LayoutDashboard, path: `/app/projects/${props.dramaId}`, meta: undefined as number | undefined },
  { key: 'characters', label: '角色集', icon: Users, path: `/app/projects/${props.dramaId}/characters`, meta: props.characters.length || undefined },
  { key: 'scenes', label: '场景库', icon: Landmark, path: `/app/projects/${props.dramaId}/scenes`, meta: props.scenes.length || undefined },
  { key: 'props', label: '道具库', icon: Package, path: `/app/projects/${props.dramaId}/props`, meta: props.propsList.length || undefined },
])

function findAssetMeta(url?: string | null, category?: string) {
  if (!url) return undefined
  return mediaAssets.value.find((a) =>
    (a.url === url || a.thumbnailUrl === url) && (!category || a.category === category),
  )
}

const allAssets = computed<SidebarAsset[]>(() => {
  const chars: SidebarAsset[] = props.characters.map((c) => {
    const meta = findAssetMeta(c.imageUrl, 'character')
    return {
      id: c.id,
      name: c.name,
      type: 'character' as const,
      imageUrl: c.imageUrl,
      description: c.description || c.role,
      assetId: meta?.id,
      isFavorite: !!meta?.isFavorite,
    }
  })
  const scns: SidebarAsset[] = props.scenes.map((s) => {
    const meta = findAssetMeta(s.imageUrl, 'scene')
    return {
      id: s.id,
      name: `${s.location} · ${s.time}`,
      type: 'scene' as const,
      imageUrl: s.imageUrl,
      description: s.prompt,
      assetId: meta?.id,
      isFavorite: !!meta?.isFavorite,
    }
  })
  const prps: SidebarAsset[] = props.propsList.map((p) => {
    const meta = findAssetMeta(p.imageUrl, 'prop')
    return {
      id: p.id,
      name: p.name,
      type: 'prop' as const,
      imageUrl: p.imageUrl,
      description: p.description,
      assetId: meta?.id,
      isFavorite: !!meta?.isFavorite,
    }
  })
  return [...chars, ...scns, ...prps]
})

const filteredAssets = computed(() => {
  if (typeFilter.value === 'all') return allAssets.value
  return allAssets.value.filter((a) => a.type === typeFilter.value)
})

function navigate(item: typeof navItems.value[0]) {
  emit('navigate', item.key)
  router.push(item.path)
}

function openPreview(item: SidebarAsset) {
  preview.value = item
}

async function loadAssets() {
  try {
    mediaAssets.value = await api<MediaAsset[]>(`/assets?dramaId=${props.dramaId}`)
  } catch {
    mediaAssets.value = []
  }
}

async function toggleFavorite(item: SidebarAsset) {
  if (item.assetId == null) return
  const next = !item.isFavorite
  try {
    await api(`/assets/${item.assetId}/favorite`, {
      method: 'PUT',
      body: JSON.stringify({ isFavorite: next }),
    })
    await loadAssets()
  } catch (err) {
    console.error(err)
  }
}

watch(() => props.dramaId, () => loadAssets(), { immediate: true })
</script>

<style scoped>
.asset-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-hairline);
  background: oklch(0.15 0.011 265 / 0.5);
  overflow: hidden;
  transition: width 0.25s ease;
}
.asset-sidebar.collapsed { width: var(--sidebar-collapsed); }
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-hairline-soft);
}
.sidebar-title { font-size: 12px; font-weight: 600; color: var(--color-text-3); text-transform: uppercase; letter-spacing: 0.05em; }
.nav-section { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.assets-section {
  border-top: 1px solid var(--color-hairline-soft);
  display: flex;
  flex-direction: column;
  max-height: 36%;
  overflow: hidden;
}
.assets-header, .episodes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 8px 6px;
}
.filter-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-hairline);
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
}
.filter-chip.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}
.assets-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.asset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-2);
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.asset-item:hover { background: var(--color-surface-hover); }
.asset-thumb {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.asset-thumb.placeholder {
  display: grid;
  place-items: center;
  background: var(--color-surface);
  font-size: 11px;
  font-weight: 600;
}
.asset-name {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fav-btn {
  border: none;
  background: transparent;
  color: var(--color-text-3);
  padding: 2px;
  cursor: pointer;
}
.fav-btn.on { color: var(--color-warning); }
.assets-empty { padding: 12px; text-align: center; font-size: 12px; color: var(--color-text-3); }
.episodes-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-top: 1px solid var(--color-hairline-soft); }
.episodes-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 4px; }
.episodes-empty { padding: 16px; text-align: center; font-size: 12px; color: var(--color-text-3); }
.episodes-collapsed { padding: 8px 4px; display: flex; flex-direction: column; gap: 4px; align-items: center; }
.ep-mini {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--color-hairline);
  background: var(--color-surface);
  color: var(--color-text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.ep-mini.active { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-soft); }
.preview-modal { width: min(420px, 92vw); }
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.preview-head h3 { font-size: 15px; font-weight: 600; }
.preview-img {
  width: 100%;
  border-radius: 8px;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--color-surface);
}
.preview-desc {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.5;
}
</style>
