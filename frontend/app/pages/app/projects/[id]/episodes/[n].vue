<template>
  <NuxtLayout
    name="studio"
    v-bind="layoutProps"
    :agent-loading="agent.loading"
    :show-resolution="true"
    :show-model-select="true"
    :resolution="currentResolution"
    :resolution-options="resolutionOptions"
    :image-config-id="episode?.imageConfigId ?? null"
    :video-config-id="episode?.videoConfigId ?? null"
    @select-episode="onSelectEpisode"
    @add-episode="addEpisode"
    @agent-rewrite="doRewrite"
    @agent-extract="doExtract"
    @agent-storyboard="doStoryboard"
    @agent-pipeline="runPipeline"
    @update:resolution="onResolutionChange"
    @update:image-config-id="onImageConfigChange"
    @update:video-config-id="onVideoConfigChange"
  >
    <div v-if="episode" class="workspace-wrap">
      <CoachCard
        v-if="nextCoach"
        :id="nextCoach.id"
        :title="nextCoach.title"
        :body="nextCoach.body"
        :primary-label="nextCoach.primaryLabel"
        :secondary-label="nextCoach.secondaryLabel"
        :tone="nextCoach.tone"
        @primary="onCoachPrimary"
        @secondary="onCoachSecondary"
      />
      <div class="workspace">
      <div class="workspace-main">
        <section ref="scriptPanelEl" class="card panel script-panel">
          <div class="panel-header">
            <h2>原文 / 剧本</h2>
            <label class="style-select">
              <span>风格</span>
              <select :value="currentStyle" @change="onStyleChange">
                <option v-for="p in stylePresets" :key="p.value" :value="p.value">{{ p.name }}</option>
              </select>
            </label>
          </div>
          <textarea v-model="sourceContent" rows="6" placeholder="粘贴小说原文或故事梗概..." />
          <div class="btn-row">
            <button :disabled="agent.loading" @click="doRewrite">改写剧本</button>
            <button :disabled="agent.loading" @click="doGenerateFromBrief">从大纲生成</button>
            <button :disabled="agent.loading" @click="doExtract">提取元素</button>
            <button :disabled="agent.loading" @click="doStoryboard">拆解分镜</button>
          </div>
          <h3 class="sub-heading">剧本文本</h3>
          <MentionTextarea
            v-model="scriptContent"
            class="script-area"
            :mentions="mentionItems"
            placeholder="改写后的剧本... 输入 @ 可提及角色/场景/道具"
          />
        </section>

        <section class="card panel boards-panel">
          <div class="panel-header">
            <h2>分镜列表 <span class="count">{{ storyboards.length }}</span></h2>
            <div class="btn-row">
              <button class="primary" :disabled="produceBusy" @click="runProduceSample">一键生产（样片）</button>
              <button :disabled="produceBusy" @click="resumeProduce">从检查点继续</button>
              <button @click="genAllPrompts">批量提示词</button>
              <button @click="openBatchImageSample">样片首帧（前3镜）</button>
              <button @click="openBatchLastFrameSample">样片尾帧（前3镜）</button>
              <button @click="openBatchImage">批量首帧图</button>
              <button @click="openBatchVideoSample">样片视频（前3镜）</button>
              <button @click="openBatchVideo">批量视频</button>
              <button class="primary" @click="doMerge">整集导出</button>
            </div>
          </div>

          <div v-if="failedTasks.length" class="fail-bar">
            <span>{{ failedTasks.length }} 个失败任务</span>
            <button class="tiny" @click="retryFailedTasks">一键重试失败</button>
          </div>

          <div class="selection-bar" v-if="storyboards.length">
            <label class="check-label">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              全选
            </label>
            <span class="sel-count">已选 {{ selectedIds.size }} / {{ storyboards.length }}</span>
            <label class="check-label" title="批量视频默认仅缺失；勾选后含过期">
              <input type="checkbox" v-model="includeStaleInBatch" />
              含过期
            </label>
            <span class="stale-hint">过期 = 镜头已有视频，但描述/提示词后来改过；默认批量不会重做，避免重复扣费。</span>
            <button class="ghost" :disabled="!selectedIds.size" @click="doMergeSelected">导出选中</button>
            <span v-if="dramaCostLabel" class="cost-chip">{{ dramaCostLabel }}</span>
          </div>

          <div class="table-wrap">
            <table class="table boards-table">
              <thead>
                <tr>
                  <th class="col-check" />
                  <th class="col-num">#</th>
                  <th>景别</th>
                  <th>描述</th>
                  <th class="col-dur">时长</th>
                  <th>状态</th>
                  <th>预览</th>
                  <th class="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="sb in storyboards"
                  :key="sb.id"
                  :class="{
                    selected: selectedIds.has(sb.id),
                    'active-row': activePanelTarget === sb.id,
                  }"
                  @click="activePanelTarget = sb.id"
                >
                  <td class="col-check">
                    <input
                      type="checkbox"
                      :checked="selectedIds.has(sb.id)"
                      @change="toggleSelect(sb.id)"
                      @click.stop
                    />
                  </td>
                  <td class="col-num">
                    <span v-if="sb.locked" class="lock-mark" title="已锁定">锁</span>
                    {{ sb.storyboardNumber }}
                  </td>
                  <td>{{ sb.shotType || '-' }}</td>
                  <td class="desc-cell">
                    <input
                      class="inline-input"
                      :value="sb.description || ''"
                      placeholder="镜头描述"
                      @blur="(e) => saveDescription(sb.id, (e.target as HTMLInputElement).value)"
                      @click.stop
                    />
                  </td>
                  <td class="col-dur">
                    <input
                      class="dur-input"
                      type="number"
                      min="1"
                      max="30"
                      :value="sb.duration || 5"
                      @blur="(e) => saveDuration(sb.id, Number((e.target as HTMLInputElement).value))"
                      @click.stop
                    />
                  </td>
                  <td>
                    <span class="badge" :class="statusClass(sb.status)">{{ statusLabel(sb.status) }}</span>
                    <span class="badge" :class="artifactClass(sb.artifactStatus)">{{ artifactLabel(sb.artifactStatus) }}</span>
                    <span v-if="failedTaskFor(sb.id)" class="badge danger fail-badge">失败</span>
                  </td>
                  <td>
                    <a v-if="sb.videoUrl || sb.composedVideoUrl" :href="sb.composedVideoUrl || sb.videoUrl" target="_blank" class="preview-link" @click.stop>
                      <img v-if="sb.firstFrameImage" :src="thumbUrl(sb.firstFrameImage)" class="preview-thumb" alt="" />
                      <span v-else>视频</span>
                    </a>
                    <img
                      v-else-if="sb.firstFrameImage"
                      :src="thumbUrl(sb.firstFrameImage)"
                      class="preview-thumb"
                      alt=""
                      @click.stop="lightboxUrl = sb.firstFrameImage || null"
                    />
                    <span v-else class="muted">-</span>
                  </td>
                  <td class="col-actions">
                    <button
                      class="tiny"
                      :title="sb.locked ? '解锁' : '锁定'"
                      @click.stop="toggleLock(sb)"
                    >{{ sb.locked ? '开锁' : '锁定' }}</button>
                    <button class="tiny" title="重新生图" :disabled="!!sb.locked" @click.stop="regenImage(sb)">图</button>
                    <button class="tiny" title="重新生视频" :disabled="!!sb.locked" @click.stop="regenVideo(sb)">视</button>
                    <button class="tiny" title="合成字幕" :disabled="!sb.videoUrl || !!sb.locked" @click.stop="doCompose(sb.id)">合</button>
                    <button
                      v-if="failedTaskFor(sb.id)"
                      class="tiny danger-btn"
                      title="重试失败任务"
                      @click.stop="retryBoardTask(sb.id)"
                    >重试</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!storyboards.length" class="empty">请先拆解分镜</div>
          </div>
        </section>
      </div>

      <aside class="side-panels">
        <div class="card side-card">
          <h3>镜头图</h3>
          <template v-if="activeBoard">
            <button
              v-if="activeBoard.firstFrameImage"
              type="button"
              class="thumb-btn"
              @click="lightboxUrl = activeBoard.firstFrameImage || null"
            >
              <img :src="thumbUrl(activeBoard.firstFrameImage)" class="side-preview" alt="首帧图" />
            </button>
            <p v-else class="muted">暂无首帧图</p>
            <label class="field-label">生图提示词</label>
            <textarea
              class="prompt-area"
              :value="activeBoard.imagePrompt || ''"
              rows="4"
              placeholder="描述镜头首帧画面..."
              @blur="(e) => activeBoard && saveImagePrompt(activeBoard.id, (e.target as HTMLTextAreaElement).value)"
            />
            <button class="block-btn" @click="activeBoard && regenImage(activeBoard)">
              {{ activeBoard.firstFrameImage ? '重生成' : '生成' }}首帧图
            </button>
            <button
              class="block-btn"
              :disabled="!!activeBoard.locked"
              @click="activeBoard && regenLastFrame(activeBoard)"
            >
              {{ activeBoard.lastFrameImage ? '重生成' : '生成' }}尾帧
            </button>
            <button
              v-if="activeBoard.firstFrameImage"
              class="ghost tiny-block"
              type="button"
              @click="openHistory('storyboard', activeBoard.id, 'firstFrameImage')"
            >历史</button>
            <div class="upload-row">
              <button class="ghost tiny-block" @click="uploadBoardImage('firstFrameImage')">上传首帧覆盖</button>
              <button class="ghost tiny-block" @click="uploadBoardImage('lastFrameImage')">上传尾帧</button>
              <button class="ghost tiny-block" @click="uploadReferenceImage">上传参考图</button>
            </div>
            <div v-if="activeBoard.lastFrameImage" class="ref-preview">
              <span class="field-label">尾帧</span>
              <img :src="thumbUrl(activeBoard.lastFrameImage)" class="mini-thumb" alt="尾帧" />
              <button class="tiny" @click="clearLastFrame">清除</button>
            </div>
            <div v-if="activeRefImages.length" class="ref-list">
              <span class="field-label">参考图 ({{ activeRefImages.length }})</span>
              <div class="ref-thumbs">
                <div v-for="(url, idx) in activeRefImages" :key="url + idx" class="ref-item">
                  <img :src="thumbUrl(url)" class="mini-thumb" alt="参考图" />
                  <button class="tiny" @click="removeReferenceImage(idx)">×</button>
                </div>
              </div>
            </div>
          </template>
          <p v-else class="muted">选中分镜查看首帧图</p>
        </div>

        <div class="card side-card">
          <h3>视频提示词</h3>
          <template v-if="activeBoard">
            <textarea
              class="prompt-area"
              :value="activeBoard.videoPrompt || ''"
              rows="4"
              placeholder="描述镜头运动与画面变化..."
              @blur="(e) => activeBoard && saveVideoPrompt(activeBoard.id, (e.target as HTMLTextAreaElement).value)"
            />
            <button class="block-btn" @click="activeBoard && regenVideo(activeBoard)">生成视频</button>
            <button
              v-if="activeBoard.videoUrl"
              class="ghost tiny-block"
              type="button"
              @click="openHistory('storyboard', activeBoard.id, 'videoUrl')"
            >历史</button>
          </template>
          <p v-else class="muted">选中分镜编辑视频提示词</p>
        </div>

        <div class="card side-card">
          <h3>旁白 / TTS</h3>
          <template v-if="activeBoard">
            <label class="field-label">旁白文案</label>
            <textarea
              class="prompt-area"
              :value="activeBoard.narrationText || activeBoard.description || ''"
              rows="3"
              placeholder="旁白文本（默认用镜头描述）"
              @blur="(e) => activeBoard && saveNarration(activeBoard.id, (e.target as HTMLTextAreaElement).value)"
            />
            <button class="block-btn" :disabled="ttsBusy" @click="activeBoard && generateNarration(activeBoard)">
              {{ ttsBusy ? '生成中...' : '生成旁白' }}
            </button>
            <audio v-if="activeBoard.audioUrl" :src="activeBoard.audioUrl" controls class="side-audio" />
            <p v-else class="muted">生成后可预览 MP3</p>
          </template>
          <p v-else class="muted">选中分镜编辑旁白</p>
        </div>

        <div class="card side-card">
          <h3>视频预览</h3>
          <template v-if="activeBoard?.videoUrl">
            <video :src="activeBoard.videoUrl" controls class="side-video" />
          </template>
          <p v-else class="muted">暂无生成视频</p>
        </div>

        <div class="card side-card">
          <h3>合成结果</h3>
          <template v-if="activeBoard?.composedVideoUrl">
            <video :src="activeBoard.composedVideoUrl" controls class="side-video" />
            <a
              v-if="activeBoard.subtitleUrl"
              :href="activeBoard.subtitleUrl"
              target="_blank"
              class="export-link"
            >下载字幕</a>
          </template>
          <p v-else class="muted">合成后显示字幕成片</p>
          <button
            class="block-btn"
            :disabled="!activeBoard?.videoUrl"
            @click="activeBoard && doCompose(activeBoard.id)"
          >
            合成当前镜头
          </button>
        </div>

        <div class="card side-card">
          <h3>导出</h3>
          <p class="muted">勾选镜头后导出，或导出整集 / 剪映草稿</p>
          <div class="btn-row">
            <button :disabled="!selectedIds.size" @click="doMergeSelected">导出选中</button>
            <button class="primary" @click="doMerge">整集导出</button>
          </div>
          <button class="block-btn" :disabled="jianyingBusy" @click="exportJianying">
            {{ jianyingBusy ? '导出中...' : '导出剪映草稿' }}
          </button>
          <a v-if="jianyingUrl" :href="jianyingUrl" target="_blank" class="export-link">下载剪映 ZIP</a>
          <a v-if="episode.videoUrl" :href="episode.videoUrl" target="_blank" class="export-link">查看已导出成片</a>
        </div>
      </aside>
      </div>
    </div>
    <div v-else class="empty">加载中...</div>

    <div v-if="historyOpen" class="modal-backdrop" @click.self="historyOpen = false">
      <div class="modal history-modal">
        <h3>媒体历史</h3>
        <ul v-if="historyRows.length" class="history-list">
          <li v-for="v in historyRows" :key="v.id" class="history-row">
            <a :href="v.url" target="_blank" class="history-url">{{ v.url }}</a>
            <span class="muted">{{ v.createdAt }}</span>
            <button class="tiny" @click="restoreVersion(v.id)">恢复</button>
          </li>
        </ul>
        <p v-else class="muted">暂无历史版本</p>
        <div class="modal-footer">
          <button @click="historyOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <BatchVideoConfirm
      :open="showVideoConfirm"
      mode="video"
      :count="pendingVideoItems.length"
      :total-duration="pendingTotalDuration"
      :model="activeVideoModel"
      :resolution="currentResolution"
      :estimated-cost="batchEstimatedCost"
      :warning="batchWarning || undefined"
      message="确认后将提交批量视频生成任务"
      @confirm="confirmBatchVideo"
      @cancel="showVideoConfirm = false"
    />

    <BatchVideoConfirm
      :open="showImageConfirm"
      mode="image"
      :count="pendingImageItems.length"
      :estimated-cost="batchImageEstimatedCost"
      :warning="batchImageWarning || undefined"
      message="确认后将提交批量首帧图生成任务"
      @confirm="confirmBatchImage"
      @cancel="showImageConfirm = false"
    />

    <ConfirmDialog
      :open="mergeConfirmOpen"
      :title="mergeConfirmTitle"
      :message="mergeConfirmMessage"
      @confirm="confirmMerge"
      @cancel="mergeConfirmOpen = false"
    />

    <div
      v-if="lightboxUrl"
      class="lightbox-backdrop"
      @click.self="lightboxUrl = null"
    >
      <img :src="lightboxUrl" class="lightbox-img" alt="原图预览" />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'
