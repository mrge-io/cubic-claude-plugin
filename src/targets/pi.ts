import path from "path"
import os from "os"
import { promises as fs } from "fs"
import type { Target } from "./index.js"
import { authHeader } from "./index.js"
import {
  parseFrontmatter,
  formatFrontmatter,
  pathExists,
  installSkills,
  uninstallSkills,
} from "../utils.js"

const CUBIC_PROMPTS = [
  "cubic-comments.md",
  "cubic-wiki.md",
  "cubic-scan.md",
  "cubic-learnings.md",
  "cubic-run-review.md",
]

export const pi: Target = {
  async install(pluginRoot: string, outputRoot: string, apiKey?: string): Promise<void> {
    const skillCount = await installSkills(pluginRoot, path.join(outputRoot, "skills"))

    const cmdSource = path.join(pluginRoot, "commands")
    let cmdCount = 0
    if (await pathExists(cmdSource)) {
      const promptsDir = path.join(outputRoot, "prompts")
      await fs.mkdir(promptsDir, { recursive: true })
      for (const file of await fs.readdir(cmdSource)) {
        if (!file.endsWith(".md")) continue
        const content = await fs.readFile(path.join(cmdSource, file), "utf-8")
        const { data, body } = parseFrontmatter(content)
        const stripped: Record<string, unknown> = {}
        if (data.description) stripped.description = data.description
        await fs.writeFile(
          path.join(promptsDir, `cubic-${file}`),
          formatFrontmatter(stripped, body),
        )
        cmdCount++
      }
    }

    const mcporterDir = path.join(outputRoot, "cubic")
    await fs.mkdir(mcporterDir, { recursive: true })
    await fs.writeFile(
      path.join(mcporterDir, "mcporter.json"),
      JSON.stringify(
        {
          mcpServers: {
            cubic: {
              baseUrl: "https://www.cubic.dev/api/mcp",
              headers: { Authorization: authHeader(apiKey) },
            },
          },
        },
        null,
        2,
      ) + "\n",
    )

    console.log(`  pi: ${skillCount} skills, ${cmdCount} prompts, 1 MCP server`)
  },

  async uninstall(outputRoot: string): Promise<void> {
    await uninstallSkills(path.join(outputRoot, "skills"))
    for (const p of CUBIC_PROMPTS) {
      const fp = path.join(outputRoot, "prompts", p)
      if (await pathExists(fp)) await fs.unlink(fp)
    }
    const mcporterDir = path.join(outputRoot, "cubic")
    if (await pathExists(mcporterDir)) await fs.rm(mcporterDir, { recursive: true })
    console.log("  pi: removed")
  },

  defaultRoot(): string {
    return path.join(os.homedir(), ".pi", "agent")
  },
}
