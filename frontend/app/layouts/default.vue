<template>
  <div class="app-shell">
    <div v-if="!configReady" class="banner">
      <span>尚未配置 AI 模型服务，部分功能不可用</span>
      <NuxtLink to="/app/settings" class="btn primary">前往设置</NuxtLink>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
const { configReady } = useAppStore()

onMounted(async () => {
  try {
    const res = await $fetch<{ data: { configured: boolean } }>('/api/v1/ai-configs/status')
    configReady.value = res.data.configured
  } catch {
    configReady.value = false
  }
})
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--color-bg);
}
</style>