import { api, streamApi } from '../../../../../composables/useApi'
import { useAgent } from '../../../../../composables/useAgent'
import { useWorkbench, type Episode, type Storyboard, type VideoBatchItem } from '../../../../../composables/useWorkbench'
import BatchVideoConfirm from '../../../../../components/BatchVideoConfirm.vue'
import CoachCard from '../../../../../components/CoachCard.vue'
import ConfirmDialog from '../../../../../components/ConfirmDialog.vue'
import MentionTextarea from '../../../../../components/MentionTextarea.vue'
const route = useRoute()
const router = useRouter()
const agent = useAgent()
const { thumbUrl } = useMedia()
const { addPipelineLog, clearPipelineLogs } = useAppStore()
const { currentProjectData: projectData, loadProject } = useProjectsStore()
const { tasks: storeTasks, fetchTasks } = useTasksStore()

const dramaId = computed(() => Number(route.params.id))
const episodeId = ref(Number(route.query.episodeId) || 0)

const {
  episode, storyboards, pipelineStatus,
  refresh, generatePrompts, batchGenerateImages, batchGenerateVideos,
  patchStoryboard, retryTask, composeStoryboard, mergeEpisode, updateEpisodeResolution,
  updateEpisodeModels,
} = useWorkbench(episodeId as Ref<number>, dramaId)

