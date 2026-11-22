import { previewKind } from "@devsbucket/shared/preview";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  type LucideProps,
} from "lucide-react";

const ARCHIVE = /\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/i;

// An item's icon, from its type and name: a folder, or a file by kind.
const ItemIcon = ({
  item,
  ...props
}: { item: { type: "folder" | "file"; name: string; mimeType: string | null } } & LucideProps) => {
  if (item.type === "folder") return <Folder {...props} />;
  if (ARCHIVE.test(item.name)) return <FileArchive {...props} />;
  switch (previewKind(item.name, item.mimeType)) {
    case "image":
      return <FileImage {...props} />;
    case "video":
      return <FileVideo {...props} />;
    case "audio":
      return <FileAudio {...props} />;
    case "pdf":
      return <FileText {...props} />;
    case "text":
      return <FileCode {...props} />;
    default:
      return <File {...props} />;
  }
};

export default ItemIcon;
