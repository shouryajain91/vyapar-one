/** Plain-language explanations for common WhatsApp Cloud API error codes. */
const HINTS: Record<string, string> = {
  "131026": "The message couldn't be delivered. The number may not be on WhatsApp, or the customer hasn't accepted WhatsApp's latest terms.",
  "131047": "More than 24 hours have passed since the customer last replied. Send an approved template message instead.",
  "131049": "WhatsApp chose not to deliver this marketing message to protect the customer experience. Try again later or send a Utility template.",
  "131048": "Your number hit a spam rate limit. Wait and send fewer messages.",
  "131056": "Too many messages were sent to this customer in a short time. Wait and try again.",
  "130429": "You're sending too fast. Slow down and try again.",
  "131042": "There is a payment problem on your WhatsApp Business account. Check your payment method in WhatsApp Manager.",
  "131053": "The media file couldn't be uploaded. Check its type and size.",
  "131051": "This type of message isn't supported.",
  "132000": "The template variables don't match what the template expects.",
  "132001": "That template doesn't exist in this language, or isn't approved.",
  "132005": "The translated template text is too long.",
  "132012": "A template variable has the wrong format.",
  "132015": "This template is paused for low quality. Edit it or use another template.",
  "132016": "This template has been disabled for low quality.",
  "133010": "This phone number isn't registered with WhatsApp yet. Finish registration on the dashboard.",
  "190": "Your WhatsApp connection has expired. Reconnect your number on the dashboard.",
  "100": "Meta rejected the request. Check the message details.",
};

export function explainError(code: string | null | undefined, message: string | null | undefined): string {
  const hint = code ? HINTS[code] : undefined;
  if (hint) return hint;
  return message || "The message failed to send.";
}

/** Rank so out-of-order webhooks never move a message backwards. */
export const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
