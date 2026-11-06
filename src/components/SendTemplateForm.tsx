"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SAMPLE_RULES } from "@/lib/template-validate";
import { describeInputs, renderBody, type SendableTemplate } from "@/lib/template-send";
import { Alert, Button, buttonClass, hintCls, inputCls, labelCls } from "@/components/ui";
import { Icon } from "@/components/icons";
import { WaPreview } from "@/components/WaPreview";

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
    return <p className="text-sm text-slate-500">No approved templates yet. Create one and wait for approval.</p>;
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
  const previewMedia = need.headerMedia ? mediaName || mediaLink || (need.headerMedia === "DOCUMENT" ? "PDF document" : headerLabel!) : null;

  return (
    <form onSubmit={send} className="space-y-5">
      {!fixedTo && (
        <div>
          <label className={labelCls}>Customer&apos;s WhatsApp number</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
          <p className={hintCls}>With country code. A 10-digit Indian number is treated as +91.</p>
        </div>
      )}

      <div>
        <label className={labelCls}>Template</label>
        <select value={key} onChange={(e) => pick(e.target.value)} className={inputCls}>
          {templates.map((t) => (
            <option key={keyOf(t)} value={keyOf(t)}>{t.name} ({t.language})</option>
          ))}
        </select>
      </div>

      {need.headerVar && (
        <div>
          <label className={labelCls}>Header value <span className="font-mono text-slate-400">{"{{1}}"}</span></label>
          <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} className={inputCls} />
        </div>
      )}

      {need.headerMedia && (
        <div>
          <label className={labelCls}>Header {headerLabel}</label>
          <label className={`${buttonClass("secondary")} cursor-pointer`}>
            <Icon name="image" />
            {mediaId ? "Choose a different file" : "Upload file"}
            <input
              type="file"
              accept={SAMPLE_RULES[need.headerMedia].types.join(",")}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              className="sr-only"
            />
          </label>
          {uploading && <p className="mt-2 text-sm text-slate-600">Uploading...</p>}
          {mediaId && <p className="mt-2 text-sm font-medium text-emerald-700">Ready: {mediaName}</p>}
          {!mediaId && (
            <input value={mediaLink} onChange={(e) => setMediaLink(e.target.value)}
              placeholder="or paste a public https link (for files over 4 MB)" className={`${inputCls} mt-2`} />
          )}
        </div>
      )}

      {need.bodyVars.length > 0 && (
        <div>
          <p className={labelCls}>Message details</p>
          <div className="space-y-2">
            {need.bodyVars.map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-12 shrink-0 font-mono text-sm text-slate-500">{`{{${n}}}`}</span>
                <input value={bodyParams[n] ?? ""} onChange={(e) => setBodyParams({ ...bodyParams, [n]: e.target.value })} className={inputCls} />
              </div>
            ))}
          </div>
        </div>
      )}

      {need.urlButtons.map((ub) => (
        <div key={ub.index}>
          <label className={labelCls}>Link for &ldquo;{ub.label}&rdquo;</label>
          <div className="flex items-center gap-2">
            <span className="max-w-[45%] shrink-0 truncate text-sm text-slate-500">{ub.url.replace(/\{\{1\}\}$/, "")}</span>
            <input value={buttonParams[String(ub.index)] ?? ""}
              onChange={(e) => setButtonParams({ ...buttonParams, [String(ub.index)]: e.target.value })}
              placeholder="ends with…" className={inputCls} />
          </div>
        </div>
      ))}

      <div>
        <p className={labelCls}>Preview</p>
        <WaPreview
          headerText={tpl.header_format === "TEXT" ? tpl.header_text?.replace(/\{\{1\}\}/g, headerText || "…") : null}
          headerMedia={previewMedia}
          body={renderBody(tpl, params.map((p, i) => p || `{{${need.bodyVars[i]}}}`))}
          footer={tpl.footer}
          buttons={tpl.buttons ?? []}
        />
      </div>

      <p className={hintCls}>
        Only message people who have agreed to hear from you on WhatsApp. Marketing templates need their opt-in.
      </p>
      {err && <Alert tone="error">{err}</Alert>}
      <Button type="submit" disabled={busy || uploading}>
        <Icon name="send" />
        {busy ? "Sending..." : "Send template"}
      </Button>
    </form>
  );
}
