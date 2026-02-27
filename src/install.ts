import { defineCommand } from "citty"
import path from "path"
import { promises as fs } from "fs"
import {
  pathExists,
  inlineApiKey,
  resolvePluginRoot,
  installReviewSkill,
  installReviewCommand,
  TARGET_LAYOUTS,
} from "./utils.js"
import { targets, TARGET_NAMES } from "./targets/index.js"
import { promptForApiKey } from "./key-setup.js"
import { createEmitter } from "./events.js"

interface ResultEntry {
  agent: string
  skills: number
  commands: number
  prompts: number
  mcpServers: number
  status: "ok" | "failed"
  reason: string | null
}

function formatTargetLine(name: string, r: ResultEntry): string {
  const parts = [`${r.skills} skills`]
  if (r.commands > 0) parts.push(`${r.commands} commands`)
  if (r.prompts > 0) parts.push(`${r.prompts} prompts`)
  if (r.mcpServers > 0)
    parts.push(`${r.mcpServers} MCP server${r.mcpServers !== 1 ? "s" : ""}`)
  return `  ${name}: ${parts.join(", ")}`
}

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
      description:
        "Install only skills and commands (no MCP server or API key)",
    },
    json: {
      type: "boolean",
      default: false,
      description: "Emit newline-delimited JSON events to stdout",
    },
  },
  async run({ args }) {
    const jsonMode = Boolean(args.json)
    const emit = createEmitter(jsonMode)
    const targetName = String(args.to)
    const selectedTargets =
      targetName === "all" ? TARGET_NAMES : [targetName]
    const skillsOnly = Boolean(args["skills-only"])

    for (const name of selectedTargets) {
      if (!targets[name]) {
        const msg = `Unknown target: ${name}. Available: ${TARGET_NAMES.join(", ")}, all`
        if (jsonMode) {
          emit({
            type: "install_failed",
            code: "UNKNOWN_TARGET",
            message: msg,
            retryable: false,
          })
          process.exit(1)
        }
        throw new Error(msg)
      }
    }

    emit({
      type: "install_started",
      mode: skillsOnly ? "skills-only" : "full",
      target: targetName,
    })

    let apiKey: string | undefined
    if (!skillsOnly) {
      try {
        apiKey = await promptForApiKey(emit, jsonMode)
      } catch (err) {
        if (jsonMode) {
          const message = err instanceof Error ? err.message : String(err)
          emit({
            type: "install_failed",
            code: "AUTH_FAILED",
            message,
            retryable: true,
          })
          process.exit(1)
        }
        throw err
      }
    }

    let pluginRoot: string
    let cloned: boolean
    try {
      const resolved = await resolvePluginRoot(jsonMode)
      pluginRoot = resolved.pluginRoot
      cloned = resolved.cloned
    } catch (err) {
      if (jsonMode) {
        const message = err instanceof Error ? err.message : String(err)
        emit({
          type: "install_failed",
          code: "PLUGIN_RESOLVE_FAILED",
          message,
          retryable: true,
        })
        process.exit(1)
      }
      throw err
    }

    const mcpPath = path.join(pluginRoot, ".mcp.json")
    let originalMcp: string | undefined

    if (!jsonMode) {
      console.log(
        skillsOnly
          ? "Installing cubic skills...\n"
          : "Installing cubic plugin...\n",
      )
    }

    const results: ResultEntry[] = []

    try {
      if (!skillsOnly && apiKey && (await pathExists(mcpPath))) {
        originalMcp = await fs.readFile(mcpPath, "utf-8")
        const mcpConfig = JSON.parse(originalMcp) as Record<string, unknown>
        inlineApiKey(mcpConfig, apiKey)
        await fs.writeFile(
          mcpPath,
          JSON.stringify(mcpConfig, null, 2) + "\n",
        )
      }

      for (const name of selectedTargets) {
        const target = targets[name]
        const outputRoot = args.output
          ? path.resolve(String(args.output), name)
          : target.defaultRoot()
        await fs.mkdir(outputRoot, { recursive: true })

        emit({ type: "target_started", agent: name })

        try {
          let entry: ResultEntry

          if (skillsOnly) {
            const layout = TARGET_LAYOUTS[name]
            await installReviewSkill(
              pluginRoot,
              layout.skillsDir(outputRoot),
            )
            await installReviewCommand(
              pluginRoot,
              layout.commandDir(outputRoot),
              layout,
            )
            entry = {
              agent: name,
              skills: 1,
              commands: 1,
              prompts: 0,
              mcpServers: 0,
              status: "ok",
              reason: null,
            }
          } else {
            const tr = await target.install(pluginRoot, outputRoot, apiKey)
            entry = {
              agent: name,
              ...tr,
              status: "ok",
              reason: null,
            }
          }

          results.push(entry)
          emit({ type: "target_result", ...entry })
          if (!jsonMode) {
            if (skillsOnly) {
              console.log(`  ${name}: 1 skill, 1 command (skills only)`)
            } else {
              console.log(formatTargetLine(name, entry))
            }
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err)
          const entry: ResultEntry = {
            agent: name,
            skills: 0,
            commands: 0,
            prompts: 0,
            mcpServers: 0,
            status: "failed",
            reason,
          }
          results.push(entry)
          emit({ type: "target_result", ...entry })
          if (!jsonMode) console.log(`  ${name}: failed — ${reason}`)
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

    const succeeded = results.filter((r) => r.status === "ok")
    const failed = results.filter((r) => r.status === "failed")

    emit({
      type: "install_summary",
      targetsTotal: results.length,
      targetsSucceeded: succeeded.length,
      targetsFailed: failed.length,
      skillsTotal: results.reduce((s, r) => s + r.skills, 0),
      commandsTotal: results.reduce((s, r) => s + r.commands, 0),
      promptsTotal: results.reduce((s, r) => s + r.prompts, 0),
      mcpServersTotal: results.reduce((s, r) => s + r.mcpServers, 0),
    })

    if (failed.length > 0) {
      emit({
        type: "install_failed",
        code: "TARGET_WRITE_FAILED",
        message: `${failed.length} target(s) failed`,
        retryable: true,
      })
      if (jsonMode) process.exit(1)
    } else {
      emit({ type: "install_completed", ok: true })
      if (jsonMode) process.exit(0)
    }

    if (!jsonMode) {
      if (skillsOnly) {
        console.log(
          "\n✓ Done! Restart your editor to start using cubic skills.",
        )
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
    }

    if (!jsonMode && failed.length > 0) process.exit(1)
  },
})
