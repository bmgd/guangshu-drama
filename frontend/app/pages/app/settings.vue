<template>
  <div class="settings-page">
    <header class="page-header">
      <div>
        <NuxtLink to="/app/projects" class="back-link">← 返回项目</NuxtLink>
        <h1>设置</h1>
        <p class="subtitle">光束短剧 · 配置 AI 文本、图片、视频服务</p>
      </div>
    </header>

    <section v-if="showSetupWizard" class="card section wizard-card">
      <h2>首次配置向导</h2>
      <p class="hint">按顺序完成以下步骤，即可开始创作。费用发生在批量生成阶段，配置本身不扣费。</p>
      <ol class="wizard-steps">
        <li :class="{ active: wizardStep === 1, done: wizardStep > 1 }">
          <span class="step-num">1</span>
          <div>
            <strong>粘贴 API Key，选视频厂商，点一键配置</strong>
            <p>文本 / 图片 / 视频三条推荐配置会一次写入。</p>
          </div>
        </li>
        <li :class="{ active: wizardStep === 2, done: wizardStep > 2 }">
          <span class="step-num">2</span>
          <div>
            <strong>对文本点「测试」确认连通</strong>
            <p>连通后再进入工作台，避免改写中途失败。</p>
          </div>
        </li>
        <li :class="{ active: wizardStep === 3, done: hasTts }">
          <span class="step-num">3</span>
          <div>
            <strong>（可选）添加 TTS 配置用于旁白</strong>
            <p>旁白解说或广告口播时更有用。</p>
          </div>
        </li>
        <li :class="{ active: wizardStep === 4, done: statusReady }">
          <span class="step-num">4</span>
          <div>
            <strong>返回项目开始创作</strong>
            <p v-if="statusReady"><NuxtLink to="/app/projects">前往项目列表</NuxtLink></p>
            <p v-else>完成文本、图片、视频配置后即可返回。</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="card section">
      <h2>快捷配置</h2>
      <p class="hint">输入 API Key，一键写入文本、图片、视频三条推荐配置</p>
      <div class="form-group">
        <label>API Key</label>
        <input v-model="quickKey" type="password" placeholder="sk-..." />
      </div>
      <div class="form-group">
        <label>Base URL（可选，用于文本/图片）</label>
        <input v-model="quickBaseUrl" placeholder="https://api.openai.com/v1" />
      </div>
      <div class="form-group">
        <label>视频厂商</label>
        <select v-model="quickVideoProvider">
          <option value="volcengine">火山引擎 Seedance</option>
          <option value="minimax">MiniMax</option>
          <option value="aliyun">阿里云 Wan</option>
        </select>
      </div>
      <button class="btn primary" :disabled="!quickKey || quickBusy" @click="quickSetup">
        {{ quickBusy ? '配置中...' : '一键配置' }}
      </button>
    </section>

    <section class="card section">
      <div class="section-header">
        <h2>服务配置</h2>
        <button @click="openCreate">添加配置</button>
      </div>

      <div class="templates">
        <span class="templates-label">厂商模板</span>
        <div class="chips">
          <button
            v-for="tpl in providerTemplates"
            :key="tpl.label"
            type="button"
            class="chip"
            @click="applyTemplate(tpl)"
          >
            {{ tpl.label }}
          </button>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>厂商</th>
            <th>模型</th>
            <th>默认</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cfg in configs" :key="cfg.id">
            <td>{{ cfg.name }}</td>
            <td><span class="badge">{{ cfg.serviceType }}</span></td>
            <td>{{ cfg.provider }}</td>
            <td class="model-cell">{{ cfg.model }}</td>
            <td><span v-if="cfg.isDefault" class="badge accent">默认</span></td>
            <td class="actions">
              <button class="ghost" :disabled="testingId === cfg.id" @click="testConfig(cfg)">
                {{ testingId === cfg.id ? '测试中...' : '测试' }}
              </button>
              <button class="danger ghost" @click="askRemove(cfg)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!configs.length" class="empty">暂无配置</div>
    </section>

    <section class="card section">
      <h2>用量汇总</h2>
      <p class="hint">按服务类型汇总估算成本（CNY），来自 usage_records 台账</p>
      <div v-if="usageSummary" class="usage-grid">
        <div v-for="row in usageSummary.byService" :key="row.serviceType" class="usage-item">
          <span class="badge">{{ row.serviceType }}</span>
          <span>{{ row.count }} 次</span>
          <span>≈ {{ row.estimatedCost.toFixed(4) }} {{ usageSummary.currency }}</span>
        </div>
        <div v-if="!usageSummary.byService?.length" class="empty">暂无用量记录</div>
        <p v-else class="usage-total">
          合计估算 {{ usageSummary.totalEstimated.toFixed(4) }} {{ usageSummary.currency }}
          · {{ usageSummary.recordCount }} 条
        </p>
      </div>
      <div v-else class="empty">加载中...</div>
    </section>

    <section class="card section">
      <h2>Agent 技能编辑</h2>
      <div class="form-group">
        <label>选择技能</label>
        <select v-model="selectedSkill" @change="loadSkill">
          <option value="">请选择</option>
          <option v-for="s in skills" :key="s.path" :value="s.path">{{ s.id }}</option>
        </select>
      </div>
      <div v-if="selectedSkill" class="form-group">
        <label>SKILL.md 内容</label>
        <textarea v-model="skillContent" rows="12" />
        <button class="btn primary" style="margin-top:8px" @click="saveSkill">保存技能</button>
      </div>
    </section>

    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal">
        <h2>添加 AI 配置</h2>
        <div class="form-group">
          <label>服务类型</label>
          <select v-model="form.serviceType">
            <option value="text">文本</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
            <option value="tts">TTS 旁白</option>
          </select>
        </div>
        <div class="form-group">
          <label>名称</label>
          <input v-model="form.name" />
        </div>
        <div class="form-group">
          <label>厂商</label>
          <select v-model="form.provider">
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="volcengine">火山引擎</option>
            <option value="minimax">MiniMax</option>
            <option value="aliyun">阿里云</option>
          </select>
        </div>
        <div class="form-group">
          <label>Base URL</label>
          <input v-model="form.baseUrl" />
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input v-model="form.apiKey" type="password" />
        </div>
        <div class="form-group">
          <label>模型</label>
          <input v-model="form.model" />
        </div>
        <label class="checkbox-label">
          <input v-model="form.isDefault" type="checkbox" /> 设为默认
        </label>
        <div class="modal-footer">
          <button @click="showModal = false">取消</button>
          <button class="primary" @click="saveConfig">保存</button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      title="删除配置"
      :message="confirmMessage"
      @confirm="confirmRemove"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { api } from '../../composables/useApi'

