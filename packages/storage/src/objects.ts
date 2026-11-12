import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { countOps } from "@devsbucket/db/usage";
import { bucket, s3 } from "./client.ts";

// Objects are stored by item id, never by file name, so renaming or moving
// a file never touches storage (decision 0006).
export const itemKey = (itemId: string) => `items/${itemId}`;

const TEN_MINUTES = 10 * 60;

// A URL the browser can PUT one file to, without our credentials. The type
// and size are part of the signature: the upload must send the same
// Content-Type, and storage refuses a body of a different length.
export const presignPut = async (input: { key: string; contentType: string; size: number }) => {
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.size,
    }),
    { expiresIn: TEN_MINUTES, signableHeaders: new Set(["content-type", "content-length"]) },
  );
  // Counted when issued: we can't see the browser's PUT.
  await countOps({ classA: 1 });
  return url;
};

// The stored object's real size and type, or null when there is none.
export const headObject = async (key: string) => {
  await countOps({ classB: 1 });
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return null;
    }
    throw error;
  }
};

// Deletes are free on R2, so they aren't counted. Deleting a missing key is
// not an error.
export const deleteObject = async (key: string) => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

// A short-lived URL the browser follows straight to storage. The headers
// storage answers with are ours, part of the signature: the Content-Type
// (previews serve only an allowlist) and Content-Disposition (inline or
// download, with the real file name).
export const presignGet = async (input: {
  key: string;
  contentDisposition: string;
  contentType?: string;
  expiresIn: number;
}) => {
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ResponseContentDisposition: input.contentDisposition,
      ResponseContentType: input.contentType,
    }),
    { expiresIn: input.expiresIn },
  );
  // Counted when issued, like PUTs.
  await countOps({ classB: 1 });
  return url;
};

// The first `bytes` of an object (text previews read 1 MB, not the file).
export const getRange = async (key: string, bytes: number) => {
  await countOps({ classB: 1 });
  const object = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${bytes - 1}` }),
  );
  if (!object.Body) {
    throw new Error("Storage returned no body");
  }
  return object.Body.transformToByteArray();
};

// Deletes many objects, 1000 per request (the S3 maximum). Free on R2, so
// not counted. Returns the keys storage couldn't delete.
export const deleteObjects = async (keys: string[]) => {
  const failed: string[] = [];
  for (let start = 0; start < keys.length; start += 1000) {
    const batch = keys.slice(start, start + 1000);
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    for (const error of result.Errors ?? []) {
      if (error.Key) failed.push(error.Key);
    }
  }
  return failed;
};
