"use client";
import { useState } from "react";
import { fillReply, pickRule, type BotRuleLike } from "@/lib/bot";

interface R extends BotRuleLike { name: string; reply_text: string }

/** Try a customer message against your active rules without sending anything. */
export function BotTester({ rules }: { rules: R[] }) {
  const [text, setText] = useState("");
  const hit = text.trim() ? pickRule(rules, text) : null;
  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a customer message, e.g. What is the price?"
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      {text.trim() && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          {hit ? (<><div className="text-xs text-slate-500">Matches “{hit.name}” — the bot would reply:</div>
            <div className="mt-1 whitespace-pre-wrap text-slate-900">{fillReply(hit.reply_text, "Asha")}</div></>)
            : <span className="text-slate-500">No rule matches. The bot would stay silent.</span>}
        </div>
      )}
    </div>
  );
}
