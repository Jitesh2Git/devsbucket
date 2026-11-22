# 0019: Share by @username, and change your name

Date: 2026-11-22 · Status: accepted

## Context

Decision 0008 shares with existing accounts by email. Phase 1 added a unique username on the profile ("how other people find you when sharing"), but sharing never used it, so the username did nothing. The display name could only be set at sign-up.

## Decision

- **Share by email or @username.** The Share dialog's field takes either ("Email or @username"; a username works with or without its "@"). `personRefSchema` (`@devsbucket/shared/sharing`) reads which one it is; the action looks the person up by email or by username (`findUserByUsername`). Still only existing accounts, still Editor or Viewer; everything else in 0008 stays.
- **Usernames are shown** in the share dialog's people list (`@username · email`).
- **Change your name** on the profile, through Better Auth's `updateUser` (it also refreshes the session, so the header follows). Same rule as sign-up (`nameSchema`, 1–100 characters).

## Why / alternatives rejected

- **Drop the username:** simpler, but sharing by a short handle is quicker than typing an email and doesn't need someone's email.
- **Search people by name:** a picker that lists accounts would show every user's name to everyone; typing an exact username or email keeps that private.
