export const instant = false;

import type { ReactNode } from "react";
import { PageContainer, PageHeader, Card } from "@/components/ui";
import { DevTabs } from "@/components/DevTabs";
import { SITE_URL } from "@/lib/site-url";

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"><code>{children}</code></pre>;
}
function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900 first:mt-0">{children}</h3>;
}
const P = ({ children }: { children: ReactNode }) => <p className="mb-3 text-sm leading-relaxed text-slate-600">{children}</p>;

const BASE = `${SITE_URL}/api/v1`;

export default function DocsPage() {
  return (
    <PageContainer>
      <PageHeader title="Developers" description="Everything you need to send WhatsApp messages from your own software." />
      <DevTabs active="/developers/docs" />

      <Card title="Getting started" className="mb-6">
        <P>1. Create an API key on the <strong>Keys &amp; webhooks</strong> tab. 2. Send it in the <code>Authorization</code> header. 3. Make sure the template you want to use is <strong>approved</strong> (see Templates).</P>
        <Code>{`curl ${BASE}/me \\
  -H "Authorization: Bearer vp_live_YOUR_KEY"`}</Code>
        <P>Base address: <code>{BASE}</code>. All requests and answers are JSON. Each key can only act on its own WhatsApp number.</P>
      </Card>

      <Card title="Send a template message" description="POST /messages" className="mb-6">
        <Code>{`curl -X POST ${BASE}/messages \\
  -H "Authorization: Bearer vp_live_YOUR_KEY" \\
  -H "Idempotency-Key: order-1234-confirmation" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "order_update",
      "language": "en_US",
      "body": ["Asha", "#1234"]
    },
    "reference": "order-1234"
  }'`}</Code>
        <H>Template fields</H>
        <P><code>body</code>: values for {"{{1}}"}, {"{{2}}"}… in order. <code>header_text</code>: value for a header variable. <code>header_media_link</code>: https link for an image, video or document header (<code>header_filename</code> for documents). <code>buttons</code>: <code>{`{"0": "order-1234"}`}</code> for a link button with a variable (key = button position starting at 0). <code>GET /templates</code> tells you exactly what each template needs.</P>
        <H>Answer (HTTP 200)</H>
        <Code>{`{
  "id": "5b1c…",            // use this to look the message up later
  "direction": "outbound",
  "customer": "919876543210",
  "type": "template",
  "status": "sent",         // sent → delivered → read, or failed
  "template": "order_update",
  "text": "Hi Asha, your order #1234 …",
  "reference": "order-1234",
  "wa_message_id": "wamid.…",
  "error": null,
  "created_at": "2026-11-15T12:00:00Z"
}`}</Code>
        <H>Free-text messages</H>
        <P>Allowed only within 24 hours of the customer&apos;s last message to you: <code>{`{"to": "…", "type": "text", "text": "Thanks! Your order has shipped."}`}</code>. Otherwise you get <code>outside_window</code>; send a template instead.</P>
        <H>Safe retries</H>
        <P>Add an <code>Idempotency-Key</code> header (up to 100 characters, kept for 24 hours). If your request times out, send it again with the same key: you&apos;ll get the original answer and the customer will not get a duplicate. Using the same key with a different body returns <code>idempotency_mismatch</code>. A <code>reference</code> (your order or invoice number) is stored with the message and returned everywhere.</P>
      </Card>

      <Card title="Send to many customers" description="POST /messages/batch · GET /batches/{id}" className="mb-6">
        <Code>{`curl -X POST ${BASE}/messages/batch \\
  -H "Authorization: Bearer vp_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Diwali offer",
    "template": { "name": "diwali_offer", "language": "en_US" },
    "recipients": [
      { "to": "919876543210", "body": ["Asha"], "reference": "cust-1" },
      { "to": "919812345678", "body": ["Ravi"], "reference": "cust-2" }
    ]
  }'
# → 202 { "batch_id": "…", "accepted": 2, "rejected_count": 0, "rejected": [] }`}</Code>
        <P>Up to 1,000 recipients per call. Sending continues in the background (it also appears under Campaigns). Check progress with <code>GET /batches/{"{batch_id}"}</code> (<code>counts</code>: pending, sent, delivered, read, failed, skipped) or list the messages with <code>GET /messages?batch_id=…</code>. Customers who opted out are skipped automatically. Rows we couldn&apos;t accept are listed in <code>rejected</code> with their position and reason.</P>
      </Card>

      <Card title="Check status and list messages" description="GET /messages/{id} · GET /messages" className="mb-6">
        <Code>{`curl "${BASE}/messages?status=failed&since=2026-11-01T00:00:00Z&limit=50" \\
  -H "Authorization: Bearer vp_live_YOUR_KEY"`}</Code>
        <P>Filters: <code>status</code> (sent, delivered, read, failed, received), <code>customer</code>, <code>reference</code>, <code>batch_id</code>, <code>since</code>, <code>until</code>, <code>direction</code> (outbound default, or inbound), <code>limit</code> (max 100). The answer has <code>data</code> and <code>next_cursor</code>; pass it back as <code>cursor</code> for the next page.</P>
      </Card>

      <Card title="Templates and key check" description="GET /templates · GET /me" className="mb-6">
        <P><code>GET /templates</code> lists your approved templates and what each needs: <code>body_variables</code> (how many), <code>header_text</code>, <code>header_media</code> and <code>url_buttons</code>. <code>GET /me</code> shows the key&apos;s permissions, rate limit, and the number&apos;s connection, quality and sending-limit tier.</P>
      </Card>

      <Card title="Webhooks" description="Delivery updates and replies, sent to your server" className="mb-6">
        <P>Add your https address on the <strong>Keys &amp; webhooks</strong> tab. We POST JSON, and your server should answer with any 2xx within 8 seconds. If it doesn&apos;t, we retry after 1, 5, 30 and 120 minutes, then stop and show an alert. Events can arrive more than once or out of order: use <code>id</code> to ignore repeats.</P>
        <Code>{`// message.status  (delivered, read or failed; the “sent” status is already in the send answer)
{
  "id": "evt_8841",
  "type": "message.status",
  "created_at": "2026-11-15T12:00:05Z",
  "data": {
    "message_id": "5b1c…", "wa_message_id": "wamid.…", "customer": "919876543210",
    "status": "delivered", "reference": "order-1234", "template": "order_update",
    "error": null, "timestamp": "2026-11-15T12:00:04Z"
  }
}

// message.received  (customer replies and button taps)
{
  "id": "evt_8842", "type": "message.received", "created_at": "…",
  "data": { "message_id": "…", "from": "919876543210", "name": "Asha", "type": "text",
            "text": "Yes please", "button_payload": null, "reply_to_wa_id": null, "timestamp": "…" }
}`}</Code>
        <H>Verify the signature</H>
        <P>Every request has <code>X-VyaparOne-Signature: t=&lt;unix time&gt;,v1=&lt;hex&gt;</code>. Compute HMAC-SHA256 of <code>{"`${t}.${rawBody}`"}</code> with your webhook secret and compare. Reject requests older than 5 minutes.</P>
        <Code>{`import crypto from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(t + "." + rawBody).digest("hex");
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`}</Code>
      </Card>

      <Card title="Errors and limits" className="mb-6">
        <P>Errors look like <code>{`{"error": {"code": "opted_out", "message": "…"}}`}</code>. Program against <code>code</code>.</P>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {[
                ["401 unauthorized", "Missing, wrong or revoked key."],
                ["403 forbidden / ip_not_allowed", "The key lacks the permission, or the request came from an address not on its list."],
                ["400 invalid_number / invalid_request / invalid_json", "Fix the request and try again."],
                ["404 template_not_found · 422 template_not_approved", "The template doesn't exist in that language, or isn't approved yet."],
                ["422 invalid_variables", "A required variable, header media or button value is missing."],
                ["422 opted_out", "The customer replied STOP. Not sent."],
                ["422 outside_window", "Free text only works within 24 hours of the customer's last message."],
                ["409 token_expired · number_not_connected · number_not_registered", "Reconnect or finish registering the number in the dashboard."],
                ["402 payment_issue", "WhatsApp can't charge your payment method. Fix it in WhatsApp Manager."],
                ["429 rate_limited", "Too many requests. Wait for Retry-After (1 second). Default: 20 per second per key."],
                ["502 whatsapp_error", "WhatsApp rejected the message. The message says why; whatsapp_code has the original code."],
                ["504 delivery_unknown", "WhatsApp didn't answer. Check GET /messages?reference=… before retrying."],
              ].map(([a, b]) => (
                <tr key={a}><td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-900">{a}</td><td className="px-4 py-2 text-slate-600">{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>&nbsp;</P>
        <P>WhatsApp&apos;s own rules still apply: marketing templates need the customer&apos;s consent, and your number&apos;s daily sending limit depends on its quality rating (see <code>GET /me</code>). WhatsApp charges for template conversations to your payment method, as it does for messages sent from the dashboard.</P>
      </Card>
    </PageContainer>
  );
}
