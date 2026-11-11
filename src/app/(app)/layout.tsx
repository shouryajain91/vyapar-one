import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { NavLink } from "@/components/NavLink";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { getSessionContext, getSessionUser } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { AlertsBanner } from "@/components/AlertsBanner";
import { DemoCaptions } from "@/components/DemoCaptions";
import { DemoToggle } from "@/components/DemoToggle";
import { logoutAction } from "./actions";

/** Platform-admin link: only shown to emails in PLATFORM_ADMIN_EMAILS. */
async function AdminNav() {
  const user = await getSessionUser();
  if (!isPlatformAdminEmail(user?.email)) return null;
  return (
    <div className="pt-4">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Platform</p>
      <NavLink href="/admin" icon={<Icon name="shield" className="h-5 w-5" />}>
        Admin
      </NavLink>
    </div>
  );
}

/** Business name, email and Log out. */
async function SidebarUser() {
  const user = await getSessionUser();
  if (!user) return null;
  const ctx = await getSessionContext();
  const business = (ctx?.client?.business_name as string | undefined) ?? null;

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="mb-3 flex items-center gap-3 px-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
          {(business ?? user.email ?? "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{business ?? "Your business"}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </div>
      <DemoToggle />
      <Link href="/account/password" className="mb-2 block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
        Change password
      </Link>
      <form action={logoutAction}>
        <button type="submit" className={buttonClass("secondary", "md", "w-full")}>
          <Icon name="logout" />
          Log out
        </button>
      </form>
    </div>
  );
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app-icon.png" alt="" className="h-8 w-8 rounded-lg" />
        <span className="text-lg font-bold tracking-tight text-slate-900">Vyapar One</span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <NavLink href="/dashboard" icon={<Icon name="home" className="h-5 w-5" />}>Dashboard</NavLink>
        <NavLink href="/inbox" icon={<Icon name="chat" className="h-5 w-5" />}>Inbox</NavLink>
        <NavLink href="/templates" icon={<Icon name="template" className="h-5 w-5" />}>Templates</NavLink>
        <NavLink href="/campaigns" icon={<Icon name="send" className="h-5 w-5" />}>Campaigns</NavLink>
        <NavLink href="/bot" icon={<Icon name="bot" className="h-5 w-5" />}>Bot</NavLink>
        <NavLink href="/reports" icon={<Icon name="chart" className="h-5 w-5" />}>Reports</NavLink>
        <NavLink href="/alerts" icon={<Icon name="shield" className="h-5 w-5" />}>Alerts</NavLink>
        <NavLink href="/opt-outs" icon={<Icon name="ban" className="h-5 w-5" />}>Opt-outs</NavLink>
        <Suspense fallback={null}>
          <AdminNav />
        </Suspense>
      </nav>
      <Suspense fallback={<div className="h-28 border-t border-slate-200" />}>
        <SidebarUser />
      </Suspense>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell sidebar={<SidebarContent />}>
        <Suspense fallback={null}>
          <AlertsBanner />
        </Suspense>
        {children}
      </AppShell>
      <DemoCaptions />
    </>
  );
}
