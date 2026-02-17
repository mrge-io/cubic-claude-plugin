import path from "path"
import os from "os"
import { promises as fs } from "fs"
import type { Target } from "./index.js"
import {
  pathExists,
  readJson,
  installSkills,
  uninstallSkills,
  CUBIC_SKILLS,
  mergeJsonConfig,
  removeMcpFromJsonConfig,
} from "../utils.js"

const COMMANDS = ["cubic-comments.md", "cubic-wiki.md", "cubic-scan.md", "cubic-learnings.md", "cubic-run-review.md"]

function claudeJsonPath(): string {
  return path.join(os.homedir(), ".claude.json")
}

export const claude: Target = {
  async install(pluginRoot: string, outputRoot: string): Promise<void> {
    const mcpSource = path.join(pluginRoot, ".mcp.json")
    if (await pathExists(mcpSource)) {
      const mcpEntries = await readJson(mcpSource)
      await mergeJsonConfig(claudeJsonPath(), mcpEntries)
    }

    const skillCount = await installSkills(pluginRoot, path.join(outputRoot, "skills"))

    const cmdSource = path.join(pluginRoot, "commands")
    let cmdCount = 0
    if (await pathExists(cmdSource)) {
      const cmdTarget = path.join(outputRoot, "commands")
      await fs.mkdir(cmdTarget, { recursive: true })
      for (const file of await fs.readdir(cmdSource)) {
        if (!file.endsWith(".md")) continue
        await fs.copyFile(path.join(cmdSource, file), path.join(cmdTarget, `cubic-${file}`))
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
    await removeMcpFromJsonConfig(claudeJsonPath(), "cubic")
    console.log("  claude: removed")
  },

  defaultRoot(): string {
    return path.join(os.homedir(), ".claude")
  },
}
