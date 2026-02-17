import { defineCommand } from "citty"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { promises as fs } from "fs"
import { execFileSync } from "child_process"
import { pathExists } from "./utils.js"
import { targets, TARGET_NAMES } from "./targets/index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineCommand({
  meta: {
    name: "install",
    description: "Install cubic plugin for AI coding tools",
  },
  args: {
    to: {
      type: "string",
      default: "claude",
      description: `Target: ${TARGET_NAMES.join(", ")}, or "all"`,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory (overrides default per-target paths)",
    },
  },
  async run({ args }) {
    const targetName = String(args.to)
    const selectedTargets =
      targetName === "all" ? TARGET_NAMES : [targetName]

    for (const name of selectedTargets) {
      if (!targets[name]) {
        throw new Error(
          `Unknown target: ${name}. Available: ${TARGET_NAMES.join(", ")}, all`,
        )
      }
    }

    const { pluginRoot, cloned } = await resolvePluginRoot()

    console.log("Installing cubic plugin...\n")

    try {
      for (const name of selectedTargets) {
        const target = targets[name]
        const outputRoot = args.output
          ? path.resolve(String(args.output), name)
          : target.defaultRoot()
        await fs.mkdir(outputRoot, { recursive: true })
        await target.install(pluginRoot, outputRoot)
      }
    } finally {
      if (cloned) {
        await fs.rm(pluginRoot, { recursive: true, force: true })
      }
    }

    console.log("\nNext steps:")
    console.log(
      "  1. Set your API key: export CUBIC_API_KEY=cbk_your_key_here",
    )
    console.log(
      "     Get one at: https://www.cubic.dev/settings?tab=integrations&integration=mcp",
    )
    console.log("  2. Restart your editor")
  },
})

async function resolvePluginRoot(): Promise<{ pluginRoot: string; cloned: boolean }> {
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
