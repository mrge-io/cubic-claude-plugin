---
name: scan
description: Show cubic codebase scan results and security issues
argument-hint: [scan-id]
allowed-tools: [Bash, cubic:list_scans, cubic:get_scan, cubic:get_issue]
---

# cubic Codebase Scan

Show codebase scan results from cubic, including security vulnerabilities and code quality issues.

## Arguments

If a scan ID was provided: $ARGUMENTS

## Instructions

1. **Detect the repository**: Run `git remote get-url origin` to extract the owner and repo name.

2. **If a scan ID was provided**: Call `get_scan` with the scanId to get detailed results.

3. **If no scan ID was provided**: Call `list_scans` with the owner and repo to show recent scans. Present them with status, issue count, and date.

4. **Show issues**: When displaying scan results, group issues by category (Security, Data Integrity, Business Logic, Stability). For each issue show severity, file location, and summary.

5. **Dive deeper**: If the user asks about a specific issue, call `get_issue` with the issue's ID to show the full analysis report, code context, and remediation guidance.
