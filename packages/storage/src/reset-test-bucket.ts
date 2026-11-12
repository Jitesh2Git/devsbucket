// Empties the end-to-end test bucket: every object and unfinished multipart
// upload. Run by apps/web/e2e/global-setup.ts (pnpm --filter
// @devsbucket/storage storage:reset-test) with S3_BUCKET set to it, next to
// the test database reset.
import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { bucket, s3 } from "./client.ts";

// This deletes everything, so it only ever runs against a *-test bucket.
if (!bucket.endsWith("-test")) {
  throw new Error(`Refusing to empty "${bucket}": the test bucket name must end in -test`);
}

try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
} catch {
  throw new Error(`Test bucket "${bucket}" not found: run \`pnpm storage:setup-test\` once`);
}

let deleted = 0;
let continuationToken: string | undefined;
do {
  const page = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
  );
  const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
  if (keys.length > 0) {
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
    deleted += keys.length;
  }
  continuationToken = page.NextContinuationToken;
} while (continuationToken);

const { Uploads = [] } = await s3.send(new ListMultipartUploadsCommand({ Bucket: bucket }));
for (const upload of Uploads) {
  await s3.send(
    new AbortMultipartUploadCommand({ Bucket: bucket, Key: upload.Key, UploadId: upload.UploadId }),
  );
}

console.log(
  `Test bucket "${bucket}" is empty (${deleted} objects, ${Uploads.length} uploads removed)`,
);
