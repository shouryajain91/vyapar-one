import crypto from "crypto";

const GRAPH_VERSION = "v21.0";

/** Random 6-digit two-step verification PIN. */
export function generatePin(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Registers a phone number on the WhatsApp Cloud API. Meta requires a
 * 6-digit PIN (it becomes the number's two-step verification PIN).
 */
export async function registerPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  pin: string
): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/register`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("WhatsApp register failed:", JSON.stringify(data));
  }
  return { ok: res.ok, data };
}
