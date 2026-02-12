---
description: Show cubic's review comments on a pull request
argument-hint: [pr-number]
allowed-tools: [Bash, cubic:get_pr_violations]
---

# cubic PR Comments

Show the review comments that cubic posted on a pull request.

## Arguments

If a PR number was provided: $ARGUMENTS
If not, detect the current PR automatically.

## Instructions

1. **Detect the repository**: Run `git remote get-url origin` to extract the owner and repo name from the remote URL. Parse `owner/repo` from it.

2. **Detect the PR number**: If the user provided a PR number in the arguments, use it. Otherwise:
   - Run `git branch --show-current` to get the current branch
   - Run `gh pr view --json number --jq .number` to find the open PR for this branch
   - If no PR is found, tell the user no open PR exists for this branch

3. **Get comments**: Call `get_pr_violations` with the repo, pullNumber, and owner. This returns all open review issues cubic posted on the PR, grouped by file with full content.

4. **Present results**: Display the comments grouped by file. For each comment show:
   - File and line numbers
   - Severity level
   - The full comment content
