import path from "path"
import { promises as fs } from "fs"
import type { Target, TargetResult } from "./index.js"
import { authHeader } from "./index.js"
import {
  parseFrontmatter,
  pathExists,
  installSkills,
  uninstallSkills,
  mergeJsonConfig,
  removeMcpFromJsonConfig,
} from "../utils.js"

const CUBIC_COMMANDS = [
  "cubic-comments.toml",
  "cubic-wiki.toml",
  "cubic-scan.toml",
  "cubic-learnings.toml",
  "cubic-run-review.toml",
]

function toToml(description: string, prompt: string): string {
  const escaped = prompt.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')
  return [
    `description = ${JSON.stringify(description)}`,
    'prompt = """',
    escaped,
    '"""',
    "",
  ].join("\n")
}

export const gemini: Target = {
  async install(pluginRoot: string, outputRoot: string, apiKey?: string): Promise<TargetResult> {
    const skillCount = await installSkills(pluginRoot, path.join(outputRoot, "skills"))

    const cmdSource = path.join(pluginRoot, "commands")
    let cmdCount = 0
    if (await pathExists(cmdSource)) {
      const cmdTarget = path.join(outputRoot, "commands")
      await fs.mkdir(cmdTarget, { recursive: true })
      for (const file of await fs.readdir(cmdSource)) {
        if (!file.endsWith(".md")) continue
        const content = await fs.readFile(path.join(cmdSource, file), "utf-8")
        const { data, body } = parseFrontmatter(content)
        const name = file.replace(/\.md$/, "")
        await fs.writeFile(
          path.join(cmdTarget, `cubic-${name}.toml`),
          toToml(String(data.description ?? ""), body.trim()),
        )
        cmdCount++
      }
    }

    await mergeJsonConfig(path.join(outputRoot, "settings.json"), {
      cubic: {
        url: "https://www.cubic.dev/api/mcp",
        headers: { Authorization: authHeader(apiKey) },
      },
    })


    return { skills: skillCount, commands: cmdCount, prompts: 0, mcpServers: 1 }
  },

  async uninstall(outputRoot: string): Promise<void> {
    await uninstallSkills(path.join(outputRoot, "skills"))
    for (const cmd of CUBIC_COMMANDS) {
      const p = path.join(outputRoot, "commands", cmd)
      if (await pathExists(p)) await fs.unlink(p)
    }
    await removeMcpFromJsonConfig(path.join(outputRoot, "settings.json"), "cubic")
    console.log("  gemini: removed")
  },

  defaultRoot(): string {
    return path.join(process.cwd(), ".gemini")
  },
}
