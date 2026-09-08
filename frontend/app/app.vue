<template>
  <NuxtLayout>
    <NuxtPage />
    <Toaster position="top-center" theme="dark" rich-colors />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import './assets/studio.css'
</script>
