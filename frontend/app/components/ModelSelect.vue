<template>
  <label class="model-select-wrap">
    <span v-if="label" class="model-label">{{ label }}</span>
    <select :value="selectValue" class="model-select" @change="onChange">
      <option value="">{{ placeholder }}</option>
      <option v-for="cfg in configs" :key="cfg.id" :value="String(cfg.id)">
        {{ formatOption(cfg) }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { api } from '../composables/useApi'

export type ModelServiceType = 'image' | 'video' | 'text'

interface AiConfigOption {
  id: number
  name: string
  model?: string | null
  provider?: string | null
}

const props = withDefaults(defineProps<{
  serviceType: ModelServiceType
  modelValue: number | string | null
  label?: string
  placeholder?: string
}>(), {
  placeholder: '选择模型',
})

const emit = defineEmits<{ 'update:modelValue': [v: number | null] }>()

const configs = ref<AiConfigOption[]>([])

const selectValue = computed(() =>
  props.modelValue == null || props.modelValue === '' ? '' : String(props.modelValue),
)

function formatOption(cfg: AiConfigOption) {
  return [cfg.name, cfg.model, cfg.provider].filter(Boolean).join(' · ')
}

function onChange(e: Event) {
  const raw = (e.target as HTMLSelectElement).value
  emit('update:modelValue', raw ? Number(raw) : null)
}

async function load() {
  try {
    configs.value = await api<AiConfigOption[]>(`/ai-configs?serviceType=${props.serviceType}`)
  } catch {
    configs.value = []
  }
}

onMounted(load)
watch(() => props.serviceType, load)
</script>

<style scoped>
.model-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-3);
}
.model-label { white-space: nowrap; }
.model-select {
  min-width: 140px;
  max-width: 220px;
  padding: 4px 8px;
  font-size: 12px;
}
</style>
