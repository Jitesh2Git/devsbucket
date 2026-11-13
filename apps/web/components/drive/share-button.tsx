"use client";

import { UserPlus } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import ShareDialog, { type ShareTarget } from "@/components/drive/share-dialog";
import { Button } from "@/components/ui/button";

// "Share" in a folder's header: the same dialog as the row menu.
const ShareButton = ({ folder }: { folder: ShareTarget }) => {
  const [open, setOpen] = useState(false);
  // Leaving the page only hides it (Activity): close the dialog.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus />
        Share
      </Button>
      <ShareDialog item={open ? folder : null} onClose={() => setOpen(false)} />
    </>
  );
};

export default ShareButton;