definePageMeta({ layout: 'default' })

const { configReady } = useAppStore()

interface AiConfig {
  id: number
  serviceType: string
  provider: string
  name: string
  model?: string
  isDefault?: boolean
}

type ProviderTemplate = {
  label: string
  serviceType: 'text' | 'image' | 'video' | 'tts'
  provider: string
  name: string
  baseUrl: string
  model: string
}

const providerTemplates: ProviderTemplate[] = [
  {
    label: 'OpenAI 文本',
    serviceType: 'text',
    provider: 'openai',
    name: 'OpenAI 文本',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    label: 'Gemini 文本',
    serviceType: 'text',
    provider: 'gemini',
    name: 'Gemini 文本',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
  },
  {
    label: 'OpenAI 图片',
    serviceType: 'image',
    provider: 'openai',
    name: 'OpenAI 图片',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-image-1',
  },
  {
    label: 'Gemini 图片',
    serviceType: 'image',
    provider: 'gemini',
    name: 'Gemini 图片',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'imagen-3.0-generate-002',
  },
  {
    label: '火山图片',
    serviceType: 'image',
    provider: 'volcengine',
    name: '火山 Seedream',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seedream-3-0-t2i-250415',
  },
  {
    label: '火山视频 Seedance',
    serviceType: 'video',
    provider: 'volcengine',
    name: '火山 Seedance',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seedance-1-0-lite-i2v-250428',
  },
  {
    label: 'MiniMax 视频',
    serviceType: 'video',
    provider: 'minimax',
    name: 'MiniMax 视频',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-Hailuo-02',
  },
  {
    label: '阿里 Wan',
    serviceType: 'video',
    provider: 'aliyun',
    name: '阿里 Wan',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'wan2.6-t2v',
  },
  {
    label: 'OpenAI TTS',
    serviceType: 'tts',
    provider: 'openai',
    name: 'OpenAI TTS',
    baseUrl: 'https://api.openai.com/v1',
    model: 'tts-1',
  },
]

