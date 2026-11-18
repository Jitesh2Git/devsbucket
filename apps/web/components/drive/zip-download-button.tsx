"use client";

import { FolderDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFolderZip } from "@/lib/zip-download";

// "Download as ZIP" in a folder page's header (any role).
const ZipDownloadButton = ({ folder }: { folder: { id: string; name: string } }) => {
  return (
    <Button variant="outline" onClick={() => downloadFolderZip(folder)}>
      <FolderDown />
      Download as ZIP
    </Button>
  );
};

export default ZipDownloadButton;
