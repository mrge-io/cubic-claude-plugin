---
description: Browse Cubic AI Wiki documentation for a repository
argument-hint: [page-name]
allowed-tools: [Bash, cubic:list_wikis, cubic:list_wiki_pages, cubic:get_wiki_page]
---

# Cubic Wiki

Browse the AI-generated wiki documentation for the current repository.

## Arguments

If a page name was provided: $ARGUMENTS

## Instructions

1. **Detect the repository**: Run `git remote get-url origin` to extract the owner and repo name.

2. **If a page name was provided**: Call `list_wiki_pages` with the owner and repo, find the page matching the argument, then call `get_wiki_page` with its pageRef.

3. **If no page name was provided**: Call `list_wiki_pages` with the owner and repo. Present the list of available pages with their titles and descriptions so the user can choose one.

4. **Display the content**: When showing a wiki page, format it clearly with the page title as a header and the full content below.

5. **If no wiki exists**: Tell the user that no wiki has been generated yet for this repository and suggest they set one up in the Cubic dashboard.
