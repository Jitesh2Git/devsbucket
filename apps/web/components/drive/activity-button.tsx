"use client";

import { ActivityIcon } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import ActivityDialog, { type ActivityTarget } from "@/components/drive/activity-dialog";
import { Button } from "@/components/ui/button";

// "Activity" in the file page's header (Owner and Editors).
const ActivityButton = ({ item }: { item: ActivityTarget }) => {
  const [open, setOpen] = useState(false);
  // Leaving the page only hides it (React Activity): close the dialog.
  useLayoutEffect(() => () => setOpen(false), []);
  return (
    <>
      <Button variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
        <ActivityIcon />
        Activity
      </Button>
      <ActivityDialog item={open ? item : null} onClose={() => setOpen(false)} />
    </>
  );
};

export default ActivityButton;
