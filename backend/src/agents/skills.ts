import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

const skillsRoot = join(process.cwd(), 'workspace/skills')

export function listSkills(): Array<{ id: string; path: string }> {
  if (!existsSync(skillsRoot)) return []
  const result: Array<{ id: string; path: string }> = []
  function walk(dir: string, prefix = '') {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        walk(full, prefix ? `${prefix}/${name}` : name)
      } else if (name === 'SKILL.md') {
        result.push({ id: prefix || 'root', path: prefix ? `${prefix}/SKILL.md` : 'SKILL.md' })
      }
    }
  }
  walk(skillsRoot)
  return result
}

export function readSkill(relativePath: string) {
  const full = join(skillsRoot, relativePath)
  if (!existsSync(full)) throw new Error('技能文件不存在')
  return readFileSync(full, 'utf-8')
}

export function writeSkill(relativePath: string, content: string) {
  const full = join(skillsRoot, relativePath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content, 'utf-8')
}

export function loadSkillPrompt(skillId: string) {
  const candidates = [
    `${skillId}/SKILL.md`,
    skillId.endsWith('.md') ? skillId : `${skillId}/SKILL.md`,
  ]
  for (const p of candidates) {
    const full = join(skillsRoot, p)
    if (existsSync(full)) return readFileSync(full, 'utf-8')
  }
  return ''
}
