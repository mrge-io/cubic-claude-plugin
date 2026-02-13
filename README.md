# cubic Plugin for Claude Code

Access cubic's AI code review insights directly from Claude Code. Get PR review issues, browse AI-generated wikis, check codebase scans, and apply team review learnings — all without leaving your editor.

## Prerequisites

- [Claude Code](https://code.claude.com) v1.0.33+
- A [cubic](https://www.cubic.dev) account with an active installation
- A cubic API key (`cbk_*`)
- (Optional) [cubic CLI](https://cubic.dev/install) for `/cubic:run-review`

## Installation

### From GitHub (recommended)

```bash
# Step 1: Add the cubic marketplace
/plugin marketplace add mrge-io/cubic-claude-plugin

# Step 2: Install the plugin
/plugin install cubic@cubic
```

> **Requires** [Claude Code](https://code.claude.com) v1.0.33+

### Team Auto-Install

To make cubic automatically available for all team members in a repository, add this to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "cubic": {
      "source": {
        "source": "github",
        "repo": "mrge-io/cubic-claude-plugin"
      }
    }
  },
  "enabledPlugins": {
    "cubic@cubic": true
  }
}
```

When team members open the project in Claude Code and trust the repository, they'll be prompted to install the plugin.

## Setup

1. Generate an API key from your [cubic dashboard](https://www.cubic.dev/settings?tab=integrations&integration=mcp)
2. Set the environment variable:

```bash
export CUBIC_API_KEY=cbk_your_api_key_here
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) so it persists across sessions.

> **Tip:** You can also just tell Claude Code "set up my cubic key" and paste your key — the `env-setup` skill will detect your OS and shell and save it automatically.

## Commands

| Command                          | Description                                                            |
| -------------------------------- | ---------------------------------------------------------------------- |
| `/cubic:comments [pr-number]`    | Show cubic's review comments on the current PR (auto-detects branch)   |
| `/cubic:run-review [flags]`      | Run a local cubic AI code review on uncommitted changes or branch diff |
| `/cubic:wiki [page-name]`        | Browse AI-generated codebase documentation                             |
| `/cubic:scan [scan-id]`          | View codebase security scan results and issues                    |
| `/cubic:learnings [learning-id]` | Show team code review patterns and preferences                         |

## Skills (Auto-triggered)

These activate automatically based on what you're doing:

| Skill                 | Triggers when                                  | What it does                                                       |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| **review-issues** | Working on a PR branch, fixing review comments | Surfaces relevant cubic review issues for files you're editing |
| **codebase-context**  | Asking about architecture or how things work   | Queries the cubic AI Wiki for architectural context                |
| **review-patterns**   | Writing or reviewing code                      | Pulls team learnings to apply coding conventions                   |
| **env-setup**         | Setting up cubic, pasting an API key           | Detects OS and shell, persists API key to shell config             |

## MCP Tools

The plugin connects to cubic's MCP server, giving Claude access to 9 tools:

**Wiki**: `list_wikis`, `list_wiki_pages`, `get_wiki_page`
**Codebase Scans**: `list_scans`, `get_scan`, `get_violation`
**Review Learnings**: `list_learnings`, `get_learning`
**PR Reviews**: `get_pr_violations`

## Plugin Structure

```
cubic-claude-plugin/
├── .claude-plugin/
│   ├── marketplace.json   # Marketplace catalog for distribution
│   └── plugin.json        # Plugin metadata
├── .mcp.json              # cubic MCP server configuration
├── commands/
│   ├── comments.md        # /cubic:comments command
│   ├── run-review.md      # /cubic:run-review command (CLI)
│   ├── wiki.md            # /cubic:wiki command
│   ├── scan.md            # /cubic:scan command
│   └── learnings.md       # /cubic:learnings command
├── skills/
│   ├── review-issues/     # Auto-surfaces PR review issues
│   │   └── SKILL.md
│   ├── codebase-context/  # Auto-queries wiki for architecture context
│   │   └── SKILL.md
│   ├── review-patterns/   # Auto-applies team review learnings
│   │   └── SKILL.md
│   └── env-setup/         # Auto-detects OS/shell and persists API key
│       └── SKILL.md
└── README.md
```

## License

MIT