const sourceContent = ref('')
const scriptContent = ref('')
const selectedIds = ref<Set<number>>(new Set())
const activePanelTarget = ref<number | null>(null)
const showVideoConfirm = ref(false)
const showImageConfirm = ref(false)
const pendingVideoItems = ref<VideoBatchItem[]>([])
const pendingImageItems = ref<Array<{ type: string; targetId: number; prompt: string; configId?: number; frameType?: 'first' | 'last' }>>([])
const lightboxUrl = ref<string | null>(null)
const produceBusy = ref(false)
const resolutionOptions = ref<string[]>(['480p', '720p'])
const currentResolution = ref('720p')
const activeVideoProvider = ref('volcengine')
const activeVideoModel = ref('')
const stylePresets = ref<Array<{ name: string; value: string }>>([])
const currentStyle = ref('3d')
const mergeConfirmOpen = ref(false)
const mergeConfirmMode = ref<'all' | 'selected'>('all')
const includeStaleInBatch = ref(false)
const ttsBusy = ref(false)
const jianyingBusy = ref(false)
const jianyingUrl = ref<string | null>(null)
const dramaCostLabel = ref('')
const historyOpen = ref(false)
const historyRows = ref<Array<{ id: number; url: string; createdAt: string; field: string }>>([])
const scriptPanelEl = ref<HTMLElement | null>(null)
const batchEstimatedCost = ref<number | null>(null)
const batchWarning = ref('')
const batchImageEstimatedCost = ref<number | null>(null)
const batchImageWarning = ref('')
const videoPricePerUnit = ref<number | null>(null)
const imagePricePerUnit = ref<number | null>(null)
const pendingBatchIsSample = ref(false)
const mergeConfirmTitle = computed(() =>
  mergeConfirmMode.value === 'selected' ? '导出选中镜头' : '整集导出',
)
const mergeConfirmMessage = computed(() =>
  mergeConfirmMode.value === 'selected'
    ? `确认导出已选中的 ${selectedIds.value.size} 个镜头？`
    : '确认拼接整集所有可用镜头并导出？',
)
const boardIdSet = computed(() => new Set(storyboards.value.map((s) => s.id)))

const failedTasks = computed(() =>
  storeTasks.value.filter(
    (t) => t.status === 'failed' && t.storyboardId && boardIdSet.value.has(t.storyboardId),
  ),
)

const currentPhase = computed(() => {
  const s = pipelineStatus.value
  if (s.hasMerged) return 'export'
  if (s.hasVideos) return 'video'
  if (s.hasImages) return 'image'
  if (s.hasBoards) return 'storyboard'
  if (s.hasScript) return 'extract'
  return 'script'
})

const completedPhases = computed(() => {
  const s = pipelineStatus.value
  const keys: string[] = []
  if (s.hasScript) keys.push('script')
  const hasElements =
    (projectData.value.characters?.length || 0) > 0
    || (projectData.value.scenes?.length || 0) > 0
  if (s.hasScript || hasElements) keys.push('extract')
  if (s.hasBoards) keys.push('storyboard')
  if (s.hasImages) keys.push('image')
  if (s.hasVideos) keys.push('video')
  if (s.hasMerged) keys.push('export')
  return keys
})

const layoutProps = computed(() => ({
  dramaId: dramaId.value,
  episodes: projectData.value.episodes,
  characters: projectData.value.characters,
  scenes: projectData.value.scenes,
  propsList: projectData.value.props,
  activeEpisodeId: episodeId.value,
  activeNav: 'overview',
  showStepper: true,
  currentPhase: currentPhase.value,
  completedPhases: completedPhases.value,
  projectTitle: projectData.value.drama?.title,
}))

const mentionItems = computed(() => [
  ...projectData.value.characters.map((c: any) => ({ id: c.id, name: c.name, type: 'character' })),
  ...projectData.value.scenes.map((s: any) => ({ id: s.id, name: s.location, type: 'scene' })),
  ...projectData.value.props.map((p: any) => ({ id: p.id, name: p.name, type: 'prop' })),
])

