#!/usr/bin/env python3
"""
Beads Integration Helper
Provides functions for creating and managing Beads issues from Python scripts.
"""

import subprocess
import json
import os
from typing import Optional, Dict, List


def ensure_bd_in_path():
    """Add bd to PATH if not already there."""
    go_bin = os.path.expanduser("~/go/bin")
    usr_local_go_bin = "/usr/local/go/bin"

    current_path = os.environ.get("PATH", "")
    if go_bin not in current_path:
        os.environ["PATH"] = f"{go_bin}:{current_path}"
    if usr_local_go_bin not in current_path:
        os.environ["PATH"] = f"{usr_local_go_bin}:{os.environ['PATH']}"


def bd_command(args: List[str], capture_json: bool = True) -> Optional[Dict]:
    """
    Execute a bd command and optionally parse JSON output.

    Args:
        args: Command arguments (e.g., ['create', 'Title', '-p', '1'])
        capture_json: If True, adds --json and parses output

    Returns:
        Parsed JSON dict if capture_json=True, else None
    """
    ensure_bd_in_path()

    cmd = ["bd"] + args
    if capture_json and "--json" not in args:
        cmd.append("--json")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )

        if capture_json:
            # Handle multiple JSON objects (one per line for some commands)
            lines = result.stdout.strip().split('\n')
            if len(lines) == 1:
                return json.loads(lines[0])
            else:
                return [json.loads(line) for line in lines if line.strip()]
        return None

    except subprocess.CalledProcessError as e:
        print(f"Error running bd command: {e}")
        print(f"stderr: {e.stderr}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print(f"stdout: {result.stdout}")
        return None


def create_issue(
    title: str,
    description: str = "",
    priority: int = 2,
    issue_type: str = "task",
    labels: List[str] = None,
    assignee: str = None
) -> Optional[str]:
    """
    Create a new issue in Beads.

    Returns:
        Issue ID (e.g., 'wayback-5') or None if failed
    """
    args = ["create", title, "-p", str(priority), "-t", issue_type]

    if description:
        args.extend(["-d", description])
    if labels:
        args.extend(["-l", ",".join(labels)])
    if assignee:
        args.extend(["-a", assignee])

    result = bd_command(args, capture_json=True)
    return result.get("id") if result else None


def update_issue(issue_id: str, **kwargs) -> bool:
    """
    Update an existing issue.

    Supported kwargs:
        - status: str ('open', 'in_progress', 'closed')
        - priority: int (0-4)
        - description: str
        - assignee: str

    Returns:
        True if successful
    """
    args = ["update", issue_id]

    for key, value in kwargs.items():
        args.extend([f"--{key}", str(value)])

    result = bd_command(args, capture_json=True)
    return result is not None


def close_issue(issue_id: str, reason: str = "Completed") -> bool:
    """Close an issue with a reason."""
    result = bd_command(["close", issue_id, "--reason", reason], capture_json=True)
    return result is not None


def add_dependency(from_id: str, to_id: str, dep_type: str = "blocks") -> bool:
    """
    Add a dependency between two issues.

    Args:
        from_id: The dependent issue
        to_id: The issue it depends on
        dep_type: 'blocks', 'related', 'parent-child', or 'discovered-from'

    Returns:
        True if successful
    """
    result = bd_command(
        ["dep", "add", from_id, to_id, "--type", dep_type],
        capture_json=False
    )
    return True  # Command doesn't output JSON, assume success if no exception


def get_ready_work(limit: int = None) -> List[Dict]:
    """
    Get list of ready issues (no blockers).

    Returns:
        List of issue dicts
    """
    args = ["ready"]
    if limit:
        args.extend(["--limit", str(limit)])

    result = bd_command(args, capture_json=True)
    return result if isinstance(result, list) else []


def get_issue(issue_id: str) -> Optional[Dict]:
    """Get details of a specific issue."""
    result = bd_command(["show", issue_id], capture_json=True)
    return result


def list_issues(status: str = None, priority: int = None) -> List[Dict]:
    """
    List issues with optional filters.

    Args:
        status: Filter by status ('open', 'in_progress', 'closed')
        priority: Filter by priority (0-4)

    Returns:
        List of issue dicts
    """
    args = ["list"]
    if status:
        args.extend(["--status", status])
    if priority is not None:
        args.extend(["--priority", str(priority)])

    result = bd_command(args, capture_json=True)
    return result if isinstance(result, list) else []


# Example usage
if __name__ == "__main__":
    # Create an issue for a discovered page
    issue_id = create_issue(
        title="Download /about.html",
        description="Discovered while crawling index page",
        priority=2,
        issue_type="task",
        labels=["crawler", "discovered"]
    )

    if issue_id:
        print(f"Created issue: {issue_id}")

        # Mark it as in progress
        update_issue(issue_id, status="in_progress")

        # Add discovered-from relationship
        add_dependency(issue_id, "wayback-5", dep_type="discovered-from")

        # Get ready work
        ready = get_ready_work(limit=5)
        print(f"Ready work: {len(ready)} issues")
