---
name: review-comments
description: Use when the user says "check cubic comments", "cubic violations", "cubic feedback", "cubic code review", "fix violations", "address review", or is working on a pull request branch with open review comments. Queries Cubic's MCP tools to surface PR review violations relevant to the current work.
---

# PR Review Comments

This skill surfaces AI code review comments and violations from Cubic when working on pull requests.

## When to Activate

- User says "check cubic comments", "cubic violations", "cubic feedback", or "cubic code review"
- User mentions fixing review comments or addressing feedback
- User is on a feature branch with an open PR
- User is editing a file that was flagged in a review
- User asks what Cubic found or what needs to be fixed

## How to Use

1. Detect the current repository from git remote: `git remote get-url origin`
2. Detect the current branch: `git branch --show-current`
3. Find the PR number: `gh pr view --json number --jq .number`
4. Call `get_pr_violations` with repo, pullNumber, and owner to get all published violations with full content
5. Filter violations to prioritize:
   - Files the user is currently editing
   - Unaddressed violations (aiAddressed = false)
   - Higher severity violations first

## Presentation

- Show violations inline when relevant to the current file
- Group by file when showing an overview
- Highlight which violations are still open vs already addressed
- If all violations are addressed, congratulate the user
