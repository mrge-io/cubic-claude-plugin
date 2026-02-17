import readline from "readline"
import { spawn } from "child_process"
import os from "os"

const CUBIC_URL =
  "https://www.cubic.dev/settings?tab=integrations&integration=mcp"

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

export async function promptForApiKey(): Promise<string | undefined> {
  if (!process.stdin.isTTY) {
    console.log("\n  No TTY detected. Set your API key manually:")
    console.log("    export CUBIC_API_KEY=cbk_your_key_here")
    console.log(`    Get one at: ${CUBIC_URL}\n`)
    return undefined
  }

  const existing = process.env.CUBIC_API_KEY
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
