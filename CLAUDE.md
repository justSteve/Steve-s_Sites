## STOP — Beads Gate (Read This First)

Before performing ANY substantive work (creating, modifying, or deleting files; running state-changing commands; installing dependencies), you MUST have an authorizing bead.

Check for available work:
```bash
bd ready
```

Create a bead if none exists:
```bash
bd create -t "Brief description of work"
```

Claim work:
```bash
bd update <id> --status in_progress
```

**This is not optional.** No bead = no substantive work. Minor housekeeping (typo fixes, status field updates) is exempt.

## tmux — when it helps, not as a gate

Claude Code's Bash is the default. Reach for tmux when it genuinely adds value:
interactive programs, long-running services that must outlive the session,
live-watch scenarios, or when Steve asks for it. For diagnostics, one-shot
builds, file inspection and anything whose output you need to reason over,
use Bash.

This replaced a hard "STOP — tmux Gate" on 2026-07-29. COO retired the
tmux-first gate enterprise-wide on **2026-04-08** — Steve's finding was that it
cost more overhead than it returned, and sessions were stopping mid-task to ask
for a tmux session before running a three-second check. This repo kept enforcing
the retired gate in its strongest form.

The old text also taught a pattern COO has documented as broken: it showed
`tmux send-keys -t <target> '<command>' Enter` as one call. Combining the
content and the Enter intermittently corrupts the message or drops the Enter.
When you do use send-keys, always make **two** calls:

```bash
tmux send-keys -t "$PANE" 'the command'
tmux send-keys -t "$PANE" Enter
```

Capture is unaffected: `tmux capture-pane -t <target> -p`.

Functions as  the history of justSteve's Online Services.

Current focus is establishing a collection of justSteve.com's sites and services over the years by collecting from the wayback machine ccombined with files on old hard drives. 

Scraping the wayback machine is needs to be in line with thier terms of service. We are only scraping for archival purposes of the single domain justSteve.com.

Your title is Chief Agent of justSteve. You'll coordinate the staff at Gas Town to develop (code-wise) the app being produced here. Detailed objectives will follow so your first focus is learning patterns practices we depend on. First and foremost is a commitment to github.com/steveyegge/beads - the agent memory system that makes your effectiveness possible. You need to strictly follow the patterns and practices defined there.

Next task is to research the most effective way to scrape the wayback machine for justSteve.com content - probably using Claude Chrome plugin. Report back with a specific how-to.
