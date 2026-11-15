import { NextResponse } from "next/server";
import { api } from "@/lib/api";

/** Check a key: who it belongs to and the health of its number. */
export const GET = api("read", async (_req, key) =>
  NextResponse.json({
    business: key.businessName,
    key: { name: key.keyName, scopes: key.scopes, rate_limit_per_second: key.rateLimit },
    number: {
      phone_number_id: key.phoneNumberId,
      display_name: key.displayName,
      connected: !!key.accessTokenEncrypted && key.tokenStatus !== "invalid",
      quality_rating: key.qualityRating,
      messaging_limit_tier: key.messagingLimitTier,
    },
  })
);
