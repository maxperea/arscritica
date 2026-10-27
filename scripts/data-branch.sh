#!/usr/bin/env bash
set -euo pipefail

db_file="data/arscritica.db"
branch="data"

case "${1:-}" in
  restore)
    mkdir -p "$(dirname "$db_file")"
    if git fetch --quiet --depth=1 origin "$branch"; then
      git show FETCH_HEAD:arscritica.db > "$db_file"
      echo "Restored $db_file from the $branch branch."
    else
      echo "No $branch branch yet; starting with an empty database."
    fi
    ;;
  persist)
    worktree="$(mktemp -d)"
    if git fetch --quiet origin "$branch"; then
      git worktree add --quiet --detach "$worktree" FETCH_HEAD
    else
      git worktree add --quiet --detach "$worktree"
      git -C "$worktree" checkout --quiet --orphan "$branch"
      git -C "$worktree" rm -rfq .
    fi
    cp "$db_file" "$worktree/arscritica.db"
    git -C "$worktree" add arscritica.db
    if git -C "$worktree" diff --cached --quiet; then
      echo "Database unchanged."
    else
      git -C "$worktree" \
        -c user.name="github-actions[bot]" \
        -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
        commit --quiet -m "Update database"
      git -C "$worktree" push --quiet origin "HEAD:refs/heads/$branch"
      echo "Pushed $db_file to the $branch branch."
    fi
    git worktree remove --force "$worktree"
    ;;
  *)
    echo "usage: $0 restore|persist" >&2
    exit 1
    ;;
esac
