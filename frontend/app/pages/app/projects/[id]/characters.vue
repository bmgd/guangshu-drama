<template>
  <NuxtLayout name="studio" v-bind="layoutProps" @add-episode="addEpisode">
    <div class="asset-page">
      <div class="page-head">
        <h2>角色集 <span class="count">{{ characters.length }}</span></h2>
        <div class="btn-row">
          <button :disabled="!pendingIds.length" @click="confirmAll">全部确认</button>
          <button :disabled="!confirmedSelectedCount" @click="batchGen">
            批量生图 ({{ confirmedSelectedCount }})
          </button>
          <button class="primary" @click="showCreate = true">新建角色</button>
        </div>
      </div>

      <div v-if="showCreate" class="card create-form">
        <h3>新建角色</h3>
        <div class="form-grid">
          <label>名称<input v-model="form.name" placeholder="角色名" /></label>
          <label>角色定位<input v-model="form.role" placeholder="主角/配角…" /></label>
          <label class="full">描述<textarea v-model="form.description" rows="3" placeholder="外貌与性格简述" /></textarea></label>
        </div>
        <div class="btn-row">
          <button class="primary" :disabled="!form.name.trim()" @click="create">创建</button>
          <button @click="showCreate = false">取消</button>
        </div>
      </div>

      <div class="grid grid-3">
        <div v-for="char in characters" :key="char.id" class="card asset-card" :class="{ selected: selected.has(char.id) }">
          <label class="sel-check">
            <input type="checkbox" :checked="selected.has(char.id)" @change="toggleSelect(char.id)" />
          </label>
          <img v-if="char.imageUrl" :src="thumbUrl(char.imageUrl)" class="thumb" alt="" @click="editTarget = { ...char }" />
          <div v-else class="thumb thumb-placeholder" @click="editTarget = { ...char }">{{ char.name?.[0] }}</div>
          <h3>
            {{ char.name }}
            <span class="badge" :class="reviewBadge(char.reviewStatus)">{{ reviewLabel(char.reviewStatus) }}</span>
          </h3>
          <p>{{ char.description || char.role || '暂无描述' }}</p>
          <div class="btn-row">
            <button
              v-if="char.reviewStatus !== 'confirmed'"
              class="primary"
              @click="confirmOne(char.id)"
            >确认</button>
            <button :disabled="char.reviewStatus !== 'confirmed'" @click="genImage(char)">生成形象</button>
            <button :disabled="char.reviewStatus !== 'confirmed'" @click="cascadeRegen(char)">重生并更新关联分镜</button>
            <button @click="editTarget = { ...char }">编辑</button>
            <button class="danger-btn" @click="askRemove(char)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!characters.length" class="empty card">暂无角色，可新建或在工作台提取</div>
    </div>

    <div v-if="editTarget" class="modal-backdrop" @click.self="editTarget = null">
      <div class="modal">
        <h3>编辑角色</h3>
        <div class="form-grid">
          <label>名称<input v-model="editTarget.name" /></label>
          <label>角色定位<input v-model="editTarget.role" /></label>
          <label class="full">描述<textarea v-model="editTarget.description" rows="3" /></textarea></label>
          <label class="full">外貌<textarea v-model="editTarget.appearance" rows="2" /></textarea></label>
          <label class="full">性格<textarea v-model="editTarget.personality" rows="2" /></textarea></label>
          <label class="full">提示词<textarea v-model="editTarget.finalPrompt" rows="2" /></textarea></label>
          <label class="full">形象图
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
      title="删除角色"
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

const characters = computed(() => projectData.value.characters)
const layoutProps = computed(() => ({
  dramaId: dramaId.value,
  episodes: projectData.value.episodes,
  characters: projectData.value.characters,
  scenes: projectData.value.scenes,
  propsList: projectData.value.props,
  activeNav: 'characters',
  projectTitle: projectData.value.drama?.title,
}))

const showCreate = ref(false)
const form = reactive({ name: '', role: '', description: '' })
const editTarget = ref<any>(null)
const selected = ref(new Set<number>())
const confirmOpen = ref(false)
const confirmMessage = ref('')
const pendingDeleteId = ref<number | null>(null)

const pendingIds = computed(() =>
  characters.value.filter((c: any) => c.reviewStatus !== 'confirmed').map((c: any) => c.id),
)
const confirmedSelectedCount = computed(() =>
  characters.value.filter((c: any) => selected.value.has(c.id) && c.reviewStatus === 'confirmed').length,
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
  await api('/characters/confirm', { method: 'POST', body: JSON.stringify({ ids: [id] }) })
  await loadProject(dramaId.value)
}

async function confirmAll() {
  if (!pendingIds.value.length) return
  await api('/characters/confirm', { method: 'POST', body: JSON.stringify({ ids: pendingIds.value }) })
  await loadProject(dramaId.value)
}

async function create() {
  await api('/characters', {
    method: 'POST',
    body: JSON.stringify({
      dramaId: dramaId.value,
      name: form.name.trim(),
      role: form.role || undefined,
      description: form.description || undefined,
    }),
  })
  form.name = ''
  form.role = ''
  form.description = ''
  showCreate.value = false
  await loadProject(dramaId.value)
}

async function saveEdit() {
  if (!editTarget.value) return
  const t = editTarget.value
  await api(`/characters/${t.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: t.name,
      role: t.role,
      description: t.description,
      appearance: t.appearance,
      personality: t.personality,
      finalPrompt: t.finalPrompt,
      imageUrl: t.imageUrl,
      reviewStatus: 'pending_review',
    }),
  })
  editTarget.value = null
  await loadProject(dramaId.value)
}

function askRemove(char: any) {
  pendingDeleteId.value = char.id
  confirmMessage.value = `确定删除角色「${char.name}」？此操作不可恢复。`
  confirmOpen.value = true
}

async function confirmRemove() {
  const id = pendingDeleteId.value
  confirmOpen.value = false
  if (id == null) return
  await api(`/characters/${id}`, { method: 'DELETE' })
  pendingDeleteId.value = null
  await loadProject(dramaId.value)
}

async function genImage(char: any) {
  if (char.reviewStatus !== 'confirmed') {
    alert('请先确认该资产后再生成')
    return
  }
  await api('/tasks/image', {
    method: 'POST',
    body: JSON.stringify({
      type: 'character',
      targetId: char.id,
      prompt: char.finalPrompt || char.description || char.name,
      dramaId: dramaId.value,
    }),
  })
  alert('已提交生图任务')
}

async function cascadeRegen(char: any) {
  if (char.reviewStatus !== 'confirmed') {
    alert('请先确认该资产后再生成')
    return
  }
  try {
    const res = await api<{
      storyboardImageTaskIds: number[]
      skippedLocked: number
    }>(`/characters/${char.id}/cascade-regen`, {
      method: 'POST',
      body: JSON.stringify({ includeVideo: false }),
    })
    alert(`已提交角色重生与 ${res.storyboardImageTaskIds.length} 个关联分镜图任务` +
      (res.skippedLocked ? `（跳过 ${res.skippedLocked} 个锁定分镜）` : ''))
  } catch (err) {
    alert(err instanceof Error ? err.message : '级联重生失败')
  }
}

async function batchGen() {
  const items = characters.value
    .filter((c: any) => selected.value.has(c.id) && c.reviewStatus === 'confirmed')
    .map((c: any) => ({
      type: 'character' as const,
      targetId: c.id,
      prompt: c.finalPrompt || c.description || c.name,
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
