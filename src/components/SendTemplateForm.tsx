"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SAMPLE_RULES } from "@/lib/template-validate";
import { describeInputs, renderBody, type SendableTemplate } from "@/lib/template-send";

const field = "w-full rounded-lg border px-3 py-2 text-sm";
const keyOf = (t: SendableTemplate) => `${t.name}|${t.language}`;

export function SendTemplateForm({
  templates,
  fixedTo,
  defaultKey,
}: {
  templates: SendableTemplate[];
  fixedTo?: string; // set when replying inside an existing conversation
  defaultKey?: string;
}) {
  const router = useRouter();
  const [to, setTo] = useState(fixedTo ?? "");
  const [key, setKey] = useState(
    templates.some((t) => keyOf(t) === defaultKey) ? defaultKey! : templates[0] ? keyOf(templates[0]) : ""
  );
  const [bodyParams, setBodyParams] = useState<Record<number, string>>({});
  const [headerText, setHeaderText] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [mediaLink, setMediaLink] = useState("");
  const [buttonParams, setButtonParams] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tpl = templates.find((t) => keyOf(t) === key);
  if (!tpl) {
    return <p className="text-sm text-gray-500">No approved templates yet. Create one and wait for approval.</p>;
  }
  const need = describeInputs(tpl);
  const params = need.bodyVars.map((n) => bodyParams[n] ?? "");

  function pick(k: string) {
    setKey(k);
    setBodyParams({});
    setHeaderText("");
    setMediaId("");
    setMediaName("");
    setMediaLink("");
    setButtonParams({});
    setErr(null);
  }

  async function upload(file: File) {
    if (!need.headerMedia) return;
    setErr(null);
    setMediaId("");
    setMediaName("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", need.headerMedia);
    const res = await fetch("/api/media/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return setErr(data.error ?? "Upload failed");
    setMediaId(data.id);
    setMediaName(data.name);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        type: "template",
        template_name: tpl!.name,
        template_language: tpl!.language,
        body_params: params,
        header_text: headerText,
        header_media: mediaId ? { id: mediaId, filename: mediaName } : { link: mediaLink },
        button_params: buttonParams,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.message ?? data.error ?? "Send failed");
    router.push(`/inbox?with=${encodeURIComponent(data.to)}`);
    router.refresh();
  }

  const headerLabel = tpl.header_format === "DOCUMENT" ? "PDF" : tpl.header_format?.toLowerCase();

  return (
    <form onSubmit={send} className="space-y-5">
      {!fixedTo && (
        <div>
          <label className="block text-sm font-medium mb-1">Customer&apos;s WhatsApp number</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98765 43210" className={field} />
          <p className="text-xs text-gray-500 mt-1">With country code. A 10-digit Indian number is treated as +91.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Template</label>
        <select value={key} onChange={(e) => pick(e.target.value)} className={field}>
          {templates.map((t) => (
            <option key={keyOf(t)} value={keyOf(t)}>{t.name} ({t.language})</option>
          ))}
        </select>
      </div>

      {need.headerVar && (
        <div>
          <label className="block text-sm font-medium mb-1">Header value ({"{{1}}"})</label>
          <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} className={field} />
        </div>
      )}

      {need.headerMedia && (
        <div>
          <label className="block text-sm font-medium mb-1">Header {headerLabel}</label>
          <input
            type="file"
            accept={SAMPLE_RULES[need.headerMedia].types.join(",")}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            className="block w-full text-sm"
          />
          {uploading && <p className="text-xs text-gray-600 mt-1">Uploading...</p>}
          {mediaId && <p className="text-xs text-green-700 mt-1">Ready: {mediaName}</p>}
          {!mediaId && (
            <input value={mediaLink} onChange={(e) => setMediaLink(e.target.value)}
              placeholder="or paste a public https link (for files over 4 MB)" className={`${field} mt-2`} />
          )}
        </div>
      )}

      {need.bodyVars.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Message details</p>
          {need.bodyVars.map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span className="w-12 text-sm text-gray-600">{`{{${n}}}`}</span>
              <input value={bodyParams[n] ?? ""} onChange={(e) => setBodyParams({ ...bodyParams, [n]: e.target.value })} className={field} />
            </div>
          ))}
        </div>
      )}

      {need.urlButtons.map((ub) => (
        <div key={ub.index}>
          <label className="block text-sm font-medium mb-1">
            Link for &ldquo;{ub.label}&rdquo;
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 break-all">{ub.url.replace(/\{\{1\}\}$/, "")}</span>
            <input value={buttonParams[String(ub.index)] ?? ""}
              onChange={(e) => setButtonParams({ ...buttonParams, [String(ub.index)]: e.target.value })}
              placeholder="ends with…" className={field} />
          </div>
        </div>
      ))}

      {/* Live preview */}
      <div className="rounded-xl bg-[#e7f5e3] p-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Preview</p>
        <div className="max-w-sm rounded-lg bg-white p-3 text-sm shadow-sm">
          {tpl.header_format === "TEXT" && <p className="font-semibold mb-1">{tpl.header_text?.replace(/\{\{1\}\}/g, headerText || "…")}</p>}
          {need.headerMedia && (
            <div className="mb-2 rounded bg-gray-100 py-6 text-center text-xs text-gray-500">
              {mediaName || mediaLink || `[${headerLabel}]`}
            </div>
          )}
          <p className="whitespace-pre-wrap">{renderBody(tpl, params.map((p, i) => p || `{{${need.bodyVars[i]}}}`))}</p>
          {tpl.footer && <p className="mt-2 text-xs text-gray-500">{tpl.footer}</p>}
        </div>
        {(tpl.buttons ?? []).map((b, i) => (
          <div key={i} className="mt-1 max-w-sm rounded-lg bg-white p-2 text-center text-sm text-blue-600 shadow-sm">
            {b.type === "URL" ? "🔗 " : b.type === "PHONE_NUMBER" ? "📞 " : ""}{b.text}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Only message people who have agreed to hear from you on WhatsApp. Marketing templates need their opt-in.
      </p>
      {err && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{err}</p>}
      <button type="submit" disabled={busy || uploading}
        className="rounded-lg bg-black text-white px-5 py-2 text-sm font-medium disabled:opacity-50">
        {busy ? "Sending..." : "Send template"}
      </button>
    </form>
  );
}
