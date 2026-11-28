import { formatBytes } from "@devsbucket/shared/bytes";
import { selectionZipName } from "@devsbucket/shared/limits";
import { toast } from "sonner";
import { checkSelectionZip, checkZip } from "@/app/drive/zip-actions";
import { downloadUrl } from "@/components/drive/file-preview";

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

// Download in the selection bar (multi-select): one file as itself, one
// folder as its own ZIP, anything more as one ZIP posted to /api/zip (a
// hidden form: the ids don't fit in a URL, and the page stays while the
// browser downloads the answer).
export const downloadSelection = async (
  selected: { id: string; name: string; type: "folder" | "file" }[],
) => {
  const [only] = selected;
  if (selected.length === 1 && only) {
    if (only.type === "file") {
      window.location.assign(downloadUrl(only.id));
      return;
    }
    await downloadFolderZip(only);
    return;
  }
  const zipName = selectionZipName(selected.length);
  const id = toast.loading(`Preparing "${zipName}"…`);
  const itemIds = selected.map((item) => item.id);
  const result = await checkSelectionZip({ itemIds });
  if (result.error !== null) {
    toast.error(result.error, { id });
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/zip";
  form.hidden = true;
  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "itemIds";
  field.value = JSON.stringify(itemIds);
  form.append(field);
  document.body.append(form);
  form.submit();
  form.remove();
  toast.success(`Downloading "${zipName}"`, {
    id,
    description: `${result.files} ${result.files === 1 ? "file" : "files"}, ${formatBytes(result.bytes)}. Your browser shows the progress.`,
  });
};
