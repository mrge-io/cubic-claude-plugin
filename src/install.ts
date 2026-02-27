import { defineCommand } from "citty"
import path from "path"
import { promises as fs } from "fs"
import { pathExists, inlineApiKey, resolvePluginRoot, installReviewSkill, installReviewCommand, TARGET_LAYOUTS } from "./utils.js"
import { targets, TARGET_NAMES } from "./targets/index.js"
import { promptForApiKey } from "./key-setup.js"

export default defineCommand({
  meta: {
    name: "install",
    description: "Install cubic plugin for AI coding tools",
  },
  args: {
    to: {
      type: "string",
      default: "all",
      description: `Target: ${TARGET_NAMES.join(", ")}, or "all"`,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory (overrides default per-target paths)",
    },
    "skills-only": {
      type: "boolean",
      default: false,
      description: "Install only skills and commands (no MCP server or API key)",
    },
  },
  async run({ args }) {
    const targetName = String(args.to)
    const selectedTargets =
      targetName === "all" ? TARGET_NAMES : [targetName]
    const skillsOnly = Boolean(args["skills-only"])

    for (const name of selectedTargets) {
      if (!targets[name]) {
        throw new Error(
          `Unknown target: ${name}. Available: ${TARGET_NAMES.join(", ")}, all`,
        )
      }
    }

    const apiKey = skillsOnly ? undefined : await promptForApiKey()

    const { pluginRoot, cloned } = await resolvePluginRoot()

    const mcpPath = path.join(pluginRoot, ".mcp.json")
    let originalMcp: string | undefined

    console.log(skillsOnly ? "Installing cubic skills...\n" : "Installing cubic plugin...\n")

    try {
      if (!skillsOnly && apiKey && (await pathExists(mcpPath))) {
        originalMcp = await fs.readFile(mcpPath, "utf-8")
        const mcpConfig = JSON.parse(originalMcp) as Record<string, unknown>
        inlineApiKey(mcpConfig, apiKey)
        await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2) + "\n")
      }

      for (const name of selectedTargets) {
        const target = targets[name]
        const outputRoot = args.output
          ? path.resolve(String(args.output), name)
          : target.defaultRoot()
        await fs.mkdir(outputRoot, { recursive: true })

        if (skillsOnly) {
          const layout = TARGET_LAYOUTS[name]
          await installReviewSkill(pluginRoot, layout.skillsDir(outputRoot))
          await installReviewCommand(pluginRoot, layout.commandDir(outputRoot), layout)
          console.log(`  ${name}: 1 skill, 1 command (skills only)`)
        } else {
          await target.install(pluginRoot, outputRoot, apiKey)
        }
      }
    } finally {
      if (originalMcp) {
        await fs.writeFile(mcpPath, originalMcp)
      }
      if (cloned) {
        await fs.rm(pluginRoot, { recursive: true, force: true })
      }
    }

    if (skillsOnly) {
      console.log("\n✓ Done! Restart your editor to start using cubic skills.")
    } else if (apiKey) {
      console.log("\n✓ Done! Restart your editor to start using cubic.")
    } else {
      console.log("\nNext steps:")
      console.log(
        "  1. Set your API key: export CUBIC_API_KEY=cbk_your_key_here",
      )
      console.log(
        "     Get one at: https://www.cubic.dev/settings?tab=integrations&integration=mcp",
      )
      console.log("  2. Restart your editor")
    }
  },
})
