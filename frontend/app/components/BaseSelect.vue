<template>
  <div class="select-wrap">
    <select :value="modelValue" @change="onChange">
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  options: Array<{ label: string; value: string }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.select-wrap select { width: 100%; }
</style>
