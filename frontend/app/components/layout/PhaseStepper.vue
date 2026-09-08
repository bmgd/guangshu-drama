<template>
  <nav class="phase-stepper" aria-label="工作流阶段">
    <div class="stepper-track">
      <div
        v-for="(phase, idx) in phases"
        :key="phase.key"
        class="stepper-item"
      >
        <div
          class="step-pill"
          :class="stepClass(phase.key, idx)"
          :aria-current="isActive(phase.key) ? 'step' : undefined"
        >
          <span class="step-num">{{ idx + 1 }}</span>
          <span class="step-label">{{ phase.label }}</span>
        </div>
        <div
          v-if="idx < phases.length - 1"
          class="step-connector"
          :class="{ done: isDone(phase.key, idx) }"
        />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{
  currentPhase?: string
  completedPhases?: string[]
}>()

const phases = [
  { key: 'script', label: '剧本' },
  { key: 'extract', label: '提取' },
  { key: 'storyboard', label: '分镜' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '视频' },
  { key: 'export', label: '导出' },
]

const completedSet = computed(() => new Set(props.completedPhases || []))

const currentIdx = computed(() => {
  if (!props.currentPhase) return -1
  return phases.findIndex((p) => p.key === props.currentPhase)
})

function isActive(key: string) {
  return props.currentPhase === key
}

function isDone(key: string, idx: number) {
  if (completedSet.value.has(key)) return true
  if (currentIdx.value > idx) return true
  return false
}

function stepClass(key: string, idx: number) {
  return {
    active: isActive(key),
    done: isDone(key, idx) && !isActive(key),
  }
}
</script>

<style scoped>
.phase-stepper { display: flex; justify-content: center; }
.stepper-track {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 3px;
  border-radius: 999px;
  background: oklch(0.17 0.010 265 / 0.6);
  border: 1px solid var(--color-hairline);
  box-shadow: inset 0 1px 2px oklch(0 0 0 / 0.25);
}
.stepper-item { display: flex; align-items: center; }
.step-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-3);
  transition: all 0.15s;
}
.step-pill.active {
  color: var(--color-text);
  background: linear-gradient(180deg, oklch(0.30 0.012 265), oklch(0.26 0.012 265));
  box-shadow: 0 0 0 1px var(--color-hairline-strong), 0 1px 2px oklch(0 0 0 / 0.3);
}
.step-num {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  background: oklch(0.32 0.012 265);
  color: var(--color-text-3);
}
.step-pill.active .step-num {
  background: var(--color-accent);
  color: oklch(0.12 0 0);
  box-shadow: 0 0 8px -1px var(--color-accent-glow);
}
.step-pill.done .step-num {
  background: var(--color-success);
  color: oklch(0.12 0 0);
}
.step-label { white-space: nowrap; }
.step-connector {
  width: 6px;
  height: 1px;
  margin: 0 2px;
  background: var(--color-hairline-soft);
}
.step-connector.done { background: var(--color-accent-soft); }
@media (max-width: 900px) {
  .step-label { display: none; }
  .step-pill { padding: 4px 8px; }
}
</style>
