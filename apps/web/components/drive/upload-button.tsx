"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { useUploads } from "@/components/drive/uploads-provider";
import { Button } from "@/components/ui/button";

// "Upload": opens the file picker; the chosen files go to the uploads panel.
const UploadButton = ({ parentId }: { parentId: string | null }) => {
  const { startUploads } = useUploads();
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button variant="outline" onClick={() => input.current?.click()}>
        <Upload />
        Upload
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label="Upload files"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            startUploads(files, parentId);
          }
          // Picking the same file again still fires onChange.
          event.target.value = "";
        }}
      />
    </>
  );
};

export default UploadButton;
