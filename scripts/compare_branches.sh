#!/usr/bin/env bash
cd /mnt/c/Users/anasb/Downloads/1337-nexus

for b in origin/Auth-Front origin/Yassine origin/admin_moderation origin/feature/user-auth-uuid-resolution origin/feature/30-rtk-003-develop-kanban-backend-with-lexorank-ordering-and-board_revision-guards; do
    echo "=================================================="
    echo "BRANCH: $b"
    echo "=================================================="
    git diff --stat FULL...$b
    echo ""
done