const activeBoard = computed(() => {
  if (!storyboards.value.length) return null
  if (activePanelTarget.value) {
    return storyboards.value.find((s) => s.id === activePanelTarget.value) || storyboards.value[0]
  }
  return storyboards.value[0]
})

const activeRefImages = computed(() => parseRefImages(activeBoard.value?.referenceImages))

function parseRefImages(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function failedTaskFor(storyboardId: number) {
  return storeTasks.value.find(
    (t) => t.status === 'failed' && t.storyboardId === storyboardId,
  ) || null
}
const allSelected = computed(() =>
  storyboards.value.length > 0 && storyboards.value.every((s) => selectedIds.value.has(s.id)),
)

const pendingTotalDuration = computed(() =>
  pendingVideoItems.value.reduce((sum, item) => {
    const sb = storyboards.value.find((s) => s.id === item.storyboardId)
    return sum + (item.duration || sb?.duration || 5)
  }, 0),
)

const imageCount = computed(() => storyboards.value.filter((s) => s.firstFrameImage).length)
const videoCount = computed(() => storyboards.value.filter((s) => s.videoUrl).length)

type CoachStep = {
  id: string
  title: string
  body: string
  primaryLabel?: string
  secondaryLabel?: string
  tone?: 'info' | 'success' | 'warning'
  primaryAction: string
  secondaryAction?: string
}

const nextCoach = computed<CoachStep | null>(() => {
  const s = pipelineStatus.value
  const epKey = `ep-${episodeId.value || 'x'}`
  if (!s.hasScript) {
    return {
      id: `${epKey}-script`,
      title: '下一步建议',
      body: '先粘贴原文或大纲。可「改写剧本」或「从大纲生成」。建议先用一个章节试跑。',
      primaryLabel: '去粘贴原文',
      secondaryLabel: '从大纲生成',
      tone: 'info',
      primaryAction: 'focusScript',
      secondaryAction: 'generateScript',
    }
  }
  if (!s.hasBoards) {
    return {
      id: `${epKey}-boards`,
      title: '下一步建议',
      body: '剧本好了。下一步：提取角色场景，再拆解分镜。',
      primaryLabel: '提取元素',
      secondaryLabel: '拆解分镜',
      tone: 'info',
      primaryAction: 'extract',
      secondaryAction: 'storyboard',
    }
  }
  if (imageCount.value < 4 && videoCount.value === 0) {
    return {
      id: `${epKey}-sample`,
      title: '样片优先',
      body: '先做样片：可用「一键生产（样片）」跑通剧本→分镜→图视频，或只生成前几镜。',
      primaryLabel: '一键生产（样片）',
      secondaryLabel: '样片首帧（前3镜）',
      tone: 'warning',
      primaryAction: 'produceSample',
      secondaryAction: 'sampleImage',
    }
  }
  if (videoCount.value < storyboards.value.length) {
    return {
      id: `${epKey}-videos`,
      title: '下一步建议',
      body: '样片通过后，再批量补齐缺失视频。过期镜头表示提示词已改，需要重做才会刷新。',
      primaryLabel: '批量补齐视频',
      secondaryLabel: '样片视频（前3镜）',
      tone: 'info',
      primaryAction: 'batchVideo',
      secondaryAction: 'sampleVideo',
    }
  }
  if (!s.hasMerged) {
    return {
      id: `${epKey}-export`,
      title: '可以导出了',
      body: '镜头齐了？可以导出成片或剪映草稿，在剪映里继续调字幕和节奏。',
      primaryLabel: '整集导出',
      secondaryLabel: '剪映草稿',
      tone: 'success',
      primaryAction: 'merge',
      secondaryAction: 'jianying',
    }
  }
  return {
    id: `${epKey}-done`,
    title: '本集完成',
    body: '本集主流程已完成。可回看过期镜头、费用汇总，或开下一集。',
    primaryLabel: '查看费用',
    tone: 'success',
    primaryAction: 'cost',
  }
})

function onCoachPrimary() {
  runCoachAction(nextCoach.value?.primaryAction)
}

function onCoachSecondary() {
  runCoachAction(nextCoach.value?.secondaryAction)
}

function runCoachAction(action?: string) {
  if (!action) return
  if (action === 'focusScript') {
    scriptPanelEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  if (action === 'rewrite') void doRewrite()
  if (action === 'generateScript') void doGenerateFromBrief()
  if (action === 'extract') void doExtract()
  if (action === 'storyboard') void doStoryboard()
  if (action === 'sampleVideo') openBatchVideoSample()
  if (action === 'sampleImage') openBatchImageSample()
  if (action === 'produceSample') void runProduceSample()
  if (action === 'batchVideo') openBatchVideo()
  if (action === 'merge') doMerge()
  if (action === 'jianying') void exportJianying()
  if (action === 'cost') {
    void loadDramaCost()
    addPipelineLog('coach', dramaCostLabel.value || '暂无费用记录，生成后可在此查看汇总')
  }
}

function sampleDoneKey() {
  return `guangshu-sample-done-${dramaId.value}`
}

function hasSampleDoneFlag() {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(sampleDoneKey()) === '1'
  } catch {
    return false
  }
}

function markSampleDone() {
  if (!import.meta.client) return
  try {
    localStorage.setItem(sampleDoneKey(), '1')
  } catch { /* ignore */ }
}

function parsePricePerUnit(settings?: string | null): number | null {
  if (!settings) return null
  try {
    const parsed = JSON.parse(settings) as { pricePerUnit?: number }
    return typeof parsed.pricePerUnit === 'number' ? parsed.pricePerUnit : null
  } catch {
    return null
  }
}

async function loadPriceHints() {
  try {
    const configs = await api<Array<{ serviceType: string; settings?: string | null; isDefault?: boolean; isActive?: boolean }>>('/ai-configs')
    const pick = (type: string) => {
      const list = configs.filter((c) => c.serviceType === type)
      const active = list.find((c) => c.isDefault && c.isActive !== false) || list.find((c) => c.isActive !== false) || list[0]
      return parsePricePerUnit(active?.settings)
    }
    videoPricePerUnit.value = pick('video')
    imagePricePerUnit.value = pick('image')
  } catch {
    videoPricePerUnit.value = null
    imagePricePerUnit.value = null
  }
}

function estimateVideoCost(items: VideoBatchItem[]) {
  const units = items.reduce((sum, item) => sum + (item.duration || 5), 0)
  const rate = videoPricePerUnit.value ?? 0.1
  return Math.round(units * rate * 100) / 100
}

function estimateImageCost(count: number) {
  const rate = imagePricePerUnit.value ?? 0.05
  return Math.round(count * rate * 100) / 100
}

function prepareVideoConfirm(items: VideoBatchItem[], isSample: boolean) {
  pendingVideoItems.value = items
  pendingBatchIsSample.value = isSample
  batchEstimatedCost.value = estimateVideoCost(items)
  if (!isSample && items.length > 4 && !hasSampleDoneFlag()) {
    batchWarning.value = `首次建议先跑样片，当前将提交 ${items.length} 个镜头`
  } else {
    batchWarning.value = ''
  }
  showVideoConfirm.value = true
}

function prepareImageConfirm(items: Array<{ type: string; targetId: number; prompt: string; configId?: number }>, isSample: boolean) {
  pendingImageItems.value = items
  pendingBatchIsSample.value = isSample
  batchImageEstimatedCost.value = estimateImageCost(items.length)
  if (!isSample && items.length > 4 && !hasSampleDoneFlag()) {
    batchImageWarning.value = `首次建议先跑样片，当前将提交 ${items.length} 个镜头`
  } else {
    batchImageWarning.value = ''
  }
  showImageConfirm.value = true
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    image_ready: '已有图',
    video_ready: '已有视频',
    composed: '已合成',
  }
  return map[status] || status
}

