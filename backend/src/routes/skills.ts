import { Hono } from 'hono'
import { listSkills, readSkill, writeSkill } from '../agents/skills.js'
import { jsonOk, jsonFail } from '../utils/response.js'

export const skillsRouter = new Hono()

skillsRouter.get('/', (c) => jsonOk(c, listSkills()))

skillsRouter.get('/*', (c) => {
  const path = c.req.path.replace(/^\//, '')
  if (!path) return jsonFail(c, '请指定技能路径', 400)
  try {
    return jsonOk(c, { path, content: readSkill(path) })
  } catch {
    return jsonFail(c, '技能文件不存在', 404)
  }
})

skillsRouter.put('/*', async (c) => {
  const path = c.req.path.replace(/^\//, '')
  if (!path) return jsonFail(c, '请指定技能路径', 400)
  const body = await c.req.json<{ content: string }>()
  if (!body.content) return jsonFail(c, '内容不能为空')
  writeSkill(path, body.content)
  return jsonOk(c, { path, saved: true })
})
