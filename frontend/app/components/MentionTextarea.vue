<template>
  <div class="mention-wrap">
    <textarea
      ref="taRef"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      @input="onInput"
      @keydown="onKeydown"
    />
    <div v-if="suggestions.length" class="suggestions" role="listbox">
      <button
        v-for="(item, i) in suggestions"
        :key="`${item.type}-${item.id}`"
        type="button"
        class="suggestion-item"
        :class="{ active: i === activeIndex }"
        @click="insertMention(item)"
        @mouseenter="activeIndex = i"
      >
        <span class="sug-type">{{ typeLabel(item.type) }}</span>
        <span>@{{ item.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type MentionItem = {
  id: number | string
  name: string
  type?: string
}

const props = defineProps<{
  modelValue: string
  /** @deprecated use mentions objects */
  mentions?: string[] | MentionItem[]
  rows?: number
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const taRef = ref<HTMLTextAreaElement>()
const activeIndex = ref(0)

const mentionItems = computed<MentionItem[]>(() => {
  if (!props.mentions?.length) return []
  return props.mentions.map((m) =>
    typeof m === 'string' ? { id: m, name: m, type: 'tag' } : m,
  )
})

const query = computed(() => {
  const match = props.modelValue.match(/@([^\s@]*)$/)
  return match ? match[1] : null
})

const suggestions = computed(() => {
  if (query.value == null || !mentionItems.value.length) return []
  const q = query.value.toLowerCase()
  return mentionItems.value
    .filter((m) => m.name.toLowerCase().includes(q))
    .slice(0, 8)
})

watch(suggestions, () => { activeIndex.value = 0 })

function typeLabel(type?: string) {
  const map: Record<string, string> = {
    character: '角色',
    scene: '场景',
    prop: '道具',
  }
  return map[type || ''] || type || '提及'
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function onKeydown(e: KeyboardEvent) {
  if (!suggestions.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    const item = suggestions.value[activeIndex.value]
    if (item) insertMention(item)
  } else if (e.key === 'Escape') {
    emit('update:modelValue', props.modelValue.replace(/@[^\s@]*$/, ''))
  }
}

function insertMention(item: MentionItem) {
  const val = props.modelValue.replace(/@[^\s@]*$/, `@${item.name} `)
  emit('update:modelValue', val)
  nextTick(() => taRef.value?.focus())
}
</script>

<style scoped>
.mention-wrap { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; }
.mention-wrap textarea { flex: 1; min-height: 140px; width: 100%; }
.suggestions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  margin-bottom: 4px;
  max-height: 180px;
  overflow-y: auto;
  background: var(--color-bg-card);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 8px;
  box-shadow: var(--shadow-panel);
  z-index: 20;
  display: flex;
  flex-direction: column;
  padding: 4px;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--color-text-2);
  font-size: 12px;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
}
.suggestion-item:hover,
.suggestion-item.active {
  background: var(--color-surface-hover);
  color: var(--color-text);
}
.sug-type {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--color-hairline);
  color: var(--color-text-3);
}
</style>