function statusClass(status: string) {
  if (status === 'composed' || status === 'video_ready') return 'success'
  if (status === 'image_ready') return 'accent'
  return ''
}

function artifactLabel(status?: string) {
  if (status === 'current') return '当前'
  if (status === 'stale') return '过期'
  return '缺失'
}

function artifactClass(status?: string) {
  if (status === 'current') return 'success'
  if (status === 'stale') return 'warn'
  return ''
}

function toggleSelect(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  selectedIds.value = checked
    ? new Set(storyboards.value.map((s) => s.id))
    : new Set()
}

async function loadCapabilities() {
  try {
    const caps = await api<{ video: Record<string, { resolutions: string[] }> }>('/providers/capabilities')
    let provider = 'volcengine'
    try {
      const configs = await api<Array<{ provider: string; model?: string; isDefault?: boolean; isActive?: boolean }>>('/ai-configs?serviceType=video')
      const active = configs.find((c) => c.isDefault && c.isActive) || configs.find((c) => c.isActive) || configs[0]
      if (active?.provider) provider = active.provider
      if (active?.model) activeVideoModel.value = active.model
    } catch { /* 无配置时用默认 */ }
    activeVideoProvider.value = provider
    const list = caps.video[provider]?.resolutions || caps.video.volcengine?.resolutions || ['720p']
    resolutionOptions.value = [...list]
  } catch {
    resolutionOptions.value = ['480p', '720p']
  }
}

async function loadStylePresets() {
  try {
    stylePresets.value = await api('/style-presets')
  } catch {
    stylePresets.value = [{ name: '3D', value: '3d' }]
  }
}

async function init() {
  await loadProject(dramaId.value)
  await Promise.all([loadCapabilities(), loadStylePresets(), loadPriceHints()])
  if (!episodeId.value) {
    const epNum = Number(route.params.n)
    const ep = projectData.value.episodes.find((e) => e.episodeNumber === epNum)
    if (ep) episodeId.value = ep.id
  }
  await refresh()
  if (episode.value?.scriptContent) scriptContent.value = episode.value.scriptContent
  if (episode.value?.content) sourceContent.value = episode.value.content
  if (episode.value?.resolution) currentResolution.value = episode.value.resolution
  else if (resolutionOptions.value.length) currentResolution.value = resolutionOptions.value[0]
  currentStyle.value = projectData.value.drama?.style || '3d'
  if (storyboards.value[0]) activePanelTarget.value = storyboards.value[0].id
  await loadDramaCost()
}

async function loadDramaCost() {
  try {
    const sum = await api<{ totalEstimated: number; currency: string; recordCount: number }>(
      `/usage/summary?dramaId=${dramaId.value}`,
    )
    if (sum.recordCount > 0) {
      dramaCostLabel.value = `成本 ≈ ${sum.totalEstimated.toFixed(3)} ${sum.currency}`
    } else {
      dramaCostLabel.value = ''
    }
  } catch {
    dramaCostLabel.value = ''
  }
}

async function onResolutionChange(value: string) {
  currentResolution.value = value
  await updateEpisodeResolution(value)
}

async function onImageConfigChange(value: number | null) {
  await updateEpisodeModels({ imageConfigId: value })
}

async function onVideoConfigChange(value: number | null) {
  await updateEpisodeModels({ videoConfigId: value })
  if (value) {
    try {
      const configs = await api<Array<{ id: number; provider: string; model?: string }>>('/ai-configs?serviceType=video')
      const cfg = configs.find((c) => c.id === value)
      if (cfg?.provider) activeVideoProvider.value = cfg.provider
      if (cfg?.model) activeVideoModel.value = cfg.model
      const caps = await api<{ video: Record<string, { resolutions: string[] }> }>('/providers/capabilities')
      const list = caps.video[cfg?.provider || 'volcengine']?.resolutions
      if (list?.length) resolutionOptions.value = [...list]
    } catch { /* ignore */ }
  }
}

async function onStyleChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  currentStyle.value = value
  await api(`/dramas/${dramaId.value}`, {
    method: 'PUT',
    body: JSON.stringify({ style: value }),
  })
  await loadProject(dramaId.value)
}
async function saveDescription(id: number, description: string) {
  await patchStoryboard(id, { description })
}

async function saveDuration(id: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return
  await patchStoryboard(id, { duration })
}

async function saveImagePrompt(id: number, value: string) {
  await patchStoryboard(id, { imagePrompt: value })
}

async function saveVideoPrompt(id: number, value: string) {
  await patchStoryboard(id, { videoPrompt: value })
}

async function saveNarration(id: number, value: string) {
  await patchStoryboard(id, { narrationText: value })
}

async function generateNarration(sb: Storyboard) {
  ttsBusy.value = true
  try {
    const text = sb.narrationText || sb.description || ''
    await api('/tasks/tts', {
      method: 'POST',
      body: JSON.stringify({
        storyboardId: sb.id,
        text: text || undefined,
        dramaId: dramaId.value,
      }),
    })
    await refresh()
    await loadDramaCost()
    addPipelineLog('tts', `镜头 #${sb.storyboardNumber} 旁白已生成`)
  } catch (err) {
    addPipelineLog('tts', err instanceof Error ? err.message : '旁白生成失败')
  } finally {
    ttsBusy.value = false
  }
}

async function openHistory(entityType: string, entityId: number, field: string) {
  try {
    historyRows.value = await api(`/versions?entityType=${entityType}&entityId=${entityId}&field=${field}`)
    historyOpen.value = true
  } catch (err) {
    addPipelineLog('versions', err instanceof Error ? err.message : '加载历史失败')
  }
}

async function restoreVersion(id: number) {
  try {
    await api(`/versions/${id}/restore`, { method: 'POST' })
    historyOpen.value = false
    await refresh()
    addPipelineLog('versions', `已恢复版本 #${id}`)
  } catch (err) {
    addPipelineLog('versions', err instanceof Error ? err.message : '恢复失败')
  }
}

async function exportJianying() {
  if (!episodeId.value) return
  jianyingBusy.value = true
  try {
    const res = await api<{ url: string }>(`/merge/jianying/${episodeId.value}`, {
      method: 'POST',
      body: JSON.stringify({ version: '6' }),
    })
    jianyingUrl.value = res.url
    addPipelineLog('export', `剪映草稿已生成: ${res.url}`)
  } catch (err) {
    addPipelineLog('export', err instanceof Error ? err.message : '剪映导出失败')
  } finally {
    jianyingBusy.value = false
  }
}

