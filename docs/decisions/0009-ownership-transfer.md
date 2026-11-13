# 0009: Ownership transfer: offered, accepted, moves the whole tree

Date: 2026-11-13 · Status: accepted

## Context

LOCKED.md lets the Owner transfer ownership. With tree ownership (decision 0002) an item can't have a different owner from the folder it's in, and the quota follows the tree. A transfer therefore moves bytes onto someone else's quota.

## Decision

- The Owner offers an item to someone who **already has access** to it. The offer appears for the recipient (notification + a banner on the item) to **accept** or **decline**; the Owner can cancel it while it's pending. One pending offer per item.
- On accept, in one transaction: check the recipient's quota for the subtree's total size; set `owner_id` on the item and everything inside it; move it to the top of the recipient's My Drive (next free name on a clash, as for uploads); move the bytes from the old owner's `storage_used` to the new owner's; give the old owner an **Editor** grant on it; remove the recipient's now-pointless grants inside it.
- A nested item leaves its folder: it now lives in the recipient's tree. The offer dialog says so.
- Pending uploads, trashed items and items with a pending offer inside the subtree block the transfer, with a message saying which.
- Logged as activity on the item; notifications "ownership transfer offered" (recipient) and "ownership transferred" (old owner) follow LOCKED.md.

## Why / alternatives rejected

- **Transfer without accepting** (old Google Drive): fills someone's quota without asking.
- **Only top-level items:** nothing leaves a folder unexpectedly, but it adds a "move it to My Drive first" step for every transfer. The dialog's warning covers the surprise.
- **Mixed ownership inside a folder** (Drive's model): rejected in 0002.
