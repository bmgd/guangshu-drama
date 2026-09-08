<template>
  <NuxtLayout name="studio" v-bind="layoutProps" @add-episode="addEpisode">
    <div class="asset-page">
      <div class="page-head">
        <h2>场景库 <span class="count">{{ scenes.length }}</span></h2>
        <div class="btn-row">
          <button :disabled="!pendingIds.length" @click="confirmAll">全部确认</button>
          <button :disabled="!confirmedSelectedCount" @click="batchGen">
            批量生图 ({{ confirmedSelectedCount }})
          </button>
          <button class="primary" @click="showCreate = true">新建场景</button>
        </div>
      </div>

      <div v-if="showCreate" class="card create-form">
        <h3>新建场景</h3>
        <div class="form-grid">
          <label>地点<input v-model="form.location" placeholder="如：咖啡厅" /></label>
          <label>时间<input v-model="form.time" placeholder="如：日/夜" /></label>
          <label class="full">描述 / Prompt<textarea v-model="form.prompt" rows="3" placeholder="场景氛围与细节" /></textarea></label>
        </div>
        <div class="btn-row">
          <button class="primary" :disabled="!canCreate" @click="create">创建</button>
          <button @click="showCreate = false">取消</button>
        </div>
      </div>

      <div class="grid grid-2">
        <div v-for="scene in scenes" :key="scene.id" class="card asset-card" :class="{ selected: selected.has(scene.id) }">
          <label class="sel-check">
            <input type="checkbox" :checked="selected.has(scene.id)" @change="toggleSelect(scene.id)" />
          </label>
          <img v-if="scene.imageUrl" :src="thumbUrl(scene.imageUrl)" class="thumb" alt="" @click="editTarget = { ...scene }" />
          <div v-else class="thumb thumb-placeholder" @click="editTarget = { ...scene }">{{ scene.location?.[0] }}</div>
          <h3>
            {{ scene.location }} · {{ scene.time }}
            <span class="badge" :class="reviewBadge(scene.reviewStatus)">{{ reviewLabel(scene.reviewStatus) }}</span>
          </h3>
          <p>{{ scene.prompt }}</p>
          <div class="btn-row">
            <button
              v-if="scene.reviewStatus !== 'confirmed'"
              class="primary"
              @click="confirmOne(scene.id)"
            >确认</button>
            <button :disabled="scene.reviewStatus !== 'confirmed'" @click="genImage(scene)">生成场景图</button>
            <button @click="editTarget = { ...scene }">编辑</button>
            <button class="danger-btn" @click="askRemove(scene)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!scenes.length" class="empty card">暂无场景，可新建或在工作台提取</div>
    </div>

    <div v-if="editTarget" class="modal-backdrop" @click.self="editTarget = null">
      <div class="modal">
        <h3>编辑场景</h3>
        <div class="form-grid">
          <label>地点<input v-model="editTarget.location" /></label>
          <label>时间<input v-model="editTarget.time" /></label>
          <label class="full">描述<textarea v-model="editTarget.prompt" rows="3" /></textarea></label>
          <label class="full">灯光<input v-model="editTarget.lighting" /></label>
          <label class="full">最终提示词<textarea v-model="editTarget.finalPrompt" rows="2" /></textarea></label>
          <label class="full">场景图
            <div class="upload-row">
              <input v-model="editTarget.imageUrl" placeholder="imageUrl" />
              <button @click="uploadImage">上传</button>
            </div>
          </label>
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="primary" @click="saveEdit">保存</button>
          <button @click="editTarget = null">取消</button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      title="删除场景"
      :message="confirmMessage"
      @confirm="confirmRemove"
      @cancel="confirmOpen = false"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
import ConfirmDialog from '../../../../components/ConfirmDialog.vue'
import { api } from '../../../../composables/useApi'

const route = useRoute()
const dramaId = computed(() => Number(route.params.id))
const { currentProjectData: projectData, loadProject } = useProjectsStore()
const { thumbUrl } = useMedia()

const scenes = computed(() => projectData.value.scenes)
const layoutProps = computed(() => ({
  dramaId: dramaId.value,
  episodes: projectData.value.episodes,
  characters: projectData.value.characters,
  scenes: projectData.value.scenes,
  propsList: projectData.value.props,
  activeNav: 'scenes',
  projectTitle: projectData.value.drama?.title,
}))

const showCreate = ref(false)
const form = reactive({ location: '', time: '日', prompt: '' })
const editTarget = ref<any>(null)
const selected = ref(new Set<number>())
const confirmOpen = ref(false)
const confirmMessage = ref('')
const pendingDeleteId = ref<number | null>(null)
const canCreate = computed(() => form.location.trim() && form.time.trim() && form.prompt.trim())
const pendingIds = computed(() =>
  scenes.value.filter((s: any) => s.reviewStatus !== 'confirmed').map((s: any) => s.id),
)
const confirmedSelectedCount = computed(() =>
  scenes.value.filter((s: any) => selected.value.has(s.id) && s.reviewStatus === 'confirmed').length,
)