async function doRewrite() {
  await agent.rewriteScript(episodeId.value, sourceContent.value)
  await refresh()
  scriptContent.value = episode.value?.scriptContent || ''
  addPipelineLog('rewrite', '剧本改写完成。下一步：提取角色与场景，再拆解分镜。')
}

async function doGenerateFromBrief() {
  const brief = sourceContent.value.trim()
  if (!brief) {
    addPipelineLog('rewrite', '请先粘贴创意大纲')
    return
  }
  await agent.generateScript(episodeId.value, brief)
  await refresh()
  scriptContent.value = episode.value?.scriptContent || ''
  addPipelineLog('rewrite', '已从大纲生成剧本。下一步：提取角色与场景，再拆解分镜。')
}

async function toggleLock(sb: Storyboard) {
  await api(`/storyboards/${sb.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ locked: !sb.locked }),
  })
  await refresh()
  addPipelineLog('lock', `镜头 #${sb.storyboardNumber} 已${sb.locked ? '解锁' : '锁定'}`)
}

async function doExtract() {
  if (scriptContent.value) {
    await api(`/episodes/${episodeId.value}`, {
      method: 'PUT',
      body: JSON.stringify({ scriptContent: scriptContent.value }),
    })
  }
  await agent.extract(episodeId.value, dramaId.value, scriptContent.value)
  await loadProject(dramaId.value)
  addPipelineLog('extract', '元素提取完成。下一步：拆解分镜，建议先出 2～4 镜样片确认画风。')
}

async function doStoryboard() {
  await agent.storyboard(episodeId.value, scriptContent.value)
  await refresh()
  addPipelineLog(
    'storyboard',
    `分镜拆解完成，共 ${storyboards.value.length} 个镜头。建议先用「样片」生成前几镜，确认后再批量。`,
  )
}

async function genAllPrompts() {
  const ids = storyboards.value.map((s) => s.id)
  if (!ids.length) return
  await generatePrompts('storyboard', ids)
  addPipelineLog('prompt', '批量提示词生成完成')
}

function buildImageItems(boards: Storyboard[], frameType: 'first' | 'last' = 'first') {
  return boards
    .filter((s) => !s.locked && (s.imagePrompt || s.description))
    .map((s) => ({
      type: 'storyboard',
      targetId: s.id,
      prompt: frameType === 'last'
        ? `${s.imagePrompt || s.description || ''}（镜头尾帧 / last frame）`
        : (s.imagePrompt || s.description || ''),
      configId: episode.value?.imageConfigId,
      frameType,
    }))
}

function openBatchImage() {
  const source = selectedIds.value.size
    ? storyboards.value.filter((s) => selectedIds.value.has(s.id) && !s.locked)
    : storyboards.value.filter((s) => !s.locked)
  const items = buildImageItems(source)
  if (!items.length) return
  prepareImageConfirm(items, false)
}

function openBatchImageSample() {
  const unlocked = storyboards.value.filter((s) => !s.locked)
  const source = selectedIds.value.size
    ? unlocked.filter((s) => selectedIds.value.has(s.id)).slice(0, 3)
    : unlocked.filter((s) => !s.firstFrameImage).slice(0, 3)
  const items = buildImageItems(source.length ? source : unlocked.slice(0, 3))
  if (!items.length) {
    addPipelineLog('image', '没有可生成首帧的镜头（已排除锁定）')
    return
  }
  prepareImageConfirm(items.slice(0, 3), true)
}

async function confirmBatchImage() {
  showImageConfirm.value = false
  const items = pendingImageItems.value
  const isSample = pendingBatchIsSample.value
  if (!items.length) return
  await batchGenerateImages(items)
  await fetchTasks(dramaId.value)
  if (isSample && items.length <= 3) markSampleDone()
  addPipelineLog('image', `已提交 ${items.length} 个生图任务${isSample ? '（样片）' : ''}`)
  pendingImageItems.value = []
  pendingBatchIsSample.value = false
  batchImageWarning.value = ''
}

function buildVideoItems(boards: Storyboard[]): VideoBatchItem[] {
  return boards
    .filter((s) => !s.locked && (s.videoPrompt || s.imagePrompt || s.description))
    .map((s) => ({
      storyboardId: s.id,
      prompt: s.videoPrompt || s.imagePrompt || s.description || '',
      firstFrameUrl: s.firstFrameImage,
      lastFrameUrl: s.lastFrameImage,
      referenceImages: parseRefImages(s.referenceImages),
      duration: s.duration || 5,
      resolution: currentResolution.value,
      configId: episode.value?.videoConfigId,
    }))
}

function pickVideoSourceBoards(limit?: number) {
  const source = selectedIds.value.size
    ? storyboards.value.filter((s) => selectedIds.value.has(s.id) && !s.locked)
    : storyboards.value.filter((s) => !s.locked)
  const filtered = source.filter((s) => {
    const st = s.artifactStatus || (s.videoUrl ? 'stale' : 'missing')
    if (st === 'missing') return true
    if (includeStaleInBatch.value && st === 'stale') return true
    return false
  })
  if (limit != null) {
    if (selectedIds.value.size) return filtered.slice(0, limit)
    return filtered.slice(0, limit)
  }
  return filtered
}

function openBatchVideo() {
  const filtered = pickVideoSourceBoards()
  const items = buildVideoItems(filtered)
  if (!items.length) {
    addPipelineLog('video', includeStaleInBatch.value ? '没有缺失或过期的镜头可生成' : '没有缺失视频的镜头（可勾选「含过期」）')
    return
  }
  prepareVideoConfirm(items, false)
}

function openBatchVideoSample() {
  const unlocked = storyboards.value.filter((s) => !s.locked)
  const filtered = pickVideoSourceBoards(3)
  const fallback = filtered.length
    ? filtered
    : unlocked.slice(0, 3)
  const items = buildVideoItems(fallback).slice(0, 3)
  if (!items.length) {
    addPipelineLog('video', '没有可生成视频的镜头（已排除锁定）')
    return
  }
  prepareVideoConfirm(items, true)
}

async function confirmBatchVideo() {
  showVideoConfirm.value = false
  const items = pendingVideoItems.value
  const isSample = pendingBatchIsSample.value
  if (!items.length) return
  await batchGenerateVideos(items, { resolution: currentResolution.value })
  await fetchTasks(dramaId.value)
  if (isSample && items.length <= 3) markSampleDone()
  addPipelineLog('video', `已提交 ${items.length} 个视频任务${isSample ? '（样片）' : ''}`)
  pendingVideoItems.value = []
  pendingBatchIsSample.value = false
  batchWarning.value = ''
}

async function regenImage(sb: Storyboard) {
  if (sb.locked) {
    addPipelineLog('image', '分镜已锁定，无法生成')
    return
  }
  const prompt = sb.imagePrompt || sb.description
  if (!prompt) return
  await batchGenerateImages([{
    type: 'storyboard',
    targetId: sb.id,
    prompt,
    configId: episode.value?.imageConfigId,
    frameType: 'first',
  }])
  await fetchTasks(dramaId.value)
  addPipelineLog('image', `已提交镜 #${sb.storyboardNumber} 首帧任务`)
}

async function regenLastFrame(sb: Storyboard) {
  if (sb.locked) {
    addPipelineLog('image', '分镜已锁定，无法生成')
    return
  }
  const prompt = sb.imagePrompt || sb.description
  if (!prompt) return
  await batchGenerateImages([{
    type: 'storyboard',
    targetId: sb.id,
    prompt: `${prompt}（镜头尾帧 / last frame）`,
    configId: episode.value?.imageConfigId,
    frameType: 'last',
  }])
  await fetchTasks(dramaId.value)
  addPipelineLog('image', `已提交镜 #${sb.storyboardNumber} 尾帧任务`)
}

function openBatchLastFrameSample() {
  const unlocked = storyboards.value.filter((s) => !s.locked)
  const source = selectedIds.value.size
    ? unlocked.filter((s) => selectedIds.value.has(s.id)).slice(0, 3)
    : unlocked.filter((s) => !s.lastFrameImage).slice(0, 3)
  const boards = source.length ? source : unlocked.slice(0, 3)
  const items = boards
    .filter((s) => s.imagePrompt || s.description)
    .map((s) => ({
      type: 'storyboard',
      targetId: s.id,
      prompt: `${s.imagePrompt || s.description || ''}（镜头尾帧 / last frame）`,
      configId: episode.value?.imageConfigId,
      frameType: 'last' as const,
    }))
  if (!items.length) {
    addPipelineLog('image', '没有可生成尾帧的镜头（已排除锁定）')
    return
  }
  prepareImageConfirm(items.slice(0, 3), true)
}

const PRODUCE_STEPS = [
  'script', 'extract', 'await_confirm', 'confirm', 'storyboard', 'prompts',
  'sample_images', 'sample_last_frames', 'sample_videos', 'merge', 'done',
] as const

function nextProduceStep(step: string | undefined | null): string {
  if (!step || step === 'await_confirm') return 'confirm'
  const idx = PRODUCE_STEPS.indexOf(step as typeof PRODUCE_STEPS[number])
  if (idx < 0) return 'script'
  if (idx >= PRODUCE_STEPS.length - 1) return 'done'
  return PRODUCE_STEPS[idx + 1]
}

async function streamProduce(body: Record<string, unknown>) {
  produceBusy.value = true
  clearPipelineLogs()
  try {
    for await (const event of streamApi('/agent/produce', body)) {
      addPipelineLog(event.step, event.message)
      if (event.step === 'await_confirm') {
        addPipelineLog('await_confirm', '请到角色/场景/道具页确认后，点击「从检查点继续」')
      }
    }
  } finally {
    produceBusy.value = false
  }
  await refresh()
  await loadProject(dramaId.value)
  scriptContent.value = episode.value?.scriptContent || scriptContent.value
}

async function runProduceSample() {
  await streamProduce({
    episodeId: episodeId.value,
    dramaId: dramaId.value,
    content: sourceContent.value || scriptContent.value,
    mode: 'rewrite',
    sampleOnly: true,
    sampleCount: 3,
    autoConfirmAssets: false,
    includeMerge: false,
    generateLastFrame: projectData.value.drama?.generationMode === 'first_last_frame',
  })
}

async function resumeProduce() {
  try {
    const cp = await api<{ step: string; episodeId: number } | null>(
      `/agent/produce-checkpoint?episodeId=${episodeId.value}`,
    )
    if (!cp?.step) {
      addPipelineLog('produce', '没有检查点，将从头开始一键生产')
      await runProduceSample()
      return
    }
    if (cp.step === 'done') {
      addPipelineLog('produce', '检查点已完成，无需继续')
      return
    }
    const resumeFrom = nextProduceStep(cp.step)
    addPipelineLog('produce', `从检查点继续：${cp.step} → ${resumeFrom}`)
    await streamProduce({
      episodeId: episodeId.value,
      dramaId: dramaId.value,
      content: sourceContent.value || scriptContent.value,
      resumeFrom,
      sampleOnly: true,
      sampleCount: 3,
      autoConfirmAssets: resumeFrom === 'confirm',
      includeMerge: false,
      generateLastFrame: projectData.value.drama?.generationMode === 'first_last_frame',
    })
  } catch (err) {
    addPipelineLog('produce', err instanceof Error ? err.message : '继续失败')
  }
}

async function regenVideo(sb: Storyboard) {
  if (sb.locked) {
    addPipelineLog('video', '分镜已锁定，无法生成')
    return
  }
  const items = buildVideoItems([sb])
  if (!items.length) return
  pendingVideoItems.value = items
  showVideoConfirm.value = true
}

async function retryBoardTask(storyboardId: number) {
  const t = failedTaskFor(storyboardId)
  if (!t) return
  await retryTask(t.id)
  await fetchTasks(dramaId.value)
  addPipelineLog('retry', `已重试任务 #${t.id}`)
}

async function uploadFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/v1/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (json.code !== 0) {
          addPipelineLog('upload', json.message || '上传失败')
          resolve(null)
          return
        }
        resolve(json.data.url as string)
      } catch (err) {
        addPipelineLog('upload', err instanceof Error ? err.message : '上传失败')
        resolve(null)
      }
    }
    input.click()
  })
}

