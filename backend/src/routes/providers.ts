import { Hono } from 'hono'
import { jsonOk } from '../utils/response.js'

export const providersRouter = new Hono()

const VIDEO_CAPABILITIES = {
  volcengine: {
    resolutions: ['480p', '720p'],
    ratios: ['16:9', '9:16', '1:1'],
    durations: [5, 10],
  },
  minimax: {
    resolutions: ['768P', '2K'],
    ratios: ['16:9', '9:16', '1:1', '21:9'],
    durations: [4, 5, 6, 8, 10],
  },
  aliyun: {
    resolutions: ['480P', '720P', '1080P'],
    ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', 'adaptive'],
    durations: [2, 3, 4, 5, 6, 8, 10],
  },
} as const

providersRouter.get('/capabilities', (c) => {
  return jsonOk(c, { video: VIDEO_CAPABILITIES })
})
