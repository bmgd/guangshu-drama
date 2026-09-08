export interface AiConfig {
  baseUrl: string
  apiKey: string
  model?: string | null
  endpoint?: string | null
  queryEndpoint?: string | null
  settings?: string | null
}

export interface ImageGenerateInput {
  prompt: string
  config: AiConfig
  size?: string
  referenceImages?: string[]
}

export interface ImageGenerateResult {
  buffer: Buffer
  mimeType: string
}

export interface VideoSubmitInput {
  prompt: string
  config: AiConfig
  firstFrameUrl?: string
  lastFrameUrl?: string
  duration?: number
  resolution?: string
  ratio?: string
  seed?: number
  audio?: boolean
  watermark?: boolean
  promptExtend?: boolean
  referenceImages?: string[]
}

export interface VideoSubmitResult {
  taskId: string
}

export interface VideoQueryResult {
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

export interface ImageAdapter {
  generate(input: ImageGenerateInput): Promise<ImageGenerateResult>
}

export interface VideoAdapter {
  submit(input: VideoSubmitInput): Promise<VideoSubmitResult>
  query(taskId: string, config: AiConfig): Promise<VideoQueryResult>
}

export interface AudioSynthesizeInput {
  text: string
  config: AiConfig
  voice?: string
}

export interface AudioSynthesizeResult {
  buffer: Buffer
  mimeType: string
}

export interface AudioAdapter {
  synthesize(input: AudioSynthesizeInput): Promise<AudioSynthesizeResult>
}
