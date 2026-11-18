import { formatBytes } from "@devsbucket/shared/bytes";
import { toast } from "sonner";
import { checkZip } from "@/app/drive/zip-actions";

// "Download as ZIP" (Phase 5): ask the server whether the folder fits, then
// let the browser download the ZIP from the route (the page stays put, as
// the route answers with an attachment). One toast follows it: "Preparing"
// while the server counts the files, then what's coming. The ZIP is built
// while it downloads, so the browser's own download progress is the
// zipping progress (a page can't watch a download it didn't fetch itself,
// and fetching it here would hold up to 1 GB in the tab).
export const downloadFolderZip = async (folder: { id: string; name: string }) => {
  const zipName = `${folder.name}.zip`;
  const id = toast.loading(`Preparing "${zipName}"…`);
  const result = await checkZip({ itemId: folder.id });
  if (result.error !== null) {
    toast.error(result.error, { id });
    return;
  }
  window.location.assign(`/api/items/${folder.id}/zip`);
  toast.success(`Downloading "${zipName}"`, {
    id,
    description: `${result.files} ${result.files === 1 ? "file" : "files"}, ${formatBytes(result.bytes)}. Your browser shows the progress.`,
  });
};
