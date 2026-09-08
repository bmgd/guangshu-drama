import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineNuxtConfig({
  srcDir: 'app',
  ssr: false,
  devtools: { enabled: false },
  hooks: {
    'pages:extend'(pages) {
      // Legacy route redirects
      pages.push(
        { name: 'legacy-drama', path: '/drama/:id', redirect: (to: any) => `/app/projects/${to.params.id}` },
        { name: 'legacy-episode', path: '/drama/:id/episode/:episodeNumber', redirect: (to: any) => `/app/projects/${to.params.id}/episodes/${to.params.episodeNumber}` },
        { name: 'legacy-settings', path: '/settings', redirect: '/app/settings' },
      )
    },
  },
  app: {
    head: {
      title: '光束短剧',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  vite: {
    server: {
      proxy: {
        '/api': { target: 'http://localhost:5679', changeOrigin: true },
        '/static': { target: 'http://localhost:5679', changeOrigin: true },
      },
    },
  },
  compatibilityDate: '2025-05-15',
})
