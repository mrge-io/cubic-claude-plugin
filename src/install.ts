import { defineCommand } from "citty"
import path from "path"
import { promises as fs } from "fs"
import {
  pathExists,
  resolvePluginRoot,
  installReviewSkill,
  installReviewCommand,
  TARGET_LAYOUTS,
  readPluginVersion,
  writeManifest,
  readPluginMcpConfig,
  type InstallMethod,
  type ManifestEntry,
  type CubicManifest,
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

const DEFAULT_INSTALL_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_TARGET_INSTALL_TIMEOUT_MS = 60 * 1000

class InstallTimeoutError extends Error {
  readonly code = "INSTALL_TIMEOUT"
  readonly retryable = true

  constructor(timeoutMs: number) {
    super(`Timed out while installing cubic plugin after ${Math.floor(timeoutMs / 1000)}s`)
    this.name = "InstallTimeoutError"
  }
}

class TargetInstallTimeoutError extends Error {
  readonly code = "TARGET_INSTALL_TIMEOUT"
  readonly retryable = true

  constructor(target: string, timeoutMs: number) {
    super(`Timed out while installing target '${target}' after ${Math.floor(timeoutMs / 1000)}s`)
    this.name = "TargetInstallTimeoutError"
  }
}

function getTimeoutMs(envName: string, fallbackMs: number): number {
  const raw = process.env[envName]
  if (!raw) return fallbackMs
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs
  return Math.floor(parsed)
}

function getInstallTimeoutMs(): number {
  return getTimeoutMs("CUBIC_INSTALL_TIMEOUT_MS", DEFAULT_INSTALL_TIMEOUT_MS)
}

function getTargetInstallTimeoutMs(): number {
  return getTimeoutMs(
    "CUBIC_TARGET_INSTALL_TIMEOUT_MS",
    DEFAULT_TARGET_INSTALL_TIMEOUT_MS,
  )
}

async function maybeDelayForTest(envName: string): Promise<void> {
  if (process.env.NODE_ENV !== "test") return
  const delayMs = getTimeoutMs(envName, 0)
  if (delayMs <= 0) return
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

async function flushOutputs(): Promise<void> {
  await Promise.all([
    new Promise<void>((resolve) => process.stdout.write("", () => resolve())),
    new Promise<void>((resolve) => process.stderr.write("", () => resolve())),
  ])
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  createError: () => Error,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(createError())
    }, timeoutMs)

    operation.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function bestEffortCleanup(params: {
  pluginRoot?: string
  cloned: boolean
}): Promise<void> {
  const cleanupTasks: Promise<unknown>[] = []

  if (params.cloned && params.pluginRoot) {
    cleanupTasks.push(
      fs.rm(params.pluginRoot, { recursive: true, force: true }).catch(() => {}),
    )
  }

  if (cleanupTasks.length === 0) return
  await Promise.all(cleanupTasks)
}

function formatTargetLine(name: string, r: ResultEntry): string {
  const parts = [`${r.skills} skills`]
  if (r.commands > 0) parts.push(`${r.commands} commands`)
  if (r.prompts > 0) parts.push(`${r.prompts} prompts`)
  if (r.mcpServers > 0)
    parts.push(`${r.mcpServers} MCP server${r.mcpServers !== 1 ? "s" : ""}`)
  return `  ${name}: ${parts.join(", ")}`
}

async function buildManifestEntries(
  pluginRoot: string,
  targetName: string,
  skillsOnly: boolean,
  method: InstallMethod,
): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = []
  const layout = TARGET_LAYOUTS[targetName]

  // Skills
  const skillsSource = path.join(pluginRoot, "skills")
  if (await pathExists(skillsSource)) {
    const dirs = await fs.readdir(skillsSource, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      if (await pathExists(path.join(skillsSource, d.name, "SKILL.md"))) {
        // For skills-only mode, only run-review is installed
        if (skillsOnly && d.name !== "run-review") continue
        entries.push({
          name: d.name,
          type: "skill",
          file: path.join("skills", d.name, "SKILL.md"),
          method,
        })
      }
    }
  }

  // Commands
  const cmdsSource = path.join(pluginRoot, "commands")
  if (await pathExists(cmdsSource)) {
    const files = await fs.readdir(cmdsSource)
    for (const file of files) {
      if (!file.endsWith(".md")) continue
      // For skills-only mode, only run-review command is installed
      if (skillsOnly && !file.includes("run-review")) continue
      const outName = layout ? layout.commandFilename(file) : file
      // Commands with format transforms (stripped/toml) are always copied, not symlinked
      const cmdMethod = layout && layout.commandFormat !== "original" ? "paste" as InstallMethod : method
      entries.push({
        name: file.replace(/\.md$/, ""),
        type: "command",
        file: outName,
        method: cmdMethod,
      })
    }
  }

  // MCP config (only for full installs)
  if (!skillsOnly) {
    entries.push({
      name: "cubic",
      type: "mcp-config",
      file: "mcp-config",
      method: "paste",
    })
  }

  return entries
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
    method: {
      type: "string",
      default: "paste",
      description: 'Installation method: "paste" (copy files) or "symlink" (create symlinks)',
    },
  },
  async run({ args }) {
    const jsonMode = Boolean(args.json)
    const emit = createEmitter(jsonMode)
    const targetName = String(args.to)
    const selectedTargets =
      targetName === "all" ? TARGET_NAMES : [targetName]
    const skillsOnly = Boolean(args["skills-only"])
    const method = String(args.method) as InstallMethod
    const installTimeoutMs = getInstallTimeoutMs()
    const targetInstallTimeoutMs = getTargetInstallTimeoutMs()

    if (method !== "paste" && method !== "symlink") {
      const msg = `Unknown method: ${method}. Available: paste, symlink`
      if (jsonMode) {
        emit({
          type: "install_failed",
          code: "UNKNOWN_METHOD",
          message: msg,
          retryable: false,
        })
        process.exitCode = 1
        return
      }
      throw new Error(msg)
    }

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
          process.exitCode = 1
          return
        }
        throw new Error(msg)
      }
    }

    // install_started is emitted after resolvePluginRoot so we have pluginVersion

    let apiKey: string | undefined
    if (!skillsOnly) {
      try {
        apiKey = await promptForApiKey(emit, jsonMode)
      } catch (err) {
        if (jsonMode) {
          const message = err instanceof Error ? err.message : String(err)
          const code =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            typeof (err as { code: unknown }).code === "string"
              ? (err as { code: string }).code
              : "AUTH_FAILED"
          const retryable =
            typeof err === "object" &&
            err !== null &&
            "retryable" in err &&
            typeof (err as { retryable: unknown }).retryable === "boolean"
              ? (err as { retryable: boolean }).retryable
              : true
          emit({
            type: "install_failed",
            code,
            message,
            retryable,
          })
          process.exitCode = 1
          return
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
        process.exitCode = 1
        return
      }
      throw err
    }

    const pluginVersion = await readPluginVersion(pluginRoot)

    emit({
      type: "install_started",
      mode: skillsOnly ? "skills-only" : "full",
      method,
      pluginVersion,
      target: targetName,
    })

    if (method === "symlink" && cloned) {
      const msg = "Symlink requires a local plugin source. Use --method paste or clone the repo first."
      if (jsonMode) {
        emit({
          type: "install_failed",
          code: "SYMLINK_NO_LOCAL_SOURCE",
          message: msg,
          retryable: false,
        })
        process.exitCode = 1
        return
      }
      throw new Error(msg)
    }

    let installPhaseFinished = false
    let installTimedOut = false

    const installWatchdog = setTimeout(() => {
      if (installPhaseFinished) return
      installTimedOut = true
      const error = new InstallTimeoutError(installTimeoutMs)
      void bestEffortCleanup({
        pluginRoot,
        cloned,
      }).finally(() => {
        if (jsonMode) {
          emit({
            type: "install_failed",
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          })
        } else {
          console.error(`\n✗ ${error.message}`)
          console.error(
            "  You can retry setup, or set CUBIC_API_KEY and run the installer manually.",
          )
        }
        void flushOutputs().finally(() => {
          process.exit(1)
        })
      })
    }, installTimeoutMs)

    if (!jsonMode) {
      console.log(
        skillsOnly
          ? "Installing cubic skills...\n"
          : "Installing cubic plugin...\n",
      )
    }

    const results: ResultEntry[] = []
    const pluginMcpConfig = !skillsOnly
      ? await readPluginMcpConfig(pluginRoot, apiKey)
      : undefined

    try {
      await maybeDelayForTest("CUBIC_TEST_INSTALL_DELAY_MS")

      for (const name of selectedTargets) {
        const target = targets[name]
        const outputRoot = args.output
          ? path.resolve(String(args.output), name)
          : target.defaultRoot()
        await fs.mkdir(outputRoot, { recursive: true })

        emit({ type: "target_started", agent: name })

        try {
          const entry = await withTimeout(
            (async (): Promise<ResultEntry> => {
              await maybeDelayForTest("CUBIC_TEST_TARGET_INSTALL_DELAY_MS")

              if (skillsOnly) {
                const layout = TARGET_LAYOUTS[name]
                if (!layout) {
                  throw new Error(
                    `No skills-only layout defined for target: ${name}. Add an entry to TARGET_LAYOUTS.`,
                  )
                }
                const skillInstalled = await installReviewSkill(
                  pluginRoot,
                  layout.skillsDir(outputRoot),
                  method,
                )
                const commandInstalled = await installReviewCommand(
                  pluginRoot,
                  layout.commandDir(outputRoot),
                  layout,
                  method,
                )
                const skills = skillInstalled ? 1 : 0
                const commands = commandInstalled ? 1 : 0
                return {
                  agent: name,
                  skills,
                  commands,
                  prompts: 0,
                  mcpServers: 0,
                  status: "ok",
                  reason: null,
                }
              }

              const tr = await target.install(
                pluginRoot,
                outputRoot,
                apiKey,
                method,
                pluginMcpConfig,
              )
              return {
                agent: name,
                ...tr,
                status: "ok",
                reason: null,
              }
            })(),
            targetInstallTimeoutMs,
            () => new TargetInstallTimeoutError(name, targetInstallTimeoutMs),
          )

          results.push(entry)
          emit({ type: "target_result", method, ...entry })

          // Write manifest for this target
          if (entry.status === "ok") {
            const manifestEntries = await buildManifestEntries(pluginRoot, name, skillsOnly, method)
            const manifest: CubicManifest = {
              manifestVersion: 1,
              pluginVersion,
              method,
              installedAt: new Date().toISOString(),
              target: name,
              ...(method === "symlink" ? { pluginRoot } : {}),
              entries: manifestEntries,
            }
            await writeManifest(outputRoot, manifest)
          }

          if (!jsonMode) {
            if (skillsOnly) {
              console.log(`  ${name}: ${entry.skills} skill, ${entry.commands} command (skills only)`)
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
          emit({ type: "target_result", method, ...entry })
          if (!jsonMode) console.log(`  ${name}: failed — ${reason}`)
        }
      }
    } finally {
      clearTimeout(installWatchdog)
      if (!installTimedOut) {
        installPhaseFinished = true
        await bestEffortCleanup({
          pluginRoot,
          cloned,
        })
      }
    }

    const succeeded = results.filter((r) => r.status === "ok")
    const failed = results.filter((r) => r.status === "failed")

    emit({
      type: "install_summary",
      pluginVersion,
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
      process.exitCode = 1
      if (jsonMode) return
    } else {
      emit({ type: "install_completed", ok: true })
      if (jsonMode) return
    }

    if (failed.length === 0) {
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
  },
})
