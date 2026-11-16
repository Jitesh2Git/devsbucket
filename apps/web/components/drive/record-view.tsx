"use client";

import { useEffect } from "react";
import { recordFileView } from "@/app/drive/recent-actions";

// Renders nothing: records that the user opened this file (Recent). In an
// effect, not while the server renders the page, so prefetching a link
// doesn't count as opening it. Next hides a page you leave and shows it
// again when you come back (React Activity), which runs the effect again:
// coming back counts as opening it again.
const RecordView = ({ itemId }: { itemId: string }) => {
  useEffect(() => {
    void recordFileView({ itemId });
  }, [itemId]);
  return null;
};

export default RecordView;
