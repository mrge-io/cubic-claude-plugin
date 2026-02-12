# Cubic Plugin for Claude Code

Access Cubic's AI code review insights directly from Claude Code. Get PR review violations, browse AI-generated wikis, check codebase scans, and apply team review learnings — all without leaving your editor.

## Prerequisites

- [Claude Code](https://code.claude.com) v1.0.33+
- A [Cubic](https://www.cubic.dev) account with an active installation
- A Cubic API key (`cbk_*`)
- (Optional) [Cubic CLI](https://cubic.dev/install) for `/cubic:run-review`

## Installation

```bash
claude plugin install cubic@cubic-plugin-marketplace
```

## Setup

1. Generate an API key from your [Cubic dashboard](https://www.cubic.dev/settings?tab=integrations&integration=mcp)
2. Set the environment variable:

```bash
export CUBIC_API_KEY=cbk_your_api_key_here
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) so it persists across sessions.

## Commands

| Command                          | Description                                                            |
| -------------------------------- | ---------------------------------------------------------------------- |
| `/cubic:comments [pr-number]`    | Show Cubic's review comments on the current PR (auto-detects branch)   |
| `/cubic:run-review [flags]`      | Run a local Cubic AI code review on uncommitted changes or branch diff |
| `/cubic:wiki [page-name]`        | Browse AI-generated codebase documentation                             |
| `/cubic:scan [scan-id]`          | View codebase security scan results and violations                     |
| `/cubic:learnings [learning-id]` | Show team code review patterns and preferences                         |

## Skills (Auto-triggered)

These activate automatically based on what you're doing:

| Skill                 | Triggers when                                  | What it does                                                       |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| **review-violations** | Working on a PR branch, fixing review comments | Surfaces relevant Cubic review violations for files you're editing |
| **codebase-context**  | Asking about architecture or how things work   | Queries the Cubic AI Wiki for architectural context                |
| **review-patterns**   | Writing or reviewing code                      | Pulls team learnings to apply coding conventions                   |

## MCP Tools

The plugin connects to Cubic's MCP server, giving Claude access to 9 tools:

**Wiki**: `list_wikis`, `list_wiki_pages`, `get_wiki_page`
**Codebase Scans**: `list_scans`, `get_scan`, `get_violation`
**Review Learnings**: `list_learnings`, `get_learning`
**PR Reviews**: `get_pr_violations`

## Plugin Structure

```
cubic-claude-plugin/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata
├── .mcp.json              # Cubic MCP server configuration
├── commands/
│   ├── comments.md        # /cubic:comments command
│   ├── run-review.md      # /cubic:run-review command (CLI)
│   ├── wiki.md            # /cubic:wiki command
│   ├── scan.md            # /cubic:scan command
│   └── learnings.md       # /cubic:learnings command
├── skills/
│   ├── review-violations/ # Auto-surfaces PR review violations
│   │   └── SKILL.md
│   ├── codebase-context/  # Auto-queries wiki for architecture context
│   │   └── SKILL.md
│   └── review-patterns/   # Auto-applies team review learnings
│       └── SKILL.md
└── README.md
```

## Development

Test the plugin locally during development:

```bash
claude --plugin-dir ./cubic-claude-plugin
```

## License

MIT
