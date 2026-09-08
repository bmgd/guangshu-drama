<template>
  <NuxtLayout name="studio" v-bind="layoutProps" @add-episode="addEpisode">
    <div class="asset-page">
      <div class="page-head">
        <h2>道具库 <span class="count">{{ propsList.length }}</span></h2>
        <div class="btn-row">
          <button :disabled="!pendingIds.length" @click="confirmAll">全部确认</button>
          <button :disabled="!confirmedSelectedCount" @click="batchGen">
            批量生图 ({{ confirmedSelectedCount }})
          </button>
          <button class="primary" @click="showCreate = true">新建道具</button>
        </div>
      </div>

      <div v-if="showCreate" class="card create-form">
        <h3>新建道具</h3>
        <div class="form-grid">
          <label>名称<input v-model="form.name" placeholder="道具名" /></label>
          <label>类型<input v-model="form.type" placeholder="如：饰品/武器" /></label>
          <label class="full">描述<textarea v-model="form.description" rows="3" placeholder="外观与用途" /></textarea></label>
        </div>
        <div class="btn-row">
          <button class="primary" :disabled="!form.name.trim()" @click="create">创建</button>
          <button @click="showCreate = false">取消</button>
        </div>
      </div>

      <div class="grid grid-3">
        <div v-for="prop in propsList" :key="prop.id" class="card asset-card" :class="{ selected: selected.has(prop.id) }">
          <label class="sel-check">
            <input type="checkbox" :checked="selected.has(prop.id)" @change="toggleSelect(prop.id)" />
          </label>
          <img v-if="prop.imageUrl" :src="thumbUrl(prop.imageUrl)" class="thumb" alt="" @click="editTarget = { ...prop }" />
          <div v-else class="thumb thumb-placeholder" @click="editTarget = { ...prop }">{{ prop.name?.[0] }}</div>
          <h3>
            {{ prop.name }}
            <span class="badge" :class="reviewBadge(prop.reviewStatus)">{{ reviewLabel(prop.reviewStatus) }}</span>
          </h3>
          <p>{{ prop.description || '暂无描述' }}</p>
          <div class="btn-row">
            <button
              v-if="prop.reviewStatus !== 'confirmed'"
              class="primary"
              @click="confirmOne(prop.id)"
            >确认</button>
            <button :disabled="prop.reviewStatus !== 'confirmed'" @click="genImage(prop)">生成道具图</button>
            <button @click="editTarget = { ...prop }">编辑</button>
            <button class="danger-btn" @click="askRemove(prop)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!propsList.length" class="empty card">暂无道具，可新建或在工作台提取</div>
    </div>

    <div v-if="editTarget" class="modal-backdrop" @click.self="editTarget = null">
      <div class="modal">
        <h3>编辑道具</h3>
        <div class="form-grid">
          <label>名称<input v-model="editTarget.name" /></label>
          <label>类型<input v-model="editTarget.type" /></label>
          <label class="full">描述<textarea v-model="editTarget.description" rows="3" /></textarea></label>
          <label class="full">Prompt<textarea v-model="editTarget.prompt" rows="2" /></textarea></label>
          <label class="full">最终提示词<textarea v-model="editTarget.finalPrompt" rows="2" /></textarea></label>
          <label class="full">道具图
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
      title="删除道具"
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

const propsList = computed(() => projectData.value.props)
const layoutProps = computed(() => ({
  dramaId: dramaId.value,
  episodes: projectData.value.episodes,
  characters: projectData.value.characters,
  scenes: projectData.value.scenes,
  propsList: projectData.value.props,
  activeNav: 'props',
  projectTitle: projectData.value.drama?.title,
}))

const showCreate = ref(false)
const form = reactive({ name: '', type: '', description: '' })
const editTarget = ref<any>(null)
const selected = ref(new Set<number>())
const confirmOpen = ref(false)
const confirmMessage = ref('')
const pendingDeleteId = ref<number | null>(null)

const pendingIds = computed(() =>
  propsList.value.filter((p: any) => p.reviewStatus !== 'confirmed').map((p: any) => p.id),
)
const confirmedSelectedCount = computed(() =>
  propsList.value.filter((p: any) => selected.value.has(p.id) && p.reviewStatus === 'confirmed').length,
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
  await api('/props/confirm', { method: 'POST', body: JSON.stringify({ ids: [id] }) })
  await loadProject(dramaId.value)
}

async function confirmAll() {
  if (!pendingIds.value.length) return
  await api('/props/confirm', { method: 'POST', body: JSON.stringify({ ids: pendingIds.value }) })
  await loadProject(dramaId.value)
}

async function create() {
  await api('/props', {
    method: 'POST',
    body: JSON.stringify({
      dramaId: dramaId.value,
      name: form.name.trim(),
      type: form.type || undefined,
      description: form.description || undefined,
    }),
  })
  form.name = ''
  form.type = ''
  form.description = ''
  showCreate.value = false
  await loadProject(dramaId.value)
}

async function saveEdit() {
  if (!editTarget.value) return
  const t = editTarget.value
  await api(`/props/${t.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: t.name,
      type: t.type,
      description: t.description,
      prompt: t.prompt,
      finalPrompt: t.finalPrompt,
      imageUrl: t.imageUrl,
      reviewStatus: 'pending_review',
    }),
  })
  editTarget.value = null
  await loadProject(dramaId.value)
}

function askRemove(prop: any) {
  pendingDeleteId.value = prop.id
  confirmMessage.value = `确定删除道具「${prop.name}」？此操作不可恢复。`
  confirmOpen.value = true
}

async function confirmRemove() {
  const id = pendingDeleteId.value
  confirmOpen.value = false
  if (id == null) return
  await api(`/props/${id}`, { method: 'DELETE' })
  pendingDeleteId.value = null
  await loadProject(dramaId.value)
}

async function genImage(prop: any) {
  if (prop.reviewStatus !== 'confirmed') {
    alert('请先确认该资产后再生成')
    return
  }
  await api('/tasks/image', {
    method: 'POST',
    body: JSON.stringify({
      type: 'prop',
      targetId: prop.id,
      prompt: prop.finalPrompt || prop.prompt || prop.name,
      dramaId: dramaId.value,
    }),
  })
  alert('已提交生图任务')
}

async function batchGen() {
  const items = propsList.value
    .filter((p: any) => selected.value.has(p.id) && p.reviewStatus === 'confirmed')
    .map((p: any) => ({
      type: 'prop' as const,
      targetId: p.id,
      prompt: p.finalPrompt || p.prompt || p.name,
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
