import { PART_SIZE, type Part } from "@devsbucket/shared/limits";

// Uploads go straight from the browser to storage with presigned URLs.
// XMLHttpRequest, not fetch: only XHR reports upload progress.

// One PUT. Resolves with the ETag storage sends back (multipart needs it).
const xhrPut = ({
  url,
  body,
  contentType,
  onProgress,
  signal,
}: {
  url: string;
  body: Blob;
  contentType?: string;
  onProgress: (loadedBytes: number) => void;
  signal: AbortSignal;
}) =>
  new Promise<string | null>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Readable because the bucket's CORS exposes it (storage:setup).
        resolve(xhr.getResponseHeader("ETag"));
      } else {
        reject(new Error(`Storage answered ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(signal.reason);
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });

// A file up to 50 MB in one PUT. The Content-Type must be the one the URL
// was signed with, or storage refuses the upload.
export const putFile = async ({
  url,
  file,
  contentType,
  onProgress,
  signal,
}: {
  url: string;
  file: File;
  contentType: string;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}) => {
  await xhrPut({
    url,
    body: file,
    contentType,
    onProgress: (loaded) => onProgress(file.size > 0 ? loaded / file.size : 1),
    signal,
  });
};

// Parts uploaded at the same time, per file.
const PARALLEL_PARTS = 3;

// A larger file in 10 MB parts, 3 at a time. Returns each part's ETag in
// order, for completeUpload. If one part fails, the others stop too.
export const putParts = async ({
  parts,
  file,
  onProgress,
  signal,
}: {
  parts: { partNumber: number; size: number; url: string }[];
  file: File;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}) => {
  const controller = new AbortController();
  signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  const loaded = parts.map(() => 0);
  const uploaded: Part[] = [];
  let next = 0;

  // Each worker takes the next part until none are left.
  const worker = async () => {
    while (next < parts.length) {
      const index = next;
      next += 1;
      const part = parts[index];
      if (!part) break;
      const start = (part.partNumber - 1) * PART_SIZE;
      const etag = await xhrPut({
        url: part.url,
        // A slice is a view of the file on disk, not a copy in memory.
        body: file.slice(start, start + part.size),
        onProgress: (bytes) => {
          loaded[index] = bytes;
          onProgress(loaded.reduce((sum, n) => sum + n, 0) / file.size);
        },
        signal: controller.signal,
      });
      if (!etag) {
        throw new Error("Storage sent no ETag");
      }
      uploaded[index] = { partNumber: part.partNumber, etag };
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, parts.length) }, worker));
  } catch (error) {
    controller.abort(error);
    throw error;
  }
  return uploaded;
};
