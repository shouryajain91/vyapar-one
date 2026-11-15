import Link from "next/link";

const TABS = [
  { href: "/developers", label: "Keys & webhooks" },
  { href: "/developers/docs", label: "Documentation" },
  { href: "/developers/activity", label: "Activity" },
];

export function DevTabs({ active }: { active: string }) {
  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${active === t.href ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