const configs = ref<AiConfig[]>([])
const skills = ref<Array<{ id: string; path: string }>>([])
const selectedSkill = ref('')
const skillContent = ref('')
const quickKey = ref('')
const quickBaseUrl = ref('')
const quickVideoProvider = ref<'volcengine' | 'minimax' | 'aliyun'>('volcengine')
const quickBusy = ref(false)
const showModal = ref(false)
const testingId = ref<number | null>(null)
const confirmOpen = ref(false)
const confirmMessage = ref('')
const pendingDeleteId = ref<number | null>(null)

const form = reactive({
  serviceType: 'text' as 'text' | 'image' | 'video' | 'tts',
  provider: 'openai',
  name: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  isDefault: true,
})

const usageSummary = ref<{
  byService: Array<{ serviceType: string; units: number; estimatedCost: number; count: number }>
  totalEstimated: number
  currency: string
  recordCount: number
} | null>(null)

const serviceStatus = ref<{ text?: boolean; image?: boolean; video?: boolean; configured?: boolean }>({})

const hasTts = computed(() => configs.value.some((c) => c.serviceType === 'tts'))
const statusReady = computed(() =>
  !!(serviceStatus.value.text && serviceStatus.value.image && serviceStatus.value.video),
)
const showSetupWizard = computed(() =>
  !configs.value.length || !statusReady.value,
)
const wizardStep = computed(() => {
  if (!configs.value.length) return 1
  if (!statusReady.value) return 1
  if (!hasTts.value) return 3
  return 4
})

function notifySuccess(msg: string) {
  toast.success(msg)
}

function notifyError(msg: string) {
  toast.error(msg)
}

async function loadStatus() {
  try {
    const res = await $fetch<{ data: { configured: boolean; text?: boolean; image?: boolean; video?: boolean } }>(
      '/api/v1/ai-configs/status',
    )
    serviceStatus.value = res.data || {}
  } catch {
    serviceStatus.value = {}
  }
}

async function load() {
  configs.value = await api('/ai-configs')
  skills.value = await api('/skills')
  await loadStatus()
  configReady.value = !!serviceStatus.value.configured || statusReady.value
  try {
    usageSummary.value = await api('/usage/summary')
  } catch {
    usageSummary.value = { byService: [], totalEstimated: 0, currency: 'CNY', recordCount: 0 }
  }
}

async function quickSetup() {
  quickBusy.value = true
  try {
    await api('/ai-configs/quick-setup', {
      method: 'POST',
      body: JSON.stringify({
        apiKey: quickKey.value,
        baseUrl: quickBaseUrl.value || undefined,
        videoProvider: quickVideoProvider.value,
      }),
    })
    await load()
    notifySuccess('快捷配置完成')
  } catch (e) {
    notifyError(e instanceof Error ? e.message : '快捷配置失败')
  } finally {
    quickBusy.value = false
  }
}

function applyTemplate(tpl: ProviderTemplate) {
  form.serviceType = tpl.serviceType
  form.provider = tpl.provider
  form.name = tpl.name
  form.baseUrl = tpl.baseUrl
  form.model = tpl.model
  form.isDefault = true
  showModal.value = true
}

