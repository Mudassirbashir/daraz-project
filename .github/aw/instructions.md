# Repository Instructions Overlay for gh-aw Agents

This file defines repository-local workflow authoring standards and guidelines for GitHub Agentic Workflows (`gh-aw`).

## Scope
These rules apply when creating, editing, reviewing, and executing agentic workflows and multi-agent operations in this repository (`daraz-operations-management`).

## Repository Rules & Invariants
1. **CRITICAL INVARIANT**: After any modification to agentic workflow markdown files (`.github/workflows/*.md`), you **must** run a one-shot `gh aw compile` before stopping.
2. **NO AD-HOC MANUAL OVERRIDES**: All agent operations must strictly adhere to instructions in `.github/skills/` and `.github/aw/`.
3. **STRICT DB SCHEMA ISOLATION**: All store data operations must enforce `(store_id, seller_sku)` isolation across catalog items, SKU variations, stock quantities, listings, and orders.
4. **COMPACT LOG & SAFE OUTPUTS**: Always use safe output parsing and humanized error reporting for Daraz API and GitHub Actions triggers.
