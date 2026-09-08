<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal batch-confirm">
      <h3>{{ displayTitle }}</h3>
      <div class="summary">
        <div class="row"><span>镜头数量</span><strong>{{ count }}</strong></div>
        <div v-if="showDuration" class="row"><span>总时长</span><strong>{{ totalDuration }} 秒</strong></div>
        <div class="row"><span>模型</span><strong>{{ model || defaultModelLabel }}</strong></div>
        <div v-if="showResolution" class="row"><span>分辨率</span><strong>{{ resolution || '默认' }}</strong></div>
        <div v-if="estimatedCost != null" class="row">
          <span>预估费用</span>
          <strong>≈ {{ estimatedCost.toFixed(2) }} CNY<span class="soft"> · 粗估，以供应商账单为准</span></strong>
        </div>
      </div>
      <div v-if="warning" class="warn-box">{{ warning }}</div>
      <p v-if="message" class="hint">{{ message }}</p>
      <div class="actions">
        <button @click="emit('cancel')">取消</button>
        <button class="primary" @click="emit('confirm')">确认提交</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  message?: string
  count: number
  totalDuration?: number
  model?: string
  resolution?: string
  mode?: 'video' | 'image'
  showDuration?: boolean
  showResolution?: boolean
  estimatedCost?: number | null
  warning?: string
}>(), {
  mode: 'video',
  totalDuration: 0,
  estimatedCost: null,
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const isImage = computed(() => props.mode === 'image')

const displayTitle = computed(() => {
  if (props.title) return props.title
  return isImage.value ? '确认批量生成首帧图' : '确认批量生成视频'
})

const defaultModelLabel = computed(() =>
  isImage.value ? '默认生图模型' : '默认视频模型',
)

const showDuration = computed(() =>
  props.showDuration ?? !isImage.value,
)

const showResolution = computed(() =>
  props.showResolution ?? !isImage.value,
)
</script>

<style scoped>
.batch-confirm { min-width: min(400px, 90vw); }
.summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0;
  padding: 12px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--color-text-2);
}
.row strong { color: var(--color-text); font-weight: 600; }
.hint { font-size: 12px; color: var(--color-text-3); margin-bottom: 8px; }
.soft { font-weight: 400; color: var(--color-text-3); font-size: 11px; margin-left: 4px; }
.warn-box {
  margin: 0 0 10px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-warning);
  background: oklch(0.78 0.14 75 / 0.12);
  border: 1px solid oklch(0.78 0.14 75 / 0.35);
  border-radius: var(--radius);
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
