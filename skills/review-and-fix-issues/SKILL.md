---
name: review-and-fix-issues
description: Use when the user says "check cubic comments", "cubic issues", "cubic feedback", "cubic code review", "fix issues", "address review", or is working on a pull request branch with open review comments. Fetches all PR issues from cubic, investigates each one, and reports back which are worth fixing before taking action.
---

# Review and Fix Issues

This skill fetches all AI code review issues from cubic for the current PR, investigates each one against the actual code, and reports back to the user with a prioritized assessment before fixing anything.

## When to Activate

- User says "check cubic comments", "cubic issues", "cubic feedback", or "cubic code review"
- User mentions fixing review comments or addressing feedback
- User is on a feature branch with an open PR
- User asks what cubic found or what needs to be fixed

## How to Use

### Step 1: Communicate the plan

Tell the user:

> I'll fetch all the issues cubic found on this PR, investigate each one, and report back with which ones are worth fixing. Give me a moment.

### Step 2: Gather issues

1. Detect the current repository from git remote: `git remote get-url origin`
2. Detect the current branch: `git branch --show-current`
3. Find the PR number: `gh pr view --json number --jq .number`
4. Call `get_pr_issues` with repo, pullNumber, and owner to get all published issues

### Step 3: Investigate each issue

For every issue returned, read the relevant code at the flagged location and assess:

- Is the issue still present in the current code, or was it already addressed?
- Is it a real problem (bug, security, correctness) or a stylistic nitpick?
- How much effort would it take to fix?
- Could fixing it introduce regressions?

### Step 4: Report back

Present a summary table to the user with your recommendation for each issue:

- **Fix** — Real problem, worth addressing
- **Skip** — Nitpick, already addressed, or not applicable
- **Discuss** — Ambiguous, needs user input before deciding

Group by recommendation. For each issue, include: file, line, severity, one-line summary, and your reasoning.

### Step 5: Wait for the user

Do NOT start fixing anything until the user confirms which issues to address. The user decides.

## Presentation

- Lead with the summary table so the user gets the full picture immediately
- Be concise in reasoning — one sentence per issue is enough
- If all issues are already addressed, say so and congratulate the user
- If no PR is found, tell the user and suggest they push their branch first
