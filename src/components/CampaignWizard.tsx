"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readSheet } from "read-excel-file/browser";
import { parseCsv } from "@/lib/csv";
import { describeInputs, renderBody, type SendableTemplate } from "@/lib/template-send";
import { normalizeNumber } from "@/lib/phone";
import { Alert, Button, Card, hintCls, inputCls, labelCls } from "@/components/ui";
import { WaPreview } from "@/components/WaPreview";

const MAX = 5000;
const NONE = -1;
const keyOf = (t: SendableTemplate) => `${t.name}|${t.language}`;

export function CampaignWizard({ templates }: { templates: SendableTemplate[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [key, setKey] = useState(templates[0] ? keyOf(templates[0]) : "");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][]>([]); // row 0 = headers
  const [phoneCol, setPhoneCol] = useState(NONE);
  const [nameCol, setNameCol] = useState(NONE);
  const [bodyCols, setBodyCols] = useState<Record<number, number>>({});
  const [headerCol, setHeaderCol] = useState(NONE);
  const [btnCols, setBtnCols] = useState<Record<number, number>>({});
  const [headerLink, setHeaderLink] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tpl = templates.find((t) => keyOf(t) === key);
  const need = useMemo(() => (tpl ? describeInputs(tpl) : null), [tpl]);
  const headers = table[0] ?? [];
  const data = table.slice(1);

  function automap(cols: string[], t: SendableTemplate | undefined) {
    const n = t ? describeInputs(t) : null;
    const find = (re: RegExp) => cols.findIndex((c) => re.test(c));
    const p = find(/phone|mobile|whatsapp|number|contact/i);
    const nm = find(/name/i);
    setPhoneCol(p);
    setNameCol(nm === p ? NONE : nm);
    const used = new Set([p, nm]);
    const free = cols.map((_, i) => i).filter((i) => !used.has(i));
    const bc: Record<number, number> = {};
    n?.bodyVars.forEach((v, i) => { bc[v] = free[i] ?? NONE; });
    setBodyCols(bc);
    setHeaderCol(NONE);
    setBtnCols({});
  }

  function pickTemplate(k: string) {
    setKey(k);
    automap(headers, templates.find((t) => keyOf(t) === k));
  }

  async function onFile(file: File) {
    setErr(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("That file is too large (max 10 MB).");
      let rows: unknown[][];
      if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
      else if (/\.xlsx$/i.test(file.name)) rows = (await readSheet(file)) as unknown[][];
      else throw new Error("Upload an .xlsx or .csv file. (Older .xls files: save as .xlsx first.)");
      const t = rows
        .map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())))
        .filter((r) => r.some((c) => c !== ""));
      if (t.length < 2) throw new Error("The file needs a header row and at least one data row.");
      if (t.length - 1 > MAX) throw new Error(`This file has ${t.length - 1} rows. The limit is ${MAX} per campaign; split it and upload in parts.`);
      setTable(t);
      setFileName(file.name);
      automap(t[0], tpl);
    } catch (e) {
      setTable([]);
      setFileName("");
      setErr((e as Error).message || "Couldn't read that file.");
    }
  }

  const cell = (r: string[], c: number) => (c === NONE ? "" : (r[c] ?? ""));

  const built = useMemo(() => {
    if (!need || !table.length || phoneCol === NONE) return [];
    return data.map((r) => ({
      phone: cell(r, phoneCol),
      name: cell(r, nameCol),
      body: need.bodyVars.map((v) => cell(r, bodyCols[v] ?? NONE)),
      header_text: need.headerVar ? cell(r, headerCol) : undefined,
      buttons: Object.fromEntries(need.urlButtons.map((b) => [String(b.index), cell(r, btnCols[b.index] ?? NONE)])),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need, table, phoneCol, nameCol, bodyCols, headerCol, btnCols]);

  const validPhones = built.filter((r) => normalizeNumber(r.phone)).length;
  const missingValues = built.filter((r) => r.body.some((v) => !v)).length;
  const allMapped = !!need && need.bodyVars.every((v) => (bodyCols[v] ?? NONE) !== NONE) &&
    (!need.headerVar || headerCol !== NONE) && need.urlButtons.every((b) => (btnCols[b.index] ?? NONE) !== NONE);

  async function submit() {
    if (!tpl || !need) return;
    setErr(null);
    if (!name.trim()) return setErr("Give the campaign a name.");
    if (!built.length || phoneCol === NONE) return setErr("Upload a file and choose the phone number column.");
    if (!allMapped) return setErr("Choose a column for every variable.");
    if (need.headerMedia && !/^https:\/\/\S+$/.test(headerLink.trim())) return setErr("Paste an https link for the header media.");
    if (when === "later" && !at) return setErr("Pick the date and time to send.");
    if (!consent) return setErr("Please confirm the customers agreed to receive your WhatsApp messages.");
    // The picker value is India time; convert to an exact instant.
    const scheduled = when === "later" ? new Date(`${at}:00+05:30`).toISOString() : null;
    setBusy(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, template_name: tpl.name, template_language: tpl.language,
        header_link: need.headerMedia ? headerLink.trim() : undefined,
        scheduled_at: scheduled, consent, rows: built,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); return setErr(j.error ?? "Something went wrong."); }
    router.push(`/campaigns/${j.id}`);
  }

  if (!templates.length) {
    return <Alert tone="info">You need an approved template before you can send a campaign. Create one under Templates and wait for WhatsApp to approve it.</Alert>;
  }

  const sample = built[0];
  const ColPick = ({ value, onChange, optional }: { value: number; onChange: (n: number) => void; optional?: boolean }) => (
    <select className={inputCls} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={NONE}>{optional ? "— none —" : "— choose column —"}</option>
      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
    </select>
  );

  function sampleCsv() {
    const cols = ["phone", "name", ...(need?.bodyVars.map((v) => `var${v}`) ?? [])];
    const row = ["919876543210", "Asha", ...(need?.bodyVars.map((v) => `value${v}`) ?? [])];
    const url = URL.createObjectURL(new Blob([cols.join(",") + "\n" + row.join(",") + "\n"], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "campaign-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {err && <Alert tone="error">{err}</Alert>}

      <Card title="1. Campaign and template">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="cname">Campaign name</label>
            <input id="cname" className={inputCls} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali offer – Nov 2026" />
          </div>
          <div>
            <label className={labelCls} htmlFor="ctpl">Approved template</label>
            <select id="ctpl" className={inputCls} value={key} onChange={(e) => pickTemplate(e.target.value)}>
              {templates.map((t) => <option key={keyOf(t)} value={keyOf(t)}>{t.name} ({t.language})</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card title="2. Upload your contacts" description="An Excel (.xlsx) or CSV file. The first row must be column headings, one customer per row.">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
          <button type="button" onClick={sampleCsv} className="text-sm font-medium text-brand-700 underline">Download a sample file</button>
        </div>
        <p className={hintCls}>Up to {MAX} customers per campaign. Numbers need a country code (10-digit Indian mobiles are assumed to be +91). The file is read in your browser.</p>
        {fileName && <p className="mt-2 text-sm text-slate-700">{fileName}: {data.length} rows</p>}
      </Card>

      {table.length > 0 && need && tpl && (
        <>
          <Card title="3. Match columns" description="Tell us which column holds each piece of information.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Phone number</label><ColPick value={phoneCol} onChange={setPhoneCol} /></div>
              <div><label className={labelCls}>Customer name (optional)</label><ColPick value={nameCol} onChange={setNameCol} optional /></div>
              {need.bodyVars.map((v) => (
                <div key={v}><label className={labelCls}>Message variable {`{{${v}}}`}</label>
                  <ColPick value={bodyCols[v] ?? NONE} onChange={(n) => setBodyCols({ ...bodyCols, [v]: n })} /></div>
              ))}
              {need.headerVar && <div><label className={labelCls}>Header variable</label><ColPick value={headerCol} onChange={setHeaderCol} /></div>}
              {need.urlButtons.map((b) => (
                <div key={b.index}><label className={labelCls}>Link value for “{b.label}”</label>
                  <ColPick value={btnCols[b.index] ?? NONE} onChange={(n) => setBtnCols({ ...btnCols, [b.index]: n })} /></div>
              ))}
              {need.headerMedia && (
                <div className="sm:col-span-2">
                  <label className={labelCls}>Header {need.headerMedia.toLowerCase()} link (same for everyone)</label>
                  <input className={inputCls} value={headerLink} onChange={(e) => setHeaderLink(e.target.value)} placeholder="https://…" />
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              {validPhones} of {built.length} rows have a valid phone number
              {missingValues > 0 && <>; <span className="text-amber-700">{missingValues} have an empty variable and will be marked failed</span></>}.
              Repeated numbers are sent once, and anyone who has opted out is skipped automatically.
            </p>
            {sample && (
              <div className="mt-4"><p className={labelCls}>Preview (first row)</p>
                <WaPreview headerText={need.headerVar ? sample.header_text : tpl.header_text} headerMedia={need.headerMedia?.toLowerCase()}
                  body={renderBody(tpl, sample.body)} footer={tpl.footer} buttons={tpl.buttons ?? []} /></div>
            )}
          </Card>

          <Card title="4. When to send">
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> Send now</label>
              <label className="flex items-center gap-2"><input type="radio" checked={when === "later"} onChange={() => setWhen("later")} /> Schedule for later</label>
              {when === "later" && (
                <div><input type="datetime-local" className={inputCls + " max-w-xs"} value={at} onChange={(e) => setAt(e.target.value)} />
                  <p className={hintCls}>India time (IST). Scheduled campaigns start within a minute of this time.</p></div>
              )}
              <label className="flex items-start gap-2 pt-2"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I confirm these customers agreed to receive WhatsApp messages from my business.</span></label>
            </div>
            <div className="mt-5">
              <Button variant="primary" disabled={busy} onClick={submit}>
                {busy ? "Creating…" : when === "later" ? "Schedule campaign" : `Send to ${validPhones} customers now`}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
