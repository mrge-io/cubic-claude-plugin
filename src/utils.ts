import { promises as fs } from "fs"
import path from "path"
import yaml from "js-yaml"

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function readJson(p: string): Promise<Record<string, unknown>> {
  const content = await fs.readFile(p, "utf-8")
  return JSON.parse(content)
}

export function parseFrontmatter(content: string): {
  data: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: content }

  try {
    const data = (yaml.load(match[1]) as Record<string, unknown>) ?? {}
    return { data, body: match[2] }
  } catch {
    const data: Record<string, unknown> = {}
    for (const line of match[1].split("\n")) {
      const colonIdx = line.indexOf(":")
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      if (key) data[key] = value
    }
    return { data, body: match[2] }
  }
}

export function formatFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  const yamlStr = yaml.dump(data, { lineWidth: -1 }).trim()
  return `---\n${yamlStr}\n---\n${body}`
}

export function convertMcpConfig(
  claudeMcp: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}

  for (const [name, server] of Object.entries(claudeMcp)) {
    if (server.type === "http" || server.url) {
      result[name] = {
        type: "remote",
        url: server.url,
        ...(server.headers
          ? { headers: convertHeaders(server.headers as Record<string, string>) }
          : {}),
        enabled: true,
      }
    } else if (server.command) {
      const args = (server.args as string[]) ?? []
      result[name] = {
        type: "local",
        command: [server.command as string, ...args],
        ...(server.env ? { environment: server.env } : {}),
        enabled: true,
      }
    }
  }

  return result
}

function convertHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.replace(/\$\{(\w+)\}/g, "{env:$1}")
  }
  return result
}

export async function mergeOpenCodeConfig(
  configPath: string,
  additions: Record<string, unknown>,
): Promise<void> {
  let config: Record<string, unknown> = {}

  if (await pathExists(configPath)) {
    config = await readJson(configPath)
  }

  if (!config.$schema) {
    config.$schema = "https://opencode.ai/config.json"
  }

  if (additions.mcp) {
    config.mcp = {
      ...(config.mcp as Record<string, unknown> | undefined),
      ...(additions.mcp as Record<string, unknown>),
    }
  }

  const dir = path.dirname(configPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n")
}

export async function removeMcpFromConfig(configPath: string): Promise<void> {
  if (!(await pathExists(configPath))) return

  const config = await readJson(configPath)
  const mcp = config.mcp as Record<string, unknown> | undefined
  if (!mcp?.cubic) return

  delete mcp.cubic
  if (Object.keys(mcp).length === 0) delete config.mcp

  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n")
}

export const CUBIC_SKILLS = [
  "review-patterns",
  "codebase-context",
  "review-comments",
  "env-setup",
]

export async function installSkills(
  pluginRoot: string,
  skillsDir: string,
): Promise<number> {
  const sourceDir = path.join(pluginRoot, "skills")
  if (!(await pathExists(sourceDir))) return 0

  await fs.mkdir(skillsDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  let count = 0

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillMd = path.join(sourceDir, entry.name, "SKILL.md")
    if (!(await pathExists(skillMd))) continue
    const targetDir = path.join(skillsDir, entry.name)
    await fs.mkdir(targetDir, { recursive: true })
    await fs.copyFile(skillMd, path.join(targetDir, "SKILL.md"))
    count++
  }
  return count
}

export async function uninstallSkills(skillsDir: string): Promise<number> {
  let count = 0
  for (const skill of CUBIC_SKILLS) {
    const dir = path.join(skillsDir, skill)
    if (await pathExists(dir)) {
      await fs.rm(dir, { recursive: true })
      count++
    }
  }
  return count
}

export async function mergeFlatMcpConfig(
  configPath: string,
  entries: Record<string, unknown>,
): Promise<void> {
  let config: Record<string, unknown> = {}
  if (await pathExists(configPath)) {
    config = await readJson(configPath)
  }
  config = { ...config, ...entries }
  const dir = path.dirname(configPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n")
}

export async function mergeJsonConfig(
  configPath: string,
  mcpEntry: Record<string, unknown>,
): Promise<void> {
  let config: Record<string, unknown> = {}
  if (await pathExists(configPath)) {
    config = await readJson(configPath)
  }
  const existing = (config.mcpServers as Record<string, unknown>) ?? {}
  config.mcpServers = { ...existing, ...mcpEntry }
  const dir = path.dirname(configPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n")
}

export async function removeMcpFromJsonConfig(
  configPath: string,
  key: string,
): Promise<void> {
  if (!(await pathExists(configPath))) return
  const config = await readJson(configPath)
  const servers = config.mcpServers as Record<string, unknown> | undefined
  if (!servers?.[key]) return
  delete servers[key]
  if (Object.keys(servers).length === 0) delete config.mcpServers
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n")
}
