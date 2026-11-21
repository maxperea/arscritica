#!/usr/bin/env bash
set -euo pipefail

covers_dir="${COVERS_DIR:-apps/web/public/covers}"
branch="covers"

case "${1:-}" in
  restore)
    mkdir -p "$covers_dir"
    if git fetch --quiet --depth=1 origin "$branch"; then
      git archive FETCH_HEAD | tar -x -C "$covers_dir"
      echo "Restored $(find "$covers_dir" -name '*.webp' | wc -l | tr -d ' ') cover thumbnails from the $branch branch."
    else
      echo "No $branch branch yet; lists use the original cover URLs."
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
    find "$covers_dir" -maxdepth 1 \( -name '*.webp' -o -name failures.json \) -exec cp {} "$worktree/" \;
    git -C "$worktree" add -A .
    if git -C "$worktree" diff --cached --quiet; then
      echo "Cover thumbnails unchanged."
    else
      git -C "$worktree" \
        -c user.name="github-actions[bot]" \
        -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
        commit --quiet -m "Update cover thumbnails"
      git -C "$worktree" push --quiet origin "HEAD:refs/heads/$branch"
      echo "Pushed cover thumbnails to the $branch branch."
    fi
    git worktree remove --force "$worktree"
    ;;
  *)
    echo "usage: $0 restore|persist" >&2
    exit 1
    ;;
esac
