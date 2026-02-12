---
name: review-patterns
description: Use when the user is writing code, reviewing code, asking about code quality standards, or wondering "what does this team care about in reviews". Pulls team-specific review learnings from cubic to apply the team's coding conventions and review preferences.
---

# Team Review Patterns

This skill pulls team-specific code review learnings from cubic to apply the team's conventions when writing or reviewing code.

## When to Activate

- User is writing new code and wants it to match team standards
- User asks about team coding conventions or review preferences
- User is preparing code for review and wants to preemptively fix issues
- User wonders why cubic flags certain patterns

## How to Use

1. Detect the current repository from git remote: `git remote get-url origin`
2. Call `list_learnings` with the owner and repo
3. Filter learnings by relevance to the user's current task:
   - Match learning categories to the type of code being written
   - Prioritize high-confidence learnings
   - Focus on learnings from senior reviewer analysis (highest signal)
4. If a specific learning is relevant, call `get_learning` for full details including the original feedback

## Presentation

- Present learnings as team preferences, not rigid rules
- Connect each learning to the user's current code when possible
- Group related learnings together
- Mention the confidence level so the user can judge how strongly the team feels about each pattern
- If no learnings exist, explain that cubic learns patterns over time from senior reviewer feedback