async function uploadBoardImage(field: 'firstFrameImage' | 'lastFrameImage') {
  if (!activeBoard.value) return
  const url = await uploadFile()
  if (!url) return
  await patchStoryboard(activeBoard.value.id, { [field]: url } as Partial<Storyboard>)
  addPipelineLog('upload', field === 'firstFrameImage' ? '首帧图已更新' : '尾帧图已更新')
}

async function uploadReferenceImage() {
  if (!activeBoard.value) return
  const url = await uploadFile()
  if (!url) return
  const next = [...parseRefImages(activeBoard.value.referenceImages), url]
  await patchStoryboard(activeBoard.value.id, { referenceImages: JSON.stringify(next) } as Partial<Storyboard>)
  addPipelineLog('upload', '参考图已添加')
}

async function clearLastFrame() {
  if (!activeBoard.value) return
  await patchStoryboard(activeBoard.value.id, { lastFrameImage: null } as any)
}

async function removeReferenceImage(idx: number) {
  if (!activeBoard.value) return
  const next = parseRefImages(activeBoard.value.referenceImages).filter((_, i) => i !== idx)
  await patchStoryboard(activeBoard.value.id, {
    referenceImages: next.length ? JSON.stringify(next) : null,
  } as any)
}

async function retryFailedTasks() {
  const list = failedTasks.value
  if (!list.length) return
  for (const t of list) {
    try {
      await retryTask(t.id)
    } catch (err) {
      console.error(err)
    }
  }
  await fetchTasks(dramaId.value)
  addPipelineLog('retry', `已重试 ${list.length} 个失败任务`)
}

async function doCompose(id: number) {
  try {
    await composeStoryboard(id)
    await refresh()
    addPipelineLog('compose', `镜头合成完成`)
  } catch (err) {
    addPipelineLog('compose', err instanceof Error ? err.message : '合成失败')
  }
}

