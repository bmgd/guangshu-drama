<template>
  <NuxtLayout name="studio" v-bind="layoutProps" @select-episode="onSelectEpisode" @add-episode="addEpisode">
    <div class="overview-page">
      <header class="overview-header">
        <div>
          <h2>{{ projectData.drama?.title }}</h2>
          <p class="desc">{{ projectData.drama?.description || '暂无描述' }}</p>
        </div>
        <div class="meta-row">
          <span class="badge">{{ projectData.drama?.style || '3d' }}</span>
          <span class="badge">{{ projectData.drama?.aspectRatio || '16:9' }}</span>
          <span class="badge" :class="statusClass">{{ statusLabel }}</span>
          <span v-if="projectData.drama?.creationType" class="badge muted">
            {{ creationTypeLabel }}
          </span>
          <span v-if="projectData.drama?.totalEpisodes" class="badge muted">
            规划 {{ projectData.drama.totalEpisodes }} 集
          </span>
          <span v-if="costChip" class="badge accent">{{ costChip }}</span>
        </div>
      </header>

      <div class="stats-grid">
        <NuxtLink :to="`/app/projects/${dramaId}/characters`" class="stat-card card card-hover">
          <div class="stat-num">{{ projectData.characters.length }}</div>
          <div class="stat-label">角色</div>
        </NuxtLink>
        <NuxtLink :to="`/app/projects/${dramaId}/scenes`" class="stat-card card card-hover">
          <div class="stat-num">{{ projectData.scenes.length }}</div>
          <div class="stat-label">场景</div>
        </NuxtLink>
        <NuxtLink :to="`/app/projects/${dramaId}/props`" class="stat-card card card-hover">
          <div class="stat-num">{{ projectData.props.length }}</div>
          <div class="stat-label">道具</div>
        </NuxtLink>
        <div class="stat-card card">
          <div class="stat-num">{{ projectData.episodes.length }}</div>
          <div class="stat-label">分集</div>
        </div>
      </div>

      <section class="card checklist-section">
        <h3>制作清单</h3>
        <p class="checklist-lead">按阶段推进，先样片再批量，避免一次烧光额度。</p>
        <ul class="checklist">
          <li :class="{ done: configReady }">
            <span class="mark">{{ configReady ? '✓' : '○' }}</span>
            <span>
              配置 AI 模型
              <NuxtLink v-if="!configReady" to="/app/settings" class="inline-link">前往设置</NuxtLink>
            </span>
          </li>
          <li :class="{ done: hasWorkbenchContent }">
            <span class="mark">{{ hasWorkbenchContent ? '✓' : '○' }}</span>
            <span>
              进入工作台粘贴内容
              <button v-if="firstEpisode && !hasWorkbenchContent" type="button" class="linkish" @click="goEpisode(firstEpisode)">打开工作台</button>
            </span>
          </li>
          <li :class="{ done: hasAssets }">
            <span class="mark">{{ hasAssets ? '✓' : '○' }}</span>
            <span>改写并提取资产</span>
          </li>
          <li :class="{ done: hasSampleProgress }">
            <span class="mark">{{ hasSampleProgress ? '✓' : '○' }}</span>
            <span>先出 2～4 镜样片</span>
          </li>
          <li :class="{ done: hasExportProgress }">
            <span class="mark">{{ hasExportProgress ? '✓' : '○' }}</span>
            <span>批量补齐与导出</span>
          </li>
        </ul>
      </section>

      <section v-if="usageByService.length" class="card usage-section">
        <h3>用量汇总</h3>
        <ul class="usage-list">
          <li v-for="row in usageByService" :key="row.serviceType">
            <span class="badge">{{ row.serviceType }}</span>
            <span>{{ row.count }} 次 · ≈ {{ row.estimatedCost.toFixed(4) }} CNY</span>
          </li>
        </ul>
      </section>

      <section class="episodes-section card">
        <div class="section-head">
          <h3>分集列表</h3>
          <button class="btn ghost" @click="addEpisode">+ 新增分集</button>
        </div>
        <div v-if="!sortedEpisodes.length" class="empty-eps">暂无分集，点击上方新增</div>
        <ul v-else class="episode-list">
          <li v-for="ep in sortedEpisodes" :key="ep.id" class="episode-row">
            <div class="ep-info">
              <span class="ep-title">第 {{ ep.episodeNumber }} 集 · {{ ep.title }}</span>
              <span class="badge" :class="episodeStatusClass(ep.status)">{{ episodeStatusLabel(ep.status) }}</span>
            </div>
            <button class="btn primary sm" @click="goEpisode(ep)">进入工作台</button>
          </li>
        </ul>
      </section>

      <div v-if="firstEpisode" class="quick-start card">
        <h3>快速开始</h3>
        <p>进入第 {{ firstEpisode.episodeNumber }} 集工作台，粘贴小说原文开始生产</p>
        <button class="btn primary" @click="goEpisode(firstEpisode)">进入工作台</button>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { api } from '../../../../composables/useApi'
import type { Episode } from '../../../../composables/useWorkbench'

const route = useRoute()
const router = useRouter()
const dramaId = computed(() => Number(route.params.id))
const { currentProjectData: projectData, loadProject } = useProjectsStore()
const { configReady } = useAppStore()

const sortedEpisodes = computed(() =>
  [...projectData.value.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber),
)

const firstEpisode = computed(() => sortedEpisodes.value[0])

