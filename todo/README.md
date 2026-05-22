# `todo/` — Persistent Project Plan

This folder is the **source of truth** for outstanding work on AwapiMindmap.
It is committed to the repo so progress survives across sessions, branches,
contributors, and machines.

## Files

- **`plan.md`** — The canonical, checkbox-tracked task list. Organized by phase.
  Every actionable unit is a `- [ ]` checkbox.
- **`branches/<branch-name>.md`** _(optional)_ — In-flight notes for long-lived
  feature branches. Delete the file when the branch merges.

## Rules

1. **Read `plan.md` first** at the start of every session to see what's done
   and what's next.
2. **Only tick a checkbox (`- [x]`) when the change is merged to `main`.**
   Work-in-progress belongs in a branch note, not in the main checkbox.
3. **Every PR that completes a task must tick the matching checkbox in the
   same PR.**
4. **If a task grows, split it** into sub-checkboxes rather than ticking a
   partial item.
5. **If scope changes**, update `plan.md` in a dedicated PR titled
   `plan: <reason>`; don't hide scope changes inside feature PRs.

## Workflow for Copilot / agents

- Always read `plan.md` at the start of a session.
- Pick the next unchecked item in the lowest-numbered open phase.
- Tick the checkbox in the same commit that delivers the work.
- If a task is blocked, add a `> Blocked: <reason>` note below it and move on.
