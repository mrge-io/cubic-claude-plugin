---
name: codebase-context
description: Use when the user asks about codebase architecture, "how does X work", system design, onboarding to a project, or needs context about how parts of the codebase connect. Queries Cubic's AI Wiki for the current repository to provide architectural context.
---

# Codebase Context from Wiki

This skill queries Cubic's AI-generated wiki to provide architectural context about the codebase.

## When to Activate

- User asks how a system or feature works
- User is onboarding to a new codebase
- User needs to understand how components connect
- User asks about architecture, data flow, or system design
- User is making changes that span multiple modules and needs context

## How to Use

1. Detect the current repository from git remote: `git remote get-url origin`
2. Call `list_wiki_pages` with the owner and repo to discover available documentation
3. Find wiki pages relevant to the user's question by matching page titles and descriptions
4. Call `get_wiki_page` for the most relevant pages
5. Synthesize the wiki content into a focused answer for the user's specific question

## Presentation

- Summarize the relevant wiki content, don't dump the entire page
- Reference specific wiki pages so the user can explore further
- Connect wiki knowledge to the specific files or modules the user is working with
- If no wiki exists for this repo, suggest the user set one up in the Cubic dashboard
