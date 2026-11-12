// Sends one file straight to storage with a presigned URL. XMLHttpRequest,
// not fetch: only XHR reports upload progress. The Content-Type must be the
// one the URL was signed with, or storage refuses the upload.
export const putFile = ({
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
}) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage answered ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(signal.reason);
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
