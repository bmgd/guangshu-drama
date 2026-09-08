import { generateObject, generateText, type CoreMessage } from 'ai'
import { z } from 'zod'
import { createTextModel } from './context.js'
import { loadSkillPrompt } from './skills.js'
import { createDramaTools } from './tools.js'

const scriptSchema = z.object({
  title: z.string(),
  script: z.string(),
  summary: z.string().optional(),
})

export async function rewriteScript(input: { content: string; genre?: string }) {
  const system = loadSkillPrompt('script-rewriter') || `你是专业短剧编剧。将输入小说/故事改写为标准短剧剧本格式，包含场景标题、人物对白、动作描述。保持剧情紧凑，适合竖屏短剧节奏。`
  const { object } = await generateObject({
    model: await createTextModel(),
    schema: scriptSchema,
    system,
    prompt: `题材: ${input.genre || '都市情感'}\n\n原文:\n${input.content}`,
  })
  return object
}

/** 从创意大纲创作标准短剧剧本（非润色已有文稿） */
export async function generateScriptFromBrief(input: {
  brief: string
  genre?: string
  episodeCount?: number
}) {
  const system = loadSkillPrompt('script-generator') || `你是专业短剧编剧。根据创意大纲从零创作标准短剧剧本，不是润色或改写已有文稿。输出包含场景标题、人物对白、动作描述，节奏紧凑，适合竖屏短剧。`
  const epHint = input.episodeCount && input.episodeCount > 1
    ? `请按约 ${input.episodeCount} 集结构展开（本输出可聚焦第 1 集完整剧本）。`
    : '输出完整单集剧本。'
  const { object } = await generateObject({
    model: await createTextModel(),
    schema: scriptSchema,
    system,
    prompt: `题材: ${input.genre || '都市情感'}\n${epHint}\n\n创意大纲:\n${input.brief}`,
  })
  return object
}

const extractSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    description: z.string().optional(),
    appearance: z.string().optional(),
    personality: z.string().optional(),
  })),
  scenes: z.array(z.object({
    location: z.string(),
    time: z.string(),
    prompt: z.string(),
    lighting: z.string().optional(),
  })),
  props: z.array(z.object({
    name: z.string(),
    type: z.string().optional(),
    description: z.string().optional(),
    prompt: z.string().optional(),
  })),
})

export async function extractElements(script: string) {
  const system = loadSkillPrompt('extractor') || `你是影视前期策划。从剧本中提取角色、场景、道具，去重合并同类项，输出结构化 JSON。`
  const { object } = await generateObject({
    model: await createTextModel(),
    schema: extractSchema,
    system,
    prompt: script,
  })
  return object
}

const storyboardSchema = z.object({
  storyboards: z.array(z.object({
    storyboardNumber: z.number(),
    title: z.string().optional(),
    location: z.string().optional(),
    time: z.string().optional(),
    shotType: z.string().optional(),
    angle: z.string().optional(),
    movement: z.string().optional(),
    description: z.string().optional(),
    result: z.string().optional(),
    atmosphere: z.string().optional(),
    duration: z.number().optional(),
    characterNames: z.array(z.string()).optional(),
    propNames: z.array(z.string()).optional(),
  })),
})

export async function breakStoryboard(script: string) {
  const system = loadSkillPrompt('storyboard-breaker') || `你是分镜导演。将剧本拆解为镜头序列，每个镜头包含景别、角度、运镜、画面描述、时长建议。`
  const { object } = await generateObject({
    model: await createTextModel(),
    schema: storyboardSchema,
    system,
    prompt: script,
  })
  return object
}

const promptSchema = z.object({
  items: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    type: z.enum(['character', 'scene', 'prop', 'storyboard_image', 'storyboard_video']),
    prompt: z.string(),
  })),
})

export async function generatePrompts(input: {
  type: 'character' | 'scene' | 'prop' | 'storyboard'
  items: Array<Record<string, unknown>>
  stylePrompt?: string
}) {
  const skillMap = {
    character: 'prompt-generator/character-prompt',
    scene: 'prompt-generator/scene-prompt',
    prop: 'prompt-generator/prop-prompt',
    storyboard: 'prompt-generator/video-prompt',
  }
  const system = loadSkillPrompt(skillMap[input.type]) || `你是 AI 绘画/视频提示词工程师。根据元素信息生成英文提示词，风格统一，细节丰富。`
  const { object } = await generateObject({
    model: await createTextModel(),
    schema: promptSchema,
    system: `${system}\n画面风格: ${input.stylePrompt || 'cinematic'}`,
    prompt: JSON.stringify(input.items, null, 2),
  })
  return object
}

export type AgentChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export async function runAgentChat(input: {
  messages: AgentChatMessage[]
  dramaId?: number
  episodeId?: number
}) {
  const tools = createDramaTools({
    dramaId: input.dramaId,
    episodeId: input.episodeId,
  })
  const system = `你是「光束短剧」创作助手。可调用工具查询角色/场景/道具、读写剧本、列出分镜，也可调用 rewriteScriptTool / generateScriptTool / extractElementsTool / breakStoryboardTool 执行生产步骤。
当前上下文: dramaId=${input.dramaId ?? '未指定'}, episodeId=${input.episodeId ?? '未指定'}。
回答简洁，优先使用工具获取真实数据后再建议。`

  const messages: CoreMessage[] = input.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const result = await generateText({
    model: await createTextModel(),
    system,
    messages,
    tools,
    maxSteps: 5,
  })

  const toolCalls = result.steps.flatMap((step) =>
    (step.toolCalls || []).map((tc) => ({
      toolName: tc.toolName,
      args: 'args' in tc ? tc.args : undefined,
    })),
  )

  return {
    text: result.text,
    steps: result.steps.map((step, i) => ({
      index: i,
      finishReason: step.finishReason,
      toolCalls: (step.toolCalls || []).map((tc) => tc.toolName),
      text: step.text || '',
    })),
    toolCalls,
  }
}
