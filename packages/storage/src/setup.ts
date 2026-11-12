import {
  CreateBucketCommand,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { bucket, s3 } from "./client.ts";

// Lets the browser upload straight to the bucket with a presigned URL.
// Run once per bucket (after `pnpm docker:up` on a new volume); safe to re-run.
//   pnpm storage:setup        the bucket in S3_BUCKET
//   pnpm storage:setup-test   creates "<S3_BUCKET>-test" for the e2e tests too
const forTests = process.argv.includes("--test");
const target = forTests ? `${bucket}-test` : bucket;

const origins = (process.env.S3_CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (origins.length === 0) {
  throw new Error("S3_CORS_ORIGINS is not set");
}

if (forTests) {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: target }));
    console.log(`Created bucket "${target}"`);
  } catch (error) {
    if (!(error instanceof Error && error.name === "BucketAlreadyOwnedByYou")) {
      throw error;
    }
  }
}

await s3.send(
  new PutBucketCorsCommand({
    Bucket: target,
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

const { CORSRules } = await s3.send(new GetBucketCorsCommand({ Bucket: target }));
console.log(`CORS set on bucket "${target}":`);
console.log(JSON.stringify(CORSRules, null, 2));
