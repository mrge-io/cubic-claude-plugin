import { claude } from "./claude.js"
import { opencode } from "./opencode.js"
import { codex } from "./codex.js"
import { cursor } from "./cursor.js"
import { droid } from "./droid.js"
import { pi } from "./pi.js"
import { gemini } from "./gemini.js"

export interface Target {
  install(pluginRoot: string, outputRoot: string, apiKey?: string): Promise<void>
  uninstall(outputRoot: string): Promise<void>
  defaultRoot(): string
}

export function authHeader(apiKey?: string): string {
  return apiKey ? `Bearer ${apiKey}` : "Bearer ${CUBIC_API_KEY}"
}

export const targets: Record<string, Target> = {
  claude,
  opencode,
  codex,
  cursor,
  droid,
  pi,
  gemini,
}

export const TARGET_NAMES = Object.keys(targets)