function openCreate() {
  showModal.value = true
}

async function saveConfig() {
  try {
    await api('/ai-configs', { method: 'POST', body: JSON.stringify(form) })
    showModal.value = false
    await load()
    notifySuccess('配置已保存')
  } catch (e) {
    notifyError(e instanceof Error ? e.message : '保存失败')
  }
}

function askRemove(cfg: AiConfig) {
  pendingDeleteId.value = cfg.id
  confirmMessage.value = `确定删除配置「${cfg.name}」？此操作不可恢复。`
  confirmOpen.value = true
}

async function confirmRemove() {
  const id = pendingDeleteId.value
  confirmOpen.value = false
  if (id == null) return
  try {
    await api(`/ai-configs/${id}`, { method: 'DELETE' })
    await load()
    notifySuccess('已删除')
  } catch (e) {
    notifyError(e instanceof Error ? e.message : '删除失败')
  } finally {
    pendingDeleteId.value = null
  }
}

async function testConfig(cfg: AiConfig) {
  testingId.value = cfg.id
  try {
    const res = await api<{ ok: boolean; message: string }>('/ai-configs/test', {
      method: 'POST',
      body: JSON.stringify({ serviceType: cfg.serviceType, configId: cfg.id }),
    })
    notifySuccess(res.message || '测试成功')
  } catch (e) {
    notifyError(e instanceof Error ? e.message : '测试失败')
  } finally {
    testingId.value = null
  }
}

async function loadSkill() {
  if (!selectedSkill.value) return
  const res = await api<{ content: string }>(`/skills/${selectedSkill.value}`)
  skillContent.value = res.content
}

async function saveSkill() {
  try {
    await api(`/skills/${selectedSkill.value}`, {
      method: 'PUT',
      body: JSON.stringify({ content: skillContent.value }),
    })
    notifySuccess('技能已保存')
  } catch (e) {
    notifyError(e instanceof Error ? e.message : '保存失败')
  }
}

onMounted(load)
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding: 32px 40px;
  max-width: 960px;
  margin: 0 auto;
}
.back-link { font-size: 13px; color: var(--color-text-3); display: block; margin-bottom: 8px; }
.page-header { margin-bottom: 28px; }
.page-header h1 { font-size: 24px; font-weight: 700; }
.subtitle { color: var(--color-text-3); margin-top: 4px; }
.section { margin-bottom: 20px; }
.section h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.hint { color: var(--color-text-3); font-size: 13px; margin-bottom: 12px; }
.wizard-card { border-left: 3px solid var(--color-accent); }
.wizard-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wizard-steps li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--color-text-3);
}
.wizard-steps li.active {
  border-color: var(--color-accent-soft);
  background: oklch(0.72 0.14 280 / 0.08);
  color: var(--color-text);
}
.wizard-steps li.done { color: var(--color-success); }
.wizard-steps .step-num {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid currentColor;
  flex-shrink: 0;
}
.wizard-steps strong { display: block; font-size: 13px; margin-bottom: 2px; }
.wizard-steps p { font-size: 12px; color: var(--color-text-3); margin: 0; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.templates { margin-bottom: 16px; }
.templates-label { font-size: 12px; color: var(--color-text-3); display: block; margin-bottom: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border, oklch(0.3 0.02 280));
  background: transparent;
  color: var(--color-text-2, inherit);
  cursor: pointer;
}
.chip:hover { border-color: var(--color-accent); color: var(--color-accent); }
.model-cell { font-size: 12px; color: var(--color-text-3); }
.actions { display: flex; gap: 4px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-top: 8px; }
.modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
.usage-grid { display: flex; flex-direction: column; gap: 8px; }
.usage-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text-2);
}
.usage-total { font-size: 13px; color: var(--color-text-3); margin-top: 8px; }
</style>
