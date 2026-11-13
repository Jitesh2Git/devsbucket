import { Lock } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// For a signed-in person who opens an item that exists but isn't shared with
// them (decision 0008). It never shows the item's name. Request access
// comes in step 8.
const NeedAccess = () => {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>You need access</EmptyTitle>
        <EmptyDescription>
          This isn't shared with you. Ask its owner to share it with your account.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export default NeedAccess;
