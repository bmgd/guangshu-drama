<template>
  <div v-if="open" class="modal-backdrop" @click.self="cancel">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button @click="cancel">取消</button>
        <button class="primary" @click="confirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; title?: string; message?: string }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
function confirm() { emit('confirm') }
function cancel() { emit('cancel') }
</script>
