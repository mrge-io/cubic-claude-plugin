import { defineCommand } from "citty"
import path from "path"
import { targets, TARGET_NAMES } from "./targets/index.js"

export default defineCommand({
  meta: {
    name: "uninstall",
    description: "Remove cubic plugin from AI coding tools",
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

    console.log("Removing cubic plugin...\n")

    for (const name of selectedTargets) {
      const target = targets[name]
      const outputRoot = args.output
        ? path.resolve(String(args.output), name)
        : target.defaultRoot()
      await target.uninstall(outputRoot)
    }

    console.log("\nRestart your editor to apply changes.")
  },
})
