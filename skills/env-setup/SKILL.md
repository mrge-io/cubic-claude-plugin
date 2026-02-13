---
name: env-setup
description: Use when the user wants to set up, install, or configure their cubic API key, says "configure cubic", "set up cubic", "install cubic key", pastes a key starting with "cbk_", or encounters authentication errors with the cubic plugin. Detects the user's OS and shell and persists the key to the correct shell configuration file.
---

# cubic API Key Setup

This skill detects the user's OS and shell, then persists the cubic API key to the correct shell configuration file so the plugin can connect to cubic's MCP server.

## When to Activate

- User says "set up cubic", "configure cubic", "install my API key"
- User pastes a key starting with `cbk_` and wants to save it
- User asks how to set or persist `CUBIC_API_KEY`
- User encounters authentication errors and wants to fix their key
- User asks "how do I connect cubic" or "cubic isn't working"

## How to Use

1. **Extract the API key** from the user's message. It starts with `cbk_`. If the user didn't provide one, tell them to generate a key at https://www.cubic.dev/settings?tab=integrations&integration=mcp and paste it.

2. **Validate** the key starts with `cbk_`. If not, ask the user to double-check.

3. **Check if already configured**:

   ```bash
   echo "CURRENT_KEY=${CUBIC_API_KEY:-unset}"
   ```

   If a key is already set, tell the user and ask if they want to replace it.

4. **Detect OS and shell**:

   ```bash
   echo "OS=$(uname -s) SHELL_NAME=$(basename "$SHELL")"
   ```

5. **Determine the config file**:

   | OS output                | Shell  | Config file                  |
   | ------------------------ | ------ | ---------------------------- |
   | `Darwin`                 | `zsh`  | `~/.zshrc`                   |
   | `Darwin`                 | `bash` | `~/.bash_profile`            |
   | `Linux`                  | `bash` | `~/.bashrc`                  |
   | `Linux`                  | `zsh`  | `~/.zshrc`                   |
   | `Linux`                  | `fish` | `~/.config/fish/config.fish` |
   | `MINGW64_NT*`/`MSYS_NT*` | `bash` | `~/.bashrc`                  |

   If the config file doesn't exist, it will be created.

6. **Check for existing key** in the config file:

   ```bash
   grep -n "CUBIC_API_KEY" <config_file> 2>/dev/null || echo "NOT_FOUND"
   ```

   - If found: replace the existing line using `sed`
   - If not found: append a new line

7. **Write the export**:
   - For bash/zsh, append or replace:
     ```
     export CUBIC_API_KEY=cbk_...
     ```
   - For fish, append or replace:
     ```
     set -gx CUBIC_API_KEY cbk_...
     ```

   When replacing with `sed`, use `sed -i ''` on macOS (Darwin) and `sed -i` on Linux and Windows (MINGW/MSYS).

8. **Source the config** to apply immediately:

   ```bash
   source <config_file> && echo "CUBIC_API_KEY=$CUBIC_API_KEY"
   ```

   For fish, tell the user to run `source ~/.config/fish/config.fish` or restart their terminal.

9. **Verify** the key is set:
   ```bash
   echo "CUBIC_API_KEY=$CUBIC_API_KEY"
   ```

## Presentation

- Confirm which config file was updated and that the key is active in the current session
- Suggest trying `/cubic:wiki` or `/cubic:comments` to verify the connection
- If replacing an existing key, mention the old key was overwritten
- Keep output brief — this is a setup step, not a tutorial
