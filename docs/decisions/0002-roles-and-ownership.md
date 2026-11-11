# 0002: Three roles, tree ownership
Date: 2026-11-11 · Status: accepted

## Context
Sharing needs Drive-like permissions that are easy to reason about.

## Decision
- **Roles:** Owner > Editor > Viewer.
- **Inheritance:** a role granted on a folder covers everything inside it, and the highest role wins.
- **Ownership:** everything in a folder tree belongs to the tree's owner, and uploads count against the owner's quota. `createdBy` records who uploaded each item.
- **Editors** can do almost everything, including sharing (the owner can turn this off).
- **Only the Owner** can delete forever, transfer ownership and change sharing settings.
- **Enforcement:** permissions are checked in the app by one shared `authz` package, backed by one SQL function that resolves roles. A test grid covers every role × action.

## Why / alternatives rejected
- **A separate Manager role:** dropped because it's more complexity than needed. Three roles match Google Drive.
- **Uploader owns the file** (Drive's model): rejected because mixed ownership inside one folder tree makes quotas and transfers harder.
- **Postgres RLS as the main check:** not used for now, because Drizzle connects as a single database role. It can be added later as a second layer.
