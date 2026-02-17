import path from "path"
import { promises as fs } from "fs"
import type { Target } from "./index.js"
import {
  pathExists,
  readJson,
  installSkills,
  uninstallSkills,
  CUBIC_SKILLS,
  mergeFlatMcpConfig,
} from "../utils.js"

const COMMANDS = ["comments.md", "wiki.md", "scan.md", "learnings.md", "run-review.md"]

export const claude: Target = {
  async install(pluginRoot: string, outputRoot: string): Promise<void> {
    const mcpSource = path.join(pluginRoot, ".mcp.json")
    if (await pathExists(mcpSource)) {
      const mcpEntries = await readJson(mcpSource)
      await mergeFlatMcpConfig(path.join(outputRoot, ".mcp.json"), mcpEntries)
    }

    const skillCount = await installSkills(pluginRoot, path.join(outputRoot, "skills"))

    const cmdSource = path.join(pluginRoot, "commands")
    let cmdCount = 0
    if (await pathExists(cmdSource)) {
      const cmdTarget = path.join(outputRoot, "commands")
      await fs.mkdir(cmdTarget, { recursive: true })
      for (const file of await fs.readdir(cmdSource)) {
        if (!file.endsWith(".md")) continue
        await fs.copyFile(path.join(cmdSource, file), path.join(cmdTarget, file))
        cmdCount++
      }
    }

    console.log(`  claude: ${skillCount} skills, ${cmdCount} commands, 1 MCP server`)
  },

  async uninstall(outputRoot: string): Promise<void> {
    await uninstallSkills(path.join(outputRoot, "skills"))
    for (const cmd of COMMANDS) {
      const p = path.join(outputRoot, "commands", cmd)
      if (await pathExists(p)) await fs.unlink(p)
    }
    const mcpPath = path.join(outputRoot, ".mcp.json")
    if (await pathExists(mcpPath)) {
      const config = await readJson(mcpPath)
      if (config.cubic) {
        delete config.cubic
        if (Object.keys(config).length === 0) {
          await fs.unlink(mcpPath)
        } else {
          await fs.writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n")
        }
      }
    }
    console.log("  claude: removed")
  },

  defaultRoot(): string {
    return process.cwd()
  },
}
