import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { bucket, s3 } from "./client.ts";

// Lets the browser upload straight to the bucket with a presigned URL.
// Run once per bucket (after `pnpm docker:up` on a new volume); safe to re-run.
const origins = (process.env.S3_CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (origins.length === 0) {
  throw new Error("S3_CORS_ORIGINS is not set");
}

await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ["PUT", "GET", "HEAD"],
          AllowedHeaders: ["*"],
          // Multipart uploads (step 7) read each part's ETag in the browser.
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

const { CORSRules } = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log(`CORS set on bucket "${bucket}":`);
console.log(JSON.stringify(CORSRules, null, 2));
