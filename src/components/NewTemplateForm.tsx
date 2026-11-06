"use client";

import { showDemoCaption, PERM_MGMT } from "@/lib/demo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  LANGUAGES,
  SAMPLE_MAX_BYTES,
  SAMPLE_RULES,
  extractVariables,
  validateTemplate,
  type ButtonInput,
  type HeaderFormat,
} from "@/lib/template-validate";
import { Alert, Button, Card, buttonClass, hintCls, inputCls, labelCls } from "@/components/ui";
import { Icon } from "@/components/icons";
import { WaPreview } from "@/components/WaPreview";

const fillVars = (text: string, values: Record<number, string>) =>
  text.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => (values[Number(n)] || m));

export function NewTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<Record<number, string>>({});

  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerExample, setHeaderExample] = useState("");
  const [mediaHandle, setMediaHandle] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [uploading, setUploading] = useState(false);

  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonInput[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const vars = [...new Set(extractVariables(body))].sort((a, b) => a - b);
  const exampleList = vars.map((n) => examples[n] ?? "");
  const headerHasVar = headerFormat === "TEXT" && extractVariables(headerText).length > 0;

  function changeHeader(f: HeaderFormat) {
    setHeaderFormat(f);
    setMediaHandle("");
    setMediaName("");
    setErr(null);
  }

  async function uploadSample(file: File) {
    if (headerFormat === "NONE" || headerFormat === "TEXT") return;
    setErr(null);
    setMediaHandle("");
    setMediaName("");
    const rule = SAMPLE_RULES[headerFormat];
    if (!rule.types.includes(file.type)) return setErr(`Choose a ${rule.label} file.`);
    if (file.size > SAMPLE_MAX_BYTES) {
      return setErr("Sample must be under 4 MB. A small sample is fine, you choose the real file when sending.");
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", headerFormat);
    const res = await fetch("/api/templates/upload-sample", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return setErr(data.error ?? "Upload failed");
    setMediaHandle(data.handle);
    setMediaName(data.name);
  }

  function addButton(type: ButtonInput["type"]) {
    const b: ButtonInput =
      type === "QUICK_REPLY"
        ? { type, text: "" }
        : type === "URL"
        ? { type, text: "", url: "https://" }
        : { type, text: "", phone: "+91" };
    setButtons([...buttons, b]);
  }
  function updateButton(i: number, patch: Record<string, string>) {
    setButtons(buttons.map((b, idx) => (idx === i ? ({ ...b, ...patch } as ButtonInput) : b)));
  }

  function buildInput() {
    return {
      name,
      category,
      language,
      body,
      examples: exampleList,
      header:
        headerFormat === "NONE"
          ? undefined
          : { format: headerFormat, text: headerText, example: headerExample, mediaHandle },
      footer,
      buttons,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const input = buildInput();
    const problem = validateTemplate(input);
    if (problem) return setErr(problem);

    setBusy(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Could not create the template");
    showDemoCaption({ text: "Template submitted to Meta. It shows as Pending until Meta approves it.", permission: PERM_MGMT, ms: 8000 });
    router.push("/templates");
    router.refresh();
  }

  const counts = {
    URL: buttons.filter((b) => b.type === "URL").length,
    PHONE_NUMBER: buttons.filter((b) => b.type === "PHONE_NUMBER").length,
  };

  const previewBody = fillVars(body, examples);
  const previewHeaderText =
    headerFormat === "TEXT" ? headerText.replace(/\{\{\s*1\s*\}\}/g, headerExample || "{{1}}") : null;
  const previewMedia =
    headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT"
      ? mediaName || (headerFormat === "DOCUMENT" ? "PDF document" : headerFormat.toLowerCase())
      : null;

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card title="Basics">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Template name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="order_ready"
                className={inputCls}
              />
              <p className={hintCls}>Lowercase letters, numbers and underscores. It can&apos;t be changed later.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Header" description="Optional. A title, image, video or PDF shown above your message.">
          <select value={headerFormat} onChange={(e) => changeHeader(e.target.value as HeaderFormat)} className={inputCls}>
            <option value="NONE">No header</option>
            <option value="TEXT">Text</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
            <option value="DOCUMENT">PDF document</option>
          </select>

          {headerFormat === "TEXT" && (
            <div className="mt-4 space-y-3">
              <div>
                <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60}
                  placeholder="Your order update, {{1}}" className={inputCls} />
                <p className={hintCls}>Up to 60 characters. You can use one variable, {"{{1}}"}.</p>
              </div>
              {headerHasVar && (
                <input value={headerExample} onChange={(e) => setHeaderExample(e.target.value)}
                  placeholder="Example for {{1}}, e.g. Ravi" className={inputCls} />
              )}
            </div>
          )}

          {(headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
            <div className="mt-4">
              <label className={`${buttonClass("secondary")} cursor-pointer`}>
                <Icon name="image" />
                {mediaHandle ? "Choose a different file" : "Choose sample file"}
                <input
                  type="file"
                  accept={SAMPLE_RULES[headerFormat].types.join(",")}
                  onChange={(e) => e.target.files?.[0] && uploadSample(e.target.files[0])}
                  className="sr-only"
                />
              </label>
              <p className={hintCls}>
                A small {SAMPLE_RULES[headerFormat].label} sample under 4 MB, for WhatsApp to review.
                You pick the real file each time you send the template.
              </p>
              {uploading && <p className="mt-2 text-sm text-slate-600">Uploading sample...</p>}
              {mediaHandle && <p className="mt-2 text-sm font-medium text-emerald-700">Sample ready: {mediaName}</p>}
            </div>
          )}
        </Card>

        <Card title="Message" description="The main text. Use {{1}}, {{2}} for details that change per customer.">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={1024}
            placeholder="Hi {{1}}, your order {{2}} is ready for pickup."
            className={inputCls}
          />
          <p className={hintCls}>{body.length}/1024 characters</p>

          {vars.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-900">Example values</p>
              <p className={`${hintCls} mb-3`}>WhatsApp needs a sample for each variable to review the template.</p>
              <div className="space-y-2">
                {vars.map((n) => (
                  <div key={n} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 font-mono text-sm text-slate-500">{`{{${n}}}`}</span>
                    <input value={examples[n] ?? ""} onChange={(e) => setExamples({ ...examples, [n]: e.target.value })}
                      className={inputCls} placeholder={n === 1 ? "e.g. Ravi" : "e.g. 1234"} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Footer" description="Optional small grey text under the message.">
          <input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60}
            placeholder="Reply STOP to opt out" className={inputCls} />
          <p className={hintCls}>Up to 60 characters, no variables.</p>
        </Card>

        <Card title="Buttons" description="Optional. Up to 10: any number of quick replies, 2 links and 1 call button.">
          {buttons.length > 0 && (
            <div className="mb-4 space-y-3">
              {buttons.map((b, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {b.type === "QUICK_REPLY" ? "Quick reply" : b.type === "URL" ? "Link" : "Call"}
                    </span>
                    <Button variant="danger" size="sm" onClick={() => setButtons(buttons.filter((_, idx) => idx !== i))}>
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                  <input value={b.text} onChange={(e) => updateButton(i, { text: e.target.value })} maxLength={25}
                    placeholder="Button label (max 25 characters)" className={inputCls} />
                  {b.type === "URL" && (
                    <>
                      <input value={b.url} onChange={(e) => updateButton(i, { url: e.target.value })}
                        placeholder="https://example.com/orders/{{1}}" className={inputCls} />
                      {/\{\{1\}\}$/.test(b.url) && (
                        <input value={b.example ?? ""} onChange={(e) => updateButton(i, { example: e.target.value })}
                          placeholder="Example full link, e.g. https://example.com/orders/1234" className={inputCls} />
                      )}
                    </>
                  )}
                  {b.type === "PHONE_NUMBER" && (
                    <input value={b.phone} onChange={(e) => updateButton(i, { phone: e.target.value })}
                      placeholder="+919876543210" className={inputCls} />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={buttons.length >= 10} onClick={() => addButton("QUICK_REPLY")}>
              <Icon name="plus" className="h-3.5 w-3.5" />Quick reply
            </Button>
            <Button variant="secondary" size="sm" disabled={counts.URL >= 2 || buttons.length >= 10} onClick={() => addButton("URL")}>
              <Icon name="link" className="h-3.5 w-3.5" />Link
            </Button>
            <Button variant="secondary" size="sm" disabled={counts.PHONE_NUMBER >= 1 || buttons.length >= 10} onClick={() => addButton("PHONE_NUMBER")}>
              <Icon name="phone" className="h-3.5 w-3.5" />Call
            </Button>
          </div>
        </Card>

        {err && <Alert tone="error">{err}</Alert>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || uploading}>
            {busy ? "Submitting..." : "Submit for approval"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/templates")}>Cancel</Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-6">
        <Card title="Preview" description="How your message will look on WhatsApp.">
          <WaPreview
            headerText={previewHeaderText}
            headerMedia={previewMedia}
            body={previewBody}
            footer={footer.trim() || null}
            buttons={buttons}
          />
        </Card>
      </div>
    </form>
  );
}
