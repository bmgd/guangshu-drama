<template>
  <div v-if="visible" class="coach-card" :class="tone">
    <div class="coach-body">
      <div class="coach-text">
        <h4 class="coach-title">{{ title }}</h4>
        <p class="coach-msg">{{ body }}</p>
      </div>
      <div class="coach-actions">
        <button v-if="primaryLabel" type="button" class="primary" @click="emit('primary')">
          {{ primaryLabel }}
        </button>
        <button v-if="secondaryLabel" type="button" class="ghost" @click="emit('secondary')">
          {{ secondaryLabel }}
        </button>
        <button type="button" class="ghost dismiss" title="不再提示" @click="onDismiss">收起</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  id: string
  title: string
  body: string
  primaryLabel?: string
  secondaryLabel?: string
  tone?: 'info' | 'success' | 'warning'
  force?: boolean
}>(), {
  tone: 'info',
  force: false,
})

const emit = defineEmits<{
  primary: []
  secondary: []
  dismiss: []
}>()

const storageKey = computed(() => `guangshu-coach-${props.id}`)

const dismissed = ref(false)

function readDismissed() {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(storageKey.value) === '1'
  } catch {
    return false
  }
}

const visible = computed(() => {
  if (props.force) return true
  return !dismissed.value
})

function onDismiss() {
  dismissed.value = true
  if (import.meta.client) {
    try {
      localStorage.setItem(storageKey.value, '1')
    } catch { /* ignore */ }
  }
  emit('dismiss')
}

onMounted(() => {
  dismissed.value = readDismissed()
})

watch(storageKey, () => {
  dismissed.value = readDismissed()
})
</script>

<style scoped>
.coach-card {
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius);
  background: var(--color-bg-card);
  padding: 12px 14px;
  margin-bottom: 12px;
}
.coach-card.info {
  border-left: 3px solid var(--color-accent);
}
.coach-card.success {
  border-left: 3px solid var(--color-success);
}
.coach-card.warning {
  border-left: 3px solid var(--color-warning);
}
.coach-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.coach-text { flex: 1; min-width: 200px; }
.coach-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.coach-msg {
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.55;
}
.coach-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.coach-actions .dismiss {
  font-size: 12px;
  color: var(--color-text-3);
}
</style>
