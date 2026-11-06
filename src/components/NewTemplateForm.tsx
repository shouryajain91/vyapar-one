"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, LANGUAGES, extractVariables, validateTemplate } from "@/lib/template-validate";

export function NewTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const vars = [...new Set(extractVariables(body))].sort((a, b) => a - b);
  const exampleList = vars.map((n) => examples[n] ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const input = { name, category, language, body, examples: exampleList };
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

  const field = "w-full rounded-lg border px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="space-y-5">
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
          <p className="text-sm font-medium mb-2">Example values</p>
          <p className="text-xs text-gray-500 mb-2">Meta needs a sample for each variable to review the template.</p>
          <div className="space-y-2">
            {vars.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <span className="w-12 text-sm text-gray-600">{`{{${n}}}`}</span>
                <input
                  value={examples[n] ?? ""}
                  onChange={(e) => setExamples({ ...examples, [n]: e.target.value })}
                  className={field}
                  placeholder={n === 1 ? "e.g. Ravi" : "e.g. 1234"}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{err}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-black text-white px-5 py-2 text-sm font-medium disabled:opacity-50">
        {busy ? "Submitting..." : "Submit for approval"}
      </button>
    </form>
  );
}