const hasAssets = computed(() =>
  (projectData.value.characters?.length || 0) > 0
  || (projectData.value.scenes?.length || 0) > 0
  || (projectData.value.props?.length || 0) > 0,
)

const hasWorkbenchContent = computed(() => {
  const eps = projectData.value.episodes || []
  return eps.some((ep: any) =>
    (ep.status && ep.status !== 'draft')
    || !!ep.scriptContent
    || !!ep.content
    || !!ep.videoUrl,
  ) || hasAssets.value
})

const hasSampleProgress = computed(() => {
  if (import.meta.client) {
    try {
      if (localStorage.getItem(`guangshu-sample-done-${dramaId.value}`) === '1') return true
    } catch { /* ignore */ }
  }
  return sortedEpisodes.value.some((ep: any) =>
    ep.status === 'processing' || ep.status === 'completed' || !!ep.videoUrl,
  )
})

const statusLabel = computed(() => {
  const map: Record<string, string> = { draft: '草稿', processing: '制作中', completed: '已完成' }
  const s = projectData.value.drama?.status || 'draft'
  return map[s] || s
})

const statusClass = computed(() => {
  const s = projectData.value.drama?.status
  if (s === 'completed') return 'success'
  if (s === 'processing') return 'accent'
  return ''
})

const creationTypeLabel = computed(() => {
  const map: Record<string, string> = { drama: '短剧', narration: '旁白', ad: '广告' }
  return map[projectData.value.drama?.creationType || ''] || projectData.value.drama?.creationType
})

const costChip = ref('')
const usageByService = ref<Array<{ serviceType: string; count: number; estimatedCost: number }>>([])

const hasExportProgress = computed(() =>
  sortedEpisodes.value.some((ep: any) => ep.status === 'completed' || !!ep.videoUrl)
  || !!costChip.value,
)

async function loadUsage() {
  try {
    const sum = await api<{
      byService: Array<{ serviceType: string; count: number; estimatedCost: number }>
      totalEstimated: number
      recordCount: number
      currency: string
    }>(`/usage/summary?dramaId=${dramaId.value}`)
    usageByService.value = sum.byService || []
    costChip.value = sum.recordCount
      ? `成本 ≈ ${sum.totalEstimated.toFixed(3)} ${sum.currency}`
      : ''
  } catch {
    usageByService.value = []
    costChip.value = ''
  }
}

const layoutProps = computed(() => ({
  dramaId: dramaId.value,
  episodes: projectData.value.episodes,
  characters: projectData.value.characters,
  scenes: projectData.value.scenes,
  propsList: projectData.value.props,
  activeNav: 'overview',
  projectTitle: projectData.value.drama?.title,
}))

function episodeStatusLabel(status?: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    processing: '制作中',
    completed: '已完成',
    scripted: '已编剧',
  }
  return map[status || 'draft'] || status || '草稿'
}

function episodeStatusClass(status?: string) {
  if (status === 'completed') return 'success'
  if (status === 'processing') return 'accent'
  return ''
}

function goEpisode(ep: Episode) {
  router.push(`/app/projects/${dramaId.value}/episodes/${ep.episodeNumber}?episodeId=${ep.id}`)
}

function onSelectEpisode(ep: Episode) {
  goEpisode(ep)
}

async function addEpisode() {
  const num = projectData.value.episodes.length + 1
  await api('/episodes', {
    method: 'POST',
    body: JSON.stringify({ dramaId: dramaId.value, episodeNumber: num, title: `第${num}集` }),
  })
  await loadProject(dramaId.value)
}

onMounted(async () => {
  await loadProject(dramaId.value)
  await loadUsage()
})
</script>

<style scoped>
.overview-header { margin-bottom: 20px; }
.overview-page h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.desc { color: var(--color-text-3); margin-bottom: 12px; }
.meta-row { display: flex; flex-wrap: wrap; gap: 6px; }
.badge.muted { opacity: 0.85; }
.usage-section { margin-bottom: 20px; padding: 16px; }
.usage-section h3 { font-size: 14px; margin-bottom: 10px; }
.usage-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.usage-list li { display: flex; gap: 12px; align-items: center; font-size: 13px; color: var(--color-text-2); }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
.checklist-section { margin-bottom: 20px; padding: 16px 18px; }
.checklist-section h3 { font-size: 14px; margin-bottom: 6px; }
.checklist-lead { font-size: 12px; color: var(--color-text-3); margin-bottom: 12px; }
.checklist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.checklist li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-2);
}
.checklist li.done { color: var(--color-success); }
.checklist .mark {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}
.inline-link, .linkish {
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-accent);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.stat-card {
  text-align: center;
  padding: 20px;
  text-decoration: none;
  color: inherit;
  display: block;
}
.stat-num { font-size: 28px; font-weight: 700; color: var(--color-accent); }
.stat-label { font-size: 12px; color: var(--color-text-3); margin-top: 4px; }
.episodes-section { padding: 16px 18px; margin-bottom: 20px; }
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-head h3 { font-size: 15px; font-weight: 600; }
.episode-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.episode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border, oklch(0.28 0.02 280 / 0.5));
}
.episode-row:last-child { border-bottom: none; }
.ep-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ep-title { font-size: 14px; }
.empty-eps { color: var(--color-text-3); font-size: 13px; padding: 8px 0; }
.btn.sm { padding: 4px 10px; font-size: 12px; }
.quick-start h3 { font-size: 15px; margin-bottom: 8px; }
.quick-start p { color: var(--color-text-3); font-size: 13px; margin-bottom: 16px; }
@media (max-width: 700px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
