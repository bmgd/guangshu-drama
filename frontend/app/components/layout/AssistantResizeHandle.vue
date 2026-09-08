<template>
  <div
    class="resize-handle"
    :class="{ resizing }"
    @mousedown="onMouseDown"
    @dblclick="onDoubleClick"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  width: number
  isResizing?: boolean
}>()

const emit = defineEmits<{
  resizeStart: [e: MouseEvent]
  resizeDoubleClick: []
}>()

function onMouseDown(e: MouseEvent) {
  emit('resizeStart', e)
}

function onDoubleClick() {
  emit('resizeDoubleClick')
}
</script>

<style scoped>
.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
}
.resize-handle:hover, .resize-handle.resizing {
  background: var(--color-accent-soft);
}
</style>
