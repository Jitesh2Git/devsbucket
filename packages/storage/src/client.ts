import { S3Client } from "@aws-sdk/client-s3";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

export const bucket = required("S3_BUCKET");

// One client for Garage (locally) and R2 (prod): both speak the S3 API.
export const s3 = new S3Client({
  endpoint: required("S3_ENDPOINT"),
  region: required("S3_REGION"),
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
  // http://127.0.0.1:3900/<bucket>/<key> instead of http://<bucket>.127.0.0.1:3900/<key>.
  forcePathStyle: true,
  // The SDK adds CRC32 checksums to every upload by default. A presigned URL
  // can't know the file's checksum in advance, so only send one when the
  // operation requires it.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
