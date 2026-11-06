"use client";

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

const field = "w-full rounded-lg border px-3 py-2 text-sm";

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
    router.push("/templates");
    router.refresh();
  }

  const counts = {
    URL: buttons.filter((b) => b.type === "URL").length,
    PHONE_NUMBER: buttons.filter((b) => b.type === "PHONE_NUMBER").length,
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Template name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          placeholder="order_ready"
          className={field}
        />
        <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers and underscores. It can&apos;t be changed later.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Header */}
      <fieldset className="rounded-xl border p-4">
        <legend className="px-2 text-sm font-medium">Header (optional)</legend>
        <select value={headerFormat} onChange={(e) => changeHeader(e.target.value as HeaderFormat)} className={field}>
          <option value="NONE">No header</option>
          <option value="TEXT">Text</option>
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
          <option value="DOCUMENT">PDF document</option>
        </select>

        {headerFormat === "TEXT" && (
          <div className="mt-3 space-y-2">
            <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60}
              placeholder="Your order update, {{1}}" className={field} />
            <p className="text-xs text-gray-500">Up to 60 characters. You can use one variable, {"{{1}}"}.</p>
            {headerHasVar && (
              <input value={headerExample} onChange={(e) => setHeaderExample(e.target.value)}
                placeholder="Example for {{1}}, e.g. Ravi" className={field} />
            )}
          </div>
        )}

        {(headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
          <div className="mt-3">
            <input
              type="file"
              accept={SAMPLE_RULES[headerFormat].types.join(",")}
              onChange={(e) => e.target.files?.[0] && uploadSample(e.target.files[0])}
              className="block w-full text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload a small sample ({SAMPLE_RULES[headerFormat].label}, under 4 MB) for WhatsApp to review.
              You pick the real file each time you send the template.
            </p>
            {uploading && <p className="text-xs text-gray-600 mt-1">Uploading sample...</p>}
            {mediaHandle && <p className="text-xs text-green-700 mt-1">Sample ready: {mediaName}</p>}
          </div>
        )}
      </fieldset>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium mb-1">Message text</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={1024}
          placeholder="Hi {{1}}, your order {{2}} is ready for pickup."
          className={field}
        />
        <p className="text-xs text-gray-500 mt-1">
          Use {"{{1}}"}, {"{{2}}"} for details that change per customer. {body.length}/1024
        </p>
      </div>

      {vars.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Example values</p>
          <p className="text-xs text-gray-500 mb-2">Meta needs a sample for each variable to review the template.</p>
          <div className="space-y-2">
            {vars.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <span className="w-12 text-sm text-gray-600">{`{{${n}}}`}</span>
                <input value={examples[n] ?? ""} onChange={(e) => setExamples({ ...examples, [n]: e.target.value })}
                  className={field} placeholder={n === 1 ? "e.g. Ravi" : "e.g. 1234"} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div>
        <label className="block text-sm font-medium mb-1">Footer (optional)</label>
        <input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60}
          placeholder="Reply STOP to opt out" className={field} />
        <p className="text-xs text-gray-500 mt-1">Up to 60 characters, no variables.</p>
      </div>

      {/* Buttons */}
      <fieldset className="rounded-xl border p-4">
        <legend className="px-2 text-sm font-medium">Buttons (optional)</legend>
        <div className="space-y-4">
          {buttons.map((b, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-gray-500">
                  {b.type === "QUICK_REPLY" ? "Quick reply" : b.type === "URL" ? "Link" : "Call"}
                </span>
                <button type="button" onClick={() => setButtons(buttons.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-600 underline">Remove</button>
              </div>
              <input value={b.text} onChange={(e) => updateButton(i, { text: e.target.value })} maxLength={25}
                placeholder="Button label (max 25 characters)" className={field} />
              {b.type === "URL" && (
                <>
                  <input value={b.url} onChange={(e) => updateButton(i, { url: e.target.value })}
                    placeholder="https://example.com/orders/{{1}}" className={field} />
                  {/\{\{1\}\}$/.test(b.url) && (
                    <input value={b.example ?? ""} onChange={(e) => updateButton(i, { example: e.target.value })}
                      placeholder="Example full link, e.g. https://example.com/orders/1234" className={field} />
                  )}
                </>
              )}
              {b.type === "PHONE_NUMBER" && (
                <input value={b.phone} onChange={(e) => updateButton(i, { phone: e.target.value })}
                  placeholder="+919876543210" className={field} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={buttons.length >= 10} onClick={() => addButton("QUICK_REPLY")}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40">+ Quick reply</button>
          <button type="button" disabled={counts.URL >= 2 || buttons.length >= 10} onClick={() => addButton("URL")}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40">+ Link</button>
          <button type="button" disabled={counts.PHONE_NUMBER >= 1 || buttons.length >= 10} onClick={() => addButton("PHONE_NUMBER")}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40">+ Call</button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Up to 10 buttons: any number of quick replies, 2 links and 1 call.</p>
      </fieldset>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{err}</p>}
      <button type="submit" disabled={busy || uploading}
        className="rounded-lg bg-black text-white px-5 py-2 text-sm font-medium disabled:opacity-50">
        {busy ? "Submitting..." : "Submit for approval"}
      </button>
    </form>
  );
}
