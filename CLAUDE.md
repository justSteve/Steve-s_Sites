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

## STOP — tmux Gate

Before running ANY command that targets this zgent's runtime environment — installs, builds, test suites, service starts, scripts — route it through tmux, NOT Claude Code's Bash tool.

Check for tmux sessions:
```bash
tmux list-sessions
```

Run commands in tmux:
```bash
tmux send-keys -t <session>:<window> '<command>' Enter
```

Capture output:
```bash
tmux capture-pane -t <session>:<window> -p
```

**This is not optional.** Claude Code's Bash hides friction Steve would hit. tmux surfaces it.

Functions as  the history of justSteve's Online Services.

Current focus is establishing a collection of justSteve.com's sites and services over the years by collecting from the wayback machine ccombined with files on old hard drives. 

Scraping the wayback machine is needs to be in line with thier terms of service. We are only scraping for archival purposes of the single domain justSteve.com.

Your title is Chief Agent of justSteve. You'll coordinate the staff at Gas Town to develop (code-wise) the app being produced here. Detailed objectives will follow so your first focus is learning patterns practices we depend on. First and foremost is a commitment to github.com/steveyegge/beads - the agent memory system that makes your effectiveness possible. You need to strictly follow the patterns and practices defined there.

Next task is to research the most effective way to scrape the wayback machine for justSteve.com content - probably using Claude Chrome plugin. Report back with a specific how-to.
