import readline from "readline"
import { spawn } from "child_process"
import os from "os"
import type { Emitter } from "./events.js"

const CUBIC_URL =
  "https://www.cubic.dev/settings?tab=integrations&integration=mcp"

const DEFAULT_JSON_INPUT_TIMEOUT_MS = 2 * 60 * 1000

class ApiKeyPromptTimeoutError extends Error {
  readonly code = "AUTH_PROMPT_TIMEOUT"
  readonly retryable = true

  constructor(message = "Timed out waiting for API key input") {
    super(message)
    this.name = "ApiKeyPromptTimeoutError"
  }
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/** Read a single line from stdin without writing a prompt to stdout. */
function getJsonInputTimeoutMs(): number {
  const raw = process.env.CUBIC_AUTH_PROMPT_TIMEOUT_MS
  if (!raw) return DEFAULT_JSON_INPUT_TIMEOUT_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_JSON_INPUT_TIMEOUT_MS
  return Math.floor(parsed)
}

function readStdinLine(timeoutMs?: number): Promise<{ line: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin })
    let gotLine = false
    let timeout: NodeJS.Timeout | undefined
    let timedOut = false

    const finish = (line: string, timedOutInput = false): void => {
      if (gotLine) return
      gotLine = true
      timedOut = timedOutInput
      if (timeout) clearTimeout(timeout)
      rl.close()
      resolve({ line: line.trim(), timedOut })
    }

    rl.once("line", (line) => {
      finish(line)
    })

    rl.once("close", () => {
      if (gotLine) return
      if (timeout) clearTimeout(timeout)
      gotLine = true
      resolve({ line: "", timedOut })
    })

    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      timeout = setTimeout(() => {
        finish("", true)
      }, timeoutMs)
      timeout.unref()
    }
  })
}

function openBrowser(url: string): void {
  const platform = os.platform()
  let cmd: string
  let args: string[]

  if (platform === "darwin") {
    cmd = "open"
    args = [url]
  } else if (platform === "win32") {
    cmd = "cmd"
    args = ["/c", "start", "", url]
  } else {
    cmd = "xdg-open"
    args = [url]
  }

  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" })
    child.unref()
  } catch {
    // Browser open failed — user can navigate manually
  }
}

function maskKey(key: string): string {
  if (key.length <= 11) return key.slice(0, 7) + "..."
  return key.slice(0, 7) + "..." + key.slice(-4)
}

export async function promptForApiKey(
  emit?: Emitter,
  jsonMode?: boolean,
): Promise<string | undefined> {
  const existing = process.env.CUBIC_API_KEY
  const hasValidEnvKey = Boolean(existing?.startsWith("cbk_"))

  // ── JSON mode: structured events, no text to stdout ─────────
  if (jsonMode && emit) {
    emit({
      type: "auth_required",
      method: "api_key",
      source: hasValidEnvKey ? "env" : "prompt",
      hasEnvKey: hasValidEnvKey,
    })

    if (hasValidEnvKey) {
      emit({ type: "auth_success", source: "env" })
      return existing
    }

    emit({ type: "auth_open_url", url: CUBIC_URL })
    emit({ type: "auth_prompt", field: "api_key", masked: true })

    // Parent writes the key to our stdin after seeing auth_prompt
    const timeoutMs = getJsonInputTimeoutMs()
    const { line, timedOut } = await readStdinLine(timeoutMs)
    const key = line.replace(/^["']|["']$/g, "")

    if (!key) {
      if (timedOut) {
        throw new ApiKeyPromptTimeoutError(
          `Timed out waiting for API key input after ${Math.floor(timeoutMs / 1000)}s`,
        )
      }
      throw new ApiKeyPromptTimeoutError(
        "No API key input received on stdin",
      )
    }

    if (!key.startsWith("cbk_")) {
      emit({
        type: "auth_warning",
        message: "Key doesn't start with 'cbk_'. Double-check your key.",
      })
    }

    emit({ type: "auth_success", source: "prompt" })
    return key
  }

  // ── Text mode: original interactive UX ──────────────────────
  if (!process.stdin.isTTY) {
    console.log("\n  No TTY detected. Set your API key manually:")
    console.log("    export CUBIC_API_KEY=cbk_your_key_here")
    console.log(`    Get one at: ${CUBIC_URL}\n`)
    return undefined
  }

  if (existing?.startsWith("cbk_")) {
    const answer = await ask(
      `  API key found in environment (${maskKey(existing)}). Use it? [Y/n] `,
    )
    if (answer.toLowerCase() !== "n") {
      return existing
    }
  }

  console.log("\n  Generate your API key at cubic.dev")
  await ask("  Press Enter to open in browser...")
  openBrowser(CUBIC_URL)

  const raw = await ask("\n  Paste your API key: ")
  const key = raw.replace(/^["']|["']$/g, "")

  if (!key) {
    console.log("  Skipped. You can set CUBIC_API_KEY later.\n")
    return undefined
  }

  if (!key.startsWith("cbk_")) {
    console.log(
      "  Warning: key doesn't start with 'cbk_'. Double-check your key.",
    )
  }

  return key
}