function doMerge() {
  mergeConfirmMode.value = 'all'
  mergeConfirmOpen.value = true
}

function doMergeSelected() {
  if (!selectedIds.value.size) return
  const missing = storyboards.value
    .filter((s) => selectedIds.value.has(s.id) && !(s.composedVideoUrl || s.videoUrl))
    .map((s) => s.storyboardNumber)
  if (missing.length) {
    addPipelineLog('export', `以下镜头缺少视频，无法导出：${missing.map((n) => `#${n}`).join('、')}`)
    return
  }
  mergeConfirmMode.value = 'selected'
  mergeConfirmOpen.value = true
}

async function confirmMerge() {
  mergeConfirmOpen.value = false
  try {
    if (mergeConfirmMode.value === 'selected') {
      const res = await mergeEpisode([...selectedIds.value]) as { url: string }
      addPipelineLog('export', `选中导出完成: ${res.url}`)
    } else {
      const res = await mergeEpisode() as { url: string }
      addPipelineLog('export', `导出完成: ${res.url}`)
    }
    await refresh()
  } catch (err) {
    addPipelineLog('export', err instanceof Error ? err.message : '导出失败')
  }
}
async function runPipeline() {
  clearPipelineLogs()
  for await (const event of streamApi('/agent/pipeline', {
    episodeId: episodeId.value,
    dramaId: dramaId.value,
    content: sourceContent.value,
  })) {
    addPipelineLog(event.step, event.message)
  }
  await refresh()
  await loadProject(dramaId.value)
  scriptContent.value = episode.value?.scriptContent || ''
}

function onSelectEpisode(ep: Episode) {
  router.push(`/app/projects/${dramaId.value}/episodes/${ep.episodeNumber}?episodeId=${ep.id}`)
}

async function addEpisode() {
  const num = projectData.value.episodes.length + 1
  await api('/episodes', {
    method: 'POST',
    body: JSON.stringify({ dramaId: dramaId.value, episodeNumber: num, title: `第${num}集`, resolution: currentResolution.value }),
  })
  await loadProject(dramaId.value)
}

onMounted(init)
let pollTimer: ReturnType<typeof setInterval>
onMounted(() => {
  pollTimer = setInterval(async () => {
    await refresh()
    await fetchTasks(dramaId.value)
  }, 10000)
})
onUnmounted(() => clearInterval(pollTimer))
</script>

<style scoped>
.workspace-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.workspace {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 14px;
  flex: 1;
  min-height: 0;
}
.workspace-main {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(420px, 1.4fr);
  gap: 14px;
  min-height: 0;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  min-height: 0;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.panel-header h2 { font-size: 14px; font-weight: 600; }
.count { color: var(--color-text-3); font-weight: 400; }
.sub-heading { font-size: 13px; color: var(--color-text-3); margin-top: 4px; }
.btn-row { display: flex; flex-wrap: wrap; gap: 6px; }
.style-select {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-3);
}
.style-select select {
  min-width: 100px;
  padding: 4px 8px;
  font-size: 12px;
}
.fail-badge { margin-left: 4px; }
.danger-btn { color: var(--color-danger, #e85d5d); }
.upload-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tiny-block {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  font-size: 11px;
}
.ref-preview, .ref-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ref-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ref-item {
  position: relative;
  display: inline-flex;
}
.mini-thumb {
  width: 48px;
  height: 36px;
  object-fit: cover;
  border-radius: 4px;
}
.script-area { flex: 1; min-height: 140px; }
.fail-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-danger, #e85d5d);
  background: oklch(0.28 0.04 25 / 0.35);
  border: 1px solid oklch(0.45 0.08 25 / 0.4);
  border-radius: var(--radius);
}
.selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-3);
}
.check-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.stale-hint {
  flex: 1 1 220px;
  font-size: 11px;
  color: var(--color-text-3);
  line-height: 1.4;
}
.sel-count { margin-right: auto; }
.cost-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-hairline);
  color: var(--color-text-3);
}
.badge.warn {
  background: oklch(0.35 0.06 75 / 0.5);
  color: oklch(0.85 0.08 75);
}
.side-audio { width: 100%; margin-top: 4px; }
.history-modal { min-width: min(480px, 92vw); max-height: 70vh; overflow: auto; }
.history-list { list-style: none; padding: 0; margin: 12px 0; display: flex; flex-direction: column; gap: 8px; }
.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.history-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.modal-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
.table-wrap { flex: 1; overflow: auto; }
.boards-table { width: 100%; }
.boards-table th, .boards-table td {
  vertical-align: middle;
  font-size: 12px;
}
.boards-table tr.selected { background: var(--color-accent-soft); }
.boards-table tr.active-row {
  outline: 1px solid var(--color-accent);
  outline-offset: -1px;
  background: oklch(0.28 0.02 265 / 0.45);
}
.col-check { width: 28px; }
.col-num { width: 48px; }
.lock-mark {
  display: inline-block;
  margin-right: 2px;
  padding: 0 3px;
  font-size: 10px;
  line-height: 1.4;
  border: 1px solid var(--color-hairline);
  color: var(--color-text-3);
  border-radius: 2px;
}
.col-dur { width: 64px; }
.col-actions { width: 128px; white-space: nowrap; }
.desc-cell { min-width: 120px; }
.inline-input, .dur-input {
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--color-text);
}
.inline-input:focus, .dur-input:focus {
  border-color: var(--color-hairline-strong);
  background: var(--color-surface);
  outline: none;
}
.dur-input { width: 52px; text-align: center; }
.preview-thumb {
  width: 48px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}
.preview-link { display: inline-flex; align-items: center; }
.tiny {
  padding: 2px 6px;
  font-size: 11px;
  margin-right: 2px;
}
.side-panels {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  min-height: 0;
}
.side-card {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.side-card h3 { font-size: 13px; font-weight: 600; }
.field-label {
  font-size: 11px;
  color: var(--color-text-3);
}
.prompt-area {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  font-size: 12px;
  line-height: 1.45;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--color-hairline);
  background: var(--color-surface);
  color: var(--color-text);
}
.thumb-btn {
  padding: 0;
  border: none;
  background: transparent;
  cursor: zoom-in;
  border-radius: 6px;
  overflow: hidden;
}
.side-preview {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 6px;
  background: var(--color-surface);
  display: block;
}
.side-video {
  width: 100%;
  border-radius: 6px;
  background: #000;
}
.block-btn { width: 100%; }
.muted { color: var(--color-text-3); font-size: 12px; }
.export-link { font-size: 12px; }
.ghost {
  background: transparent;
  border: 1px solid var(--color-hairline);
}
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: oklch(0.12 0.01 265 / 0.82);
  cursor: zoom-out;
}
.lightbox-img {
  max-width: min(96vw, 1200px);
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 12px 40px oklch(0 0 0 / 0.45);
  cursor: default;
}
@media (max-width: 1200px) {
  .workspace { grid-template-columns: 1fr; }
  .side-panels { display: grid; grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .workspace-main { grid-template-columns: 1fr; }
}
</style>
