import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { execFileSync } from "child_process"
import yaml from "js-yaml"

export function inlineApiKey(
  mcpConfig: Record<string, unknown>,
  apiKey: string,
): void {
  for (const server of Object.values(mcpConfig)) {
    if (typeof server !== "object" || server === null) continue
    const headers = (server as Record<string, unknown>).headers as
      | Record<string, string>
      | undefined
    if (!headers) continue
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        headers[key] = value.replace(/\$\{CUBIC_API_KEY\}/g, apiKey)
      }
    }
  }
}

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
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
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
  "review-and-fix-issues",
  "run-review",
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

// --- Plugin root resolution ---

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function resolvePluginRoot(): Promise<{ pluginRoot: string; cloned: boolean }> {
  const packageRoot = path.resolve(__dirname, "..")
  if (await pathExists(path.join(packageRoot, ".mcp.json"))) {
    return { pluginRoot: packageRoot, cloned: false }
  }
  return { pluginRoot: await cloneFromGitHub(), cloned: true }
}

async function cloneFromGitHub(): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cubic-plugin-install-"),
  )
  const repo = "https://github.com/mrge-io/cubic-claude-plugin"
  console.log("Fetching latest plugin from GitHub...")
  try {
    execFileSync("git", ["clone", "--depth", "1", repo, tempDir], {
      stdio: "pipe",
    })
  } catch (err: unknown) {
    await fs.rm(tempDir, { recursive: true, force: true })
    const message = err instanceof Error ? err.message : "Unknown error"
    throw new Error(`Failed to clone plugin: ${message}`)
  }
  return tempDir
}

// --- Skills-only installation ---

export type CommandFormat = "original" | "stripped" | "toml"

export interface TargetLayout {
  skillsDir: (root: string) => string
  commandDir: (root: string) => string
  commandFormat: CommandFormat
  commandFilename: (source: string) => string
}

export const TARGET_LAYOUTS: Record<string, TargetLayout> = {
  claude: {
    skillsDir: (root) => path.join(root, ".claude", "skills"),
    commandDir: (root) => path.join(root, ".claude", "commands"),
    commandFormat: "original",
    commandFilename: (s) => s,
  },
  opencode: {
    skillsDir: (root) => path.join(root, "skills"),
    commandDir: (root) => path.join(root, "commands"),
    commandFormat: "stripped",
    commandFilename: (s) => `cubic-${s}`,
  },
  cursor: {
    skillsDir: (root) => path.join(root, "skills"),
    commandDir: (root) => path.join(root, "commands"),
    commandFormat: "stripped",
    commandFilename: (s) => `cubic-${s}`,
  },
  codex: {
    skillsDir: (root) => path.join(root, "skills"),
    commandDir: (root) => path.join(root, "prompts"),
    commandFormat: "stripped",
    commandFilename: (s) => `cubic-${s}`,
  },
  droid: {
    skillsDir: (root) => path.join(root, "skills"),
    commandDir: (root) => path.join(root, "commands"),
    commandFormat: "stripped",
    commandFilename: (s) => `cubic-${s}`,
  },
  pi: {
    skillsDir: (root) => path.join(root, "skills"),
    commandDir: (root) => path.join(root, "prompts"),
    commandFormat: "stripped",
    commandFilename: (s) => `cubic-${s}`,
  },
  gemini: {
    skillsDir: (root) => path.join(root, "skills"),
    commandDir: (root) => path.join(root, "commands"),
    commandFormat: "toml",
    commandFilename: (s) => `cubic-${s.replace(/\.md$/, ".toml")}`,
  },
}

export async function installCommands(
  pluginRoot: string,
  commandDir: string,
  layout: TargetLayout,
): Promise<number> {
  const sourceDir = path.join(pluginRoot, "commands")
  if (!(await pathExists(sourceDir))) return 0

  await fs.mkdir(commandDir, { recursive: true })
  let count = 0

  for (const file of await fs.readdir(sourceDir)) {
    if (!file.endsWith(".md")) continue
    const targetFilename = layout.commandFilename(file)

    if (layout.commandFormat === "original") {
      await fs.copyFile(
        path.join(sourceDir, file),
        path.join(commandDir, targetFilename),
      )
    } else {
      const content = await fs.readFile(path.join(sourceDir, file), "utf-8")
      const { data, body } = parseFrontmatter(content)

      if (layout.commandFormat === "stripped") {
        const stripped: Record<string, unknown> = {}
        if (data.description) stripped.description = data.description
        await fs.writeFile(
          path.join(commandDir, targetFilename),
          formatFrontmatter(stripped, body),
        )
      } else {
        const escaped = body.trim().replace(/\\/g, "\\\\\\\\").replace(/"""/g, '\\"\\"\\"')
        const toml = [
          `description = ${JSON.stringify(String(data.description ?? ""))}`,
          'prompt = """',
          escaped,
          '"""',
          "",
        ].join("\n")
        await fs.writeFile(path.join(commandDir, targetFilename), toml)
      }
    }
    count++
  }

  return count
}

export async function installReviewSkill(
  pluginRoot: string,
  skillsDir: string,
): Promise<void> {
  const source = path.join(pluginRoot, "skills", "run-review", "SKILL.md")
  if (!(await pathExists(source))) return
  const targetDir = path.join(skillsDir, "run-review")
  await fs.mkdir(targetDir, { recursive: true })
  await fs.copyFile(source, path.join(targetDir, "SKILL.md"))
}

export async function installReviewCommand(
  pluginRoot: string,
  commandDir: string,
  layout: TargetLayout,
): Promise<void> {
  const source = path.join(pluginRoot, "commands", "run-review.md")
  if (!(await pathExists(source))) return
  await fs.mkdir(commandDir, { recursive: true })

  const targetFilename = layout.commandFilename("run-review.md")

  if (layout.commandFormat === "original") {
    await fs.copyFile(source, path.join(commandDir, targetFilename))
    return
  }

  const content = await fs.readFile(source, "utf-8")
  const { data, body } = parseFrontmatter(content)

  if (layout.commandFormat === "stripped") {
    const stripped: Record<string, unknown> = {}
    if (data.description) stripped.description = data.description
    await fs.writeFile(
      path.join(commandDir, targetFilename),
      formatFrontmatter(stripped, body),
    )
  } else {
    const escaped = body.trim().replace(/\\/g, "\\\\\\\\").replace(/"""/g, '\\"\\"\\"')
    const toml = [
      `description = ${JSON.stringify(String(data.description ?? ""))}`,
      'prompt = """',
      escaped,
      '"""',
      "",
    ].join("\n")
    await fs.writeFile(path.join(commandDir, targetFilename), toml)
  }
}
