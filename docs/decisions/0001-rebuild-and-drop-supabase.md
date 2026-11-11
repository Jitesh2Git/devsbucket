# 0001: Rebuild from scratch and drop Supabase

Date: 2026-11-11 · Status: accepted

## Context

The first DevsBucket (Next.js 15 + Supabase + Prisma) was slow and insecure.

- **Slow:** every page waited on a chain of requests in the browser (auth check, then user, then folders, then files). Pages loaded every folder, file and share at once. Realtime subscribed to whole tables and refetched everything on any change. Uploads went through server actions.
- **Insecure:** server actions trusted the `userId` and `fileId` sent by the browser, with no ownership checks. The storage bucket was public, so "sharing" protected nothing. There was no RLS, and the whole-table realtime feed sent other users' events to every browser.

## Decision

Build a new repo phase by phase, self-hosted for $0:

- an Oracle Always Free ARM VM running Docker Compose,
- Postgres 18 and Drizzle,
- Better Auth,
- Cloudflare R2,
- Yjs + Hocuspocus,
- Postgres LISTEN/NOTIFY and pg-boss.

The full stack is in `docs/LOCKED.md`.

## Why / alternatives rejected

- **Supabase free tier:** 1 GB storage and a 500 MB database for the whole project, and projects pause when inactive. Its RLS model would also be bypassed by any ORM.
- **Full AWS:** new accounts get only about 6 months of credits, then paid.
- **Liveblocks:** a hosted service with a limited free tier.
- **Vercel for the web app:** no WebSockets, and a 4.5 MB request body limit.
