import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { countOps } from "@devsbucket/db/usage";
import { type Part, partSizes } from "@devsbucket/shared/limits";
import { bucket, s3 } from "./client.ts";

const TEN_MINUTES = 10 * 60;

// Large files go up in parts (LOCKED.md: over 50 MB): one multipart upload,
// a presigned URL per part that the browser PUTs to (several at once), then
// one call that joins the parts into the final object.

export const createMultipart = async (input: { key: string; contentType: string }) => {
  const { UploadId } = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
  );
  await countOps({ classA: 1 });
  if (!UploadId) {
    throw new Error("Storage returned no upload id");
  }
  return UploadId;
};

// One URL per part, each signed for that part's exact size.
export const presignParts = async (input: { key: string; uploadId: string; size: number }) => {
  const urls = await Promise.all(
    partSizes(input.size).map(async (size, index) => {
      const partNumber = index + 1;
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: bucket,
          Key: input.key,
          UploadId: input.uploadId,
          PartNumber: partNumber,
          ContentLength: size,
        }),
        { expiresIn: TEN_MINUTES, signableHeaders: new Set(["content-length"]) },
      );
      return { partNumber, size, url };
    }),
  );
  // Each part is a write, counted when its URL is issued.
  await countOps({ classA: urls.length });
  return urls;
};

// Joins the parts the browser uploaded; `parts` carries each part's ETag,
// which storage checks against what it received.
export const completeMultipart = async (input: {
  key: string;
  uploadId: string;
  parts: Part[];
}) => {
  await countOps({ classA: 1 });
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: input.parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
      },
    }),
  );
};

// Throws the uploaded parts away. Free on R2, so not counted; aborting an
// upload that's already gone is not an error.
export const abortMultipart = async (input: { key: string; uploadId: string }) => {
  try {
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: input.key,
        UploadId: input.uploadId,
      }),
    );
  } catch (error) {
    if (!(error instanceof Error && error.name === "NoSuchUpload")) {
      throw error;
    }
  }
};
