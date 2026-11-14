import { z } from "zod";
import { itemIdSchema } from "./item.ts";

// Ownership transfers (decision 0009).

export const offerTransferSchema = z.object({ itemId: itemIdSchema, userId: z.uuid() });

export const transferRefSchema = z.object({ itemId: itemIdSchema, transferId: z.uuid() });
