import { canAdmin } from "@devsbucket/authz/admin";
import { listInvites, listUsers } from "@devsbucket/db/admin";
import { getAppStorageUsed, getOpsThisMonth } from "@devsbucket/db/usage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import InvitesCard from "@/components/admin/invites-card";
import UsageCard from "@/components/admin/usage-card";
import UsersCard from "@/components/admin/users-card";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

// The real check (proxy.ts only redirects signed-out people). Anyone who
// isn't an admin gets a plain 404: for them, the page doesn't exist.
const AdminContent = async () => {
  const { user } = await requireSession();
  if (!canAdmin(user, "view")) {
    notFound();
  }
  const [users, invites, storageUsed, ops] = await Promise.all([
    listUsers(),
    listInvites(),
    getAppStorageUsed(),
    getOpsThisMonth(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <UsageCard storageUsed={storageUsed} ops={ops} />
      <InvitesCard invites={invites} />
      <UsersCard users={users} me={{ id: user.id, isAdmin: user.isAdmin }} />
    </div>
  );
};

const AdminPage = () => {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <Suspense>
        <AdminContent />
      </Suspense>
    </div>
  );
};

export default AdminPage;
