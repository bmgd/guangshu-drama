import { pgTable, text, integer, boolean, serial, primaryKey, index } from 'drizzle-orm/pg-core'

export const dramas = pgTable('dramas', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  genre: text('genre'),
  style: text('style').default('3d'),
  aspectRatio: text('aspect_ratio').default('16:9'),
  totalEpisodes: integer('total_episodes').default(1),
  totalDuration: integer('total_duration').default(0),
  status: text('status').notNull().default('draft'),
  /** 内容来源：novel | script | product */
  contentSource: text('content_source').default('novel'),
  /** 创作类型：narration | drama | ad */
  creationType: text('creation_type').default('drama'),
  /** 生成模式：storyboard | reference */
  generationMode: text('generation_mode').default('storyboard'),
  thumbnail: text('thumbnail'),
  tags: text('tags'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const episodes = pgTable('episodes', {
  id: serial('id').primaryKey(),
  dramaId: integer('drama_id').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  scriptContent: text('script_content'),
  description: text('description'),
  duration: integer('duration').default(0),
  status: text('status').default('draft'),
  videoUrl: text('video_url'),
  thumbnail: text('thumbnail'),
  imageConfigId: integer('image_config_id'),
  videoConfigId: integer('video_config_id'),
  resolution: text('resolution').default('720p'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  dramaId: integer('drama_id').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  description: text('description'),
  appearance: text('appearance'),
  styling: text('styling'),
  finalPrompt: text('final_prompt'),
  personality: text('personality'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  seedValue: text('seed_value'),
  sortOrder: integer('sort_order'),
  localPath: text('local_path'),
  /** 资产确认：pending_review | confirmed */
  reviewStatus: text('review_status').default('pending_review'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const scenes = pgTable('scenes', {
  id: serial('id').primaryKey(),
  dramaId: integer('drama_id').notNull(),
  episodeId: integer('episode_id'),
  location: text('location').notNull(),
  time: text('time').notNull(),
  prompt: text('prompt').notNull(),
  lighting: text('lighting'),
  finalPrompt: text('final_prompt'),
  storyboardCount: integer('storyboard_count').default(1),
  imageUrl: text('image_url'),
  status: text('status').default('pending'),
  localPath: text('local_path'),
  reviewStatus: text('review_status').default('pending_review'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const props = pgTable('props', {
  id: serial('id').primaryKey(),
  dramaId: integer('drama_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  description: text('description'),
  prompt: text('prompt'),
  finalPrompt: text('final_prompt'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  localPath: text('local_path'),
  reviewStatus: text('review_status').default('pending_review'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const storyboards = pgTable('storyboards', {
  id: serial('id').primaryKey(),
  episodeId: integer('episode_id').notNull(),
  sceneId: integer('scene_id'),
  storyboardNumber: integer('storyboard_number').notNull(),
  title: text('title'),
  location: text('location'),
  time: text('time'),
  shotType: text('shot_type'),
  angle: text('angle'),
  movement: text('movement'),
  result: text('result'),
  atmosphere: text('atmosphere'),
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),
  bgmPrompt: text('bgm_prompt'),
  soundEffect: text('sound_effect'),
  description: text('description'),
  duration: integer('duration').default(0),
  composedImage: text('composed_image'),
  firstFrameImage: text('first_frame_image'),
  lastFrameImage: text('last_frame_image'),
  referenceImages: text('reference_images'),
  videoUrl: text('video_url'),
  subtitleUrl: text('subtitle_url'),
  composedVideoUrl: text('composed_video_url'),
  /** 旁白文案覆盖（缺省用 description） */
  narrationText: text('narration_text'),
  /** TTS 旁白音频 URL */
  audioUrl: text('audio_url'),
  /** 成功生图/生视频后写入的输入指纹，用于判断 artifact 是否过期 */
  inputFingerprint: text('input_fingerprint'),
  /** 锁定后禁止覆盖媒体与再生成 */
  locked: boolean('locked').default(false),
  status: text('status').default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const episodeCharacters = pgTable('episode_characters', {
  id: serial('id').primaryKey(),
  episodeId: integer('episode_id').notNull(),
  characterId: integer('character_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_episode_characters_episode').on(t.episodeId),
  index('idx_episode_characters_character').on(t.characterId),
])

export const episodeScenes = pgTable('episode_scenes', {
  id: serial('id').primaryKey(),
  episodeId: integer('episode_id').notNull(),
  sceneId: integer('scene_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_episode_scenes_episode').on(t.episodeId),
  index('idx_episode_scenes_scene').on(t.sceneId),
])

export const episodeProps = pgTable('episode_props', {
  id: serial('id').primaryKey(),
  episodeId: integer('episode_id').notNull(),
  propId: integer('prop_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_episode_props_episode').on(t.episodeId),
  index('idx_episode_props_prop').on(t.propId),
])

export const storyboardCharacters = pgTable('storyboard_characters', {
  storyboardId: integer('storyboard_id').notNull(),
  characterId: integer('character_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.storyboardId, t.characterId] }),
  index('idx_sb_characters_character').on(t.characterId),
])

export const storyboardProps = pgTable('storyboard_props', {
  storyboardId: integer('storyboard_id').notNull(),
  propId: integer('prop_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.storyboardId, t.propId] }),
  index('idx_sb_props_prop').on(t.propId),
])

export const aiServiceConfigs = pgTable('ai_service_configs', {
  id: serial('id').primaryKey(),
  serviceType: text('service_type').notNull(),
  provider: text('provider'),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model'),
  endpoint: text('endpoint'),
  queryEndpoint: text('query_endpoint'),
  priority: integer('priority').default(0),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  settings: text('settings'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const aiServiceProviders = pgTable('ai_service_providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  serviceType: text('service_type').notNull(),
  provider: text('provider').notNull(),
  defaultUrl: text('default_url'),
  presetModels: text('preset_models'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const stylePresets = pgTable('style_presets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  value: text('value').notNull().unique(),
  prompt: text('prompt').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sysTasks = pgTable('sys_task', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  storyboardId: integer('storyboard_id'),
  dramaId: integer('drama_id'),
  sceneId: integer('scene_id'),
  characterId: integer('character_id'),
  propId: integer('prop_id'),
  provider: text('provider'),
  prompt: text('prompt'),
  model: text('model'),
  params: text('params'),
  taskId: text('task_id'),
  resultUrl: text('result_url'),
  localPath: text('local_path'),
  status: text('status').default('processing'),
  errorMsg: text('error_msg'),
  idempotencyKey: text('idempotency_key'),
  progress: integer('progress').default(0),
  configSnapshot: text('config_snapshot'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
}, (t) => [
  index('idx_sys_task_type').on(t.type),
  index('idx_sys_task_drama').on(t.dramaId),
  index('idx_sys_task_storyboard').on(t.storyboardId),
  index('idx_sys_task_idempotency').on(t.idempotencyKey),
])

export const taskEvents = pgTable('task_events', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull(),
  event: text('event').notNull(),
  message: text('message'),
  progress: integer('progress'),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_task_events_task').on(t.taskId),
])

export const videoMerges = pgTable('video_merges', {
  id: serial('id').primaryKey(),
  episodeId: integer('episode_id'),
  dramaId: integer('drama_id'),
  title: text('title'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  status: text('status').default('pending'),
  scenes: text('scenes'),
  mergedUrl: text('merged_url'),
  duration: integer('duration'),
  taskId: text('task_id'),
  errorMsg: text('error_msg'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
  deletedAt: text('deleted_at'),
})

export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  dramaId: integer('drama_id'),
  episodeId: integer('episode_id'),
  storyboardId: integer('storyboard_id'),
  storyboardNum: integer('storyboard_num'),
  name: text('name'),
  description: text('description'),
  type: text('type'),
  category: text('category'),
  url: text('url'),
  thumbnailUrl: text('thumbnail_url'),
  localPath: text('local_path'),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  format: text('format'),
  imageGenId: integer('image_gen_id'),
  videoGenId: integer('video_gen_id'),
  isFavorite: boolean('is_favorite').default(false),
  viewCount: integer('view_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

/** AI 用量 / 成本台账（光束原创轻量实现） */
export const usageRecords = pgTable('usage_records', {
  id: serial('id').primaryKey(),
  dramaId: integer('drama_id'),
  episodeId: integer('episode_id'),
  taskId: integer('task_id'),
  serviceType: text('service_type').notNull(),
  provider: text('provider'),
  model: text('model'),
  unitType: text('unit_type').notNull(),
  units: text('units').notNull(),
  estimatedCost: text('estimated_cost'),
  actualCost: text('actual_cost'),
  currency: text('currency').default('CNY'),
  meta: text('meta'),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_usage_records_drama').on(t.dramaId),
  index('idx_usage_records_service').on(t.serviceType),
])

/** 媒体版本历史：覆盖 URL 前归档 */
export const mediaVersions = pgTable('media_versions', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  field: text('field').notNull(),
  url: text('url').notNull(),
  localPath: text('local_path'),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_media_versions_entity').on(t.entityType, t.entityId),
])

/** 可恢复生产流水线检查点（每集一行） */
export const produceCheckpoints = pgTable('produce_checkpoints', {
  id: serial('id').primaryKey(),
  episodeId: integer('episode_id').notNull().unique(),
  step: text('step').notNull(),
  payload: text('payload'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_produce_checkpoints_episode').on(t.episodeId),
])
