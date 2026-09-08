<template>
  <div class="projects-page">
    <header class="page-header">
      <div>
        <h1>项目</h1>
        <p class="subtitle">光束短剧 · AI 驱动的短剧自动化生产工作台</p>
      </div>
      <div class="header-actions">
        <NuxtLink to="/app/library" class="btn ghost">素材库</NuxtLink>
        <NuxtLink to="/app/settings" class="btn ghost">
          <Settings :size="16" /> 设置
        </NuxtLink>
        <button class="btn primary" @click="showCreate = true">
          <Plus :size="16" /> 新建项目
        </button>
      </div>
    </header>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="!dramas.length" class="empty-state card">
      <Clapperboard :size="40" style="opacity:0.3;margin-bottom:12px" />
      <h3>还没有项目</h3>
      <p>点击「新建项目」开始你的第一个短剧创作</p>
      <button class="btn primary" style="margin-top:16px" @click="showCreate = true">新建项目</button>
    </div>
    <div v-else class="grid grid-3">
      <ProjectCard
        v-for="drama in dramas"
        :key="drama.id"
        :drama="drama"
        @click="openProject(drama.id)"
      />
    </div>

    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <div class="modal">
        <h2>新建项目</h2>
        <div class="form-group">
          <label>项目名称</label>
          <input v-model="form.title" placeholder="例如：都市逆袭记" autofocus />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="form.description" rows="3" placeholder="一句话梗概" />
        </div>
        <div class="form-group">
          <label>画面风格</label>
          <select v-model="form.style">
            <option v-for="p in presets" :key="p.value" :value="p.value">{{ p.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>画幅</label>
          <select v-model="form.aspectRatio">
            <option value="16:9">16:9 横屏</option>
            <option value="9:16">9:16 竖屏</option>
          </select>
        </div>
        <div class="form-group">
          <label>内容来源</label>
          <select v-model="form.contentSource">
            <option value="novel">小说</option>
            <option value="script">剧本</option>
            <option value="product">商品/广告素材</option>
          </select>
          <p v-if="form.contentSource === 'novel'" class="field-hint">适合网文改编；先用一章验证风格。</p>
          <p v-else-if="form.contentSource === 'script'" class="field-hint">尽量保留原台词；重点做资产与分镜。</p>
          <p v-else class="field-hint">先准备商品多角度图与卖点。</p>
        </div>
        <div class="form-group">
          <label>创作类型</label>
          <select v-model="form.creationType">
            <option value="drama">短剧</option>
            <option value="narration">旁白解说</option>
            <option value="ad">广告</option>
          </select>
          <p v-if="form.creationType === 'drama'" class="field-hint">对白与角色一致性优先。</p>
          <p v-else-if="form.creationType === 'narration'" class="field-hint">旁白主导，建议配置 TTS。</p>
          <p v-else class="field-hint">商品外形与卖点真实性优先，可用参考图驱动。</p>
        </div>
        <div class="form-group">
          <label>生成模式</label>
          <select v-model="form.generationMode">
            <option value="storyboard">分镜驱动</option>
            <option value="reference">参考图驱动</option>
            <option value="first_last_frame">首尾帧</option>
          </select>
          <p v-if="form.generationMode === 'storyboard'" class="field-hint">先出分镜图再图生视频，最稳妥。</p>
          <p v-else-if="form.generationMode === 'first_last_frame'" class="field-hint">同时生成首帧与尾帧，视频优先用双帧</p>
          <p v-else class="field-hint">直接用角色/商品参考图生视频，依赖模型多参考能力。</p>
        </div>
        <div class="form-group">
          <label>集数</label>
          <input v-model.number="form.totalEpisodes" type="number" min="1" max="100" />
        </div>
        <div class="modal-footer">
          <button @click="showCreate = false">取消</button>
          <button class="primary" :disabled="!form.title || creating" @click="createProject">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Settings, Clapperboard } from 'lucide-vue-next'
import ProjectCard from '../../../components/layout/ProjectCard.vue'
import { api } from '../../../composables/useApi'

definePageMeta({ layout: 'default' })

const router = useRouter()
const { dramas, loading, fetchDramas } = useProjectsStore()
const showCreate = ref(false)
const creating = ref(false)
const presets = ref<Array<{ name: string; value: string }>>([])
const form = reactive({
  title: '',
  description: '',
  style: '3d',
  aspectRatio: '16:9',
  totalEpisodes: 1,
  contentSource: 'novel',
  creationType: 'drama',
  generationMode: 'storyboard',
})

async function load() {
  await fetchDramas()
  try {
    presets.value = await api('/style-presets')
  } catch { /* ignore */ }
}

async function createProject() {
  creating.value = true
  try {
    const total = Math.max(1, Math.min(100, Number(form.totalEpisodes) || 1))
    const drama = await api<any>('/dramas', {
      method: 'POST',
      body: JSON.stringify({ ...form, totalEpisodes: total }),
    })
    for (let n = 1; n <= total; n++) {
      await api('/episodes', {
        method: 'POST',
        body: JSON.stringify({ dramaId: drama.id, episodeNumber: n, title: `第${n}集` }),
      })
    }
    showCreate.value = false
    router.push(`/app/projects/${drama.id}/episodes/1`)
  } finally {
    creating.value = false
  }
}

function openProject(id: number) {
  router.push(`/app/projects/${id}`)
}

onMounted(load)
</script>

<style scoped>
.projects-page {
  min-height: 100vh;
  padding: 32px 40px;
  max-width: 1400px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}
.page-header h1 { font-size: 24px; font-weight: 700; }
.subtitle { color: var(--color-text-3); margin-top: 4px; font-size: 14px; }
.header-actions { display: flex; gap: 8px; }
.empty-state {
  text-align: center;
  padding: 64px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.empty-state h3 { font-size: 16px; margin-bottom: 8px; }
.empty-state p { color: var(--color-text-3); font-size: 14px; }
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.45;
}
.modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
</style>
