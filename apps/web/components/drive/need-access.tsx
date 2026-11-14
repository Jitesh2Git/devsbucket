import { getPendingRequest } from "@devsbucket/db/access-requests";
import { Lock } from "lucide-react";
import RequestAccessForm from "@/components/drive/request-access-form";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type NeedAccessProps = { itemId: string; userId: string };

// For a signed-in person who opens an item that exists but isn't shared with
// them (decision 0008). It never shows the item's name. They can ask for
// access; a request already sent shows as pending.
const NeedAccess = async ({ itemId, userId }: NeedAccessProps) => {
  const pending = await getPendingRequest(itemId, userId);
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>You need access</EmptyTitle>
        <EmptyDescription>
          This isn't shared with you. Ask for access, or ask its owner to share it with your
          account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <RequestAccessForm itemId={itemId} pendingRole={pending?.role ?? null} />
      </EmptyContent>
    </Empty>
  );
};

export default NeedAccess;