function reviewLabel(status?: string) {
  return status === 'confirmed' ? '已确认' : '待确认'
}
function reviewBadge(status?: string) {
  return status === 'confirmed' ? 'success' : 'accent'
}

function toggleSelect(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

async function confirmOne(id: number) {
  await api('/scenes/confirm', { method: 'POST', body: JSON.stringify({ ids: [id] }) })
  await loadProject(dramaId.value)
}

async function confirmAll() {
  if (!pendingIds.value.length) return
  await api('/scenes/confirm', { method: 'POST', body: JSON.stringify({ ids: pendingIds.value }) })
  await loadProject(dramaId.value)
}

async function create() {
  await api('/scenes', {
    method: 'POST',
    body: JSON.stringify({
      dramaId: dramaId.value,
      location: form.location.trim(),
      time: form.time.trim(),
      prompt: form.prompt.trim(),
    }),
  })
  form.location = ''
  form.time = '日'
  form.prompt = ''
  showCreate.value = false
  await loadProject(dramaId.value)
}

async function saveEdit() {
  if (!editTarget.value) return
  const t = editTarget.value
  await api(`/scenes/${t.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      location: t.location,
      time: t.time,
      prompt: t.prompt,
      lighting: t.lighting,
      finalPrompt: t.finalPrompt,
      imageUrl: t.imageUrl,
      reviewStatus: 'pending_review',
    }),
  })
  editTarget.value = null
  await loadProject(dramaId.value)
}

function askRemove(scene: any) {
  pendingDeleteId.value = scene.id
  confirmMessage.value = `确定删除场景「${scene.location} · ${scene.time}」？此操作不可恢复。`
  confirmOpen.value = true
}

async function confirmRemove() {
  const id = pendingDeleteId.value
  confirmOpen.value = false
  if (id == null) return
  await api(`/scenes/${id}`, { method: 'DELETE' })
  pendingDeleteId.value = null
  await loadProject(dramaId.value)
}

async function genImage(scene: any) {
  if (scene.reviewStatus !== 'confirmed') {
    alert('请先确认该资产后再生成')
    return
  }
  await api('/tasks/image', {
    method: 'POST',
    body: JSON.stringify({
      type: 'scene',
      targetId: scene.id,
      prompt: scene.finalPrompt || scene.prompt,
      dramaId: dramaId.value,
    }),
  })
  alert('已提交生图任务')
}

async function batchGen() {
  const items = scenes.value
    .filter((s: any) => selected.value.has(s.id) && s.reviewStatus === 'confirmed')
    .map((s: any) => ({
      type: 'scene' as const,
      targetId: s.id,
      prompt: s.finalPrompt || s.prompt,
      dramaId: dramaId.value,
    }))
  if (!items.length) {
    alert('请先确认资产后再批量生成')
    return
  }
  await api('/tasks/image/batch', { method: 'POST', body: JSON.stringify({ items }) })
  alert(`已提交 ${items.length} 个生图任务`)
}

async function uploadImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file || !editTarget.value) return
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/v1/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.code !== 0) {
      alert(json.message || '上传失败')
      return
    }
    editTarget.value.imageUrl = json.data.url
  }
  input.click()
}

async function addEpisode() {
  const num = projectData.value.episodes.length + 1
  await api('/episodes', { method: 'POST', body: JSON.stringify({ dramaId: dramaId.value, episodeNumber: num, title: `第${num}集` }) })
  await loadProject(dramaId.value)
}

onMounted(() => loadProject(dramaId.value))
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.asset-page h2 { font-size: 18px; font-weight: 700; margin: 0; }
.count { color: var(--color-text-3); font-weight: 400; }
.create-form { margin-bottom: 16px; padding: 16px; }
.create-form h3, .modal h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}
.form-grid .full { grid-column: 1 / -1; }
.asset-card { position: relative; }
.asset-card.selected { outline: 1px solid var(--color-accent); }
.sel-check { position: absolute; top: 10px; left: 10px; z-index: 1; }
.asset-card h3 { font-size: 14px; margin: 10px 0 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.asset-card p { font-size: 12px; color: var(--color-text-3); margin-bottom: 10px; }
.btn-row { display: flex; flex-wrap: wrap; gap: 6px; }
.danger-btn { color: var(--color-danger); }
.upload-row { display: flex; gap: 6px; }
.upload-row input { flex: 1; }
.thumb { cursor: pointer; }
</style>
