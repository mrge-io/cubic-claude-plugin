---
description: Show what this team cares about in code reviews (Cubic learnings)
argument-hint: [learning-id]
allowed-tools: [Bash, cubic:list_learnings, cubic:get_learning]
---

# Cubic Review Learnings

Show the team's code review patterns and preferences that Cubic has learned from senior reviewer feedback, user corrections, and codebase scans.

## Arguments

If a learning ID was provided: $ARGUMENTS

## Instructions

1. **Detect the repository**: Run `git remote get-url origin` to extract the owner and repo name.

2. **If a learning ID was provided**: Call `get_learning` with the learningId to show full details.

3. **If no learning ID was provided**: Call `list_learnings` with the owner and repo. Present learnings grouped by category with title, description, confidence level, and source.

4. **Explain the context**: Learnings come from three sources:
   - **Senior Reviewer Analysis**: Patterns learned from how senior engineers review code
   - **User Feedback**: Direct corrections from team members on Cubic's reviews
   - **Codebase Scan Feedback**: Insights from triage decisions on scan violations

5. **Make it actionable**: When showing learnings, explain how they apply to the user's current work. If they're writing code, highlight which learnings are most relevant.
