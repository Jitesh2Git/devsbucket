# 0005: How GitHub gets attached to an account

Date: 2026-11-12 · Status: accepted

## Context

Accounts can have two sign-in methods: email and password, and GitHub (Better Auth `accounts` rows `credential` and `github`). The app sends no email (LOCKED.md), so an email typed at password sign-up is never verified. A GitHub sign-up's email is verified by GitHub.

By default Better Auth links GitHub to an existing account automatically when someone signs in with GitHub and an account with the same, verified email exists. In testing (step 12d) that made **Disconnect** pointless: the next "Continue with GitHub" silently reconnected it.

## Decision

GitHub is attached to an account in exactly two ways:

1. **Sign up with GitHub** (with an invite), which creates a new account.
2. **Connect** on the profile page, which links to whoever is signed in.

Better Auth config (`apps/web/lib/auth.ts`, `account.accountLinking`):

- `disableImplicitLinking: true`: "Continue with GitHub" never attaches GitHub to an existing account. The user sees "An account with this email already exists. Sign in with your email and password, then connect GitHub from your profile."
- `allowDifferentEmails: true`: Connect works even when the GitHub email differs from the account's (it links by session, not by email).
- `updateUserInfoOnLink` off: Connect never renames the account or replaces its picture.
- Disconnect needs another sign-in method (Better Auth refuses to unlink the last one) and a recent sign-in (fresh session).

GitHub-only accounts can add a password ("Set password", Better Auth's server-only `setPassword`), using the email GitHub verified. Nobody can change their email.

## Known gap (accepted for now)

Without email verification, anyone with an invite can sign up with someone else's email. That can't take over anything: GitHub never links to an unverified account, and Connect needs the account's session. But it blocks the real owner from using that email. Mitigations: email-locked invites (`invites.email`), the admin command (later). The real fix is email verification, if the app ever sends email.

## Why / alternatives rejected

- **Better Auth's default (implicit linking for verified emails):** safe, but Disconnect doesn't stick, and accounts change without the user asking.
- **`requireLocalEmailVerified: false`:** would let GitHub link to unverified password accounts. That allows pre-account takeover: someone signs up with the victim's email and a password, the victim later signs in with GitHub and lands in an account the attacker can still open.
- **`updateUserInfoOnLink: true`:** connected accounts got renamed to the GitHub name, which in testing made two accounts look identical in the header.
