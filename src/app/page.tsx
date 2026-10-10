import Link from "next/link";
import type { CSSProperties } from "react";

// Brand tokens (from the design handoff)
const BG = "#0C1417";
const TEAL = "#4FD1D9";
const TEAL_BRIGHT = "#09AEB5";
const AMBER = "#FCB454";
const INK = "#161A1D";
const MUTED = "#A9B7BC";
const MUTED_2 = "#7C8A90";
const BODY = "#E8EEF0";

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none" }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PrimaryButton({
  href,
  size = "lg",
  children,
}: {
  href: string;
  size?: "lg" | "sm";
  children: React.ReactNode;
}) {
  const style: CSSProperties =
    size === "lg"
      ? {
          height: 50,
          padding: "0 24px",
          fontSize: 17,
        }
      : {
          height: 34,
          padding: "0 14px",
          fontSize: 14,
        };
  return (
    <a
      href={href}
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        background: AMBER,
        color: INK,
        fontWeight: 800,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  );
}

const serviceCards = [
  {
    img: "/images/hero-whatsapp.webp",
    iconColor: TEAL,
    iconBg: "rgba(9,174,181,.18)",
    label: "आपकी वेबसाइट",
    title: "Website",
    desc: "A fast, mobile-ready site with your catalogue, location and contact details. We build it and keep it updated.",
    bullets: ["Mobile-ready pages", "Catalogue and maps", "Hosting included"],
    checkColor: TEAL,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    img: "/images/whatsapp-connect.webp",
    iconColor: "#4ADE80",
    iconBg: "rgba(74,222,128,.15)",
    label: "व्हाट्सऐप पर जुड़ें",
    title: "WhatsApp Connect",
    desc: "Reply to enquiries, send offers and take orders on WhatsApp. Automatic answers, with you in control.",
    bullets: ["Auto-replies 24×7", "Offers to your contacts", "Orders and pay links"],
    checkColor: "#4ADE80",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    ),
  },
  {
    img: "/images/calling-bot.webp",
    iconColor: AMBER,
    iconBg: "rgba(252,180,84,.16)",
    label: "बॉट से कॉल करें",
    title: "Calling Bot",
    desc: "A voice bot calls your customers for reminders, follow-ups and feedback in their language.",
    bullets: ["Reminders and follow-ups", "Feedback calls", "Hindi and English"],
    checkColor: AMBER,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
];

const audienceCards = [
  { img: "/images/shops-retail.webp", title: "Shops and retail" },
  { img: "/images/clinics-salons.webp", title: "Clinics and salons" },
  { img: "/images/tutors-services.webp", title: "Tutors and services" },
];

const journeySteps = [
  {
    color: TEAL,
    title: "Finds your website",
    desc: "Catalogue, location, offers",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    color: "#4ADE80",
    title: "Messages on WhatsApp",
    desc: "Instant answers, any hour",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    ),
  },
  {
    color: AMBER,
    title: "Places an order",
    desc: "Pay link sent in chat",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    color: TEAL,
    title: "Gets a follow-up call",
    desc: "Bot reminds and asks feedback",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: BG, position: "relative", overflow: "hidden", color: BODY, fontFamily: "Mukta, sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />

      {/* Background grid + glow */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 760, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "48px 48px", WebkitMaskImage: "linear-gradient(#000 30%,transparent)", maskImage: "linear-gradient(#000 30%,transparent)" }} />
      <div style={{ position: "absolute", top: -220, right: -120, width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, rgba(9,174,181,.35), transparent 65%)" }} />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(12,20,23,.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            <img src="/app-icon.png" alt="Vyapar One" style={{ width: 36, height: 36, borderRadius: 8 }} />
            vyapar<span style={{ color: AMBER }}>·</span>one
          </div>
          <nav style={{ display: "flex", gap: 28, fontWeight: 600 }}>
            <a href="#services" style={{ color: "#B6C2C7" }}>Services</a>
            <a href="#demo" style={{ color: "#B6C2C7" }}>Contact</a>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/login"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, height: 34, padding: "0 14px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Customer Portal
            </Link>
            <PrimaryButton href="#demo" size="sm">Book a Free Demo</PrimaryButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: "relative", padding: "88px 24px 72px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(79,209,217,.4)", background: "rgba(9,174,181,.12)", borderRadius: 999, padding: "5px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: TEAL }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: TEAL }} />
              छोटे व्यापार, बड़ी पहचान
            </div>
            <h1 style={{ fontSize: 64, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-2px", margin: "22px 0 18px", color: "#fff" }}>
              Run your business <span style={{ color: TEAL }}>on autopilot.</span>
            </h1>
            <p style={{ fontSize: 20, lineHeight: 1.55, color: MUTED, margin: "0 0 30px", maxWidth: 520 }}>
              A website, WhatsApp conversations and a calling bot, set up for you. Pick one, or use all three.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton href="#demo" size="lg">Book a Free Demo</PrimaryButton>
              <a href="#services" style={{ display: "inline-flex", alignItems: "center", height: 50, padding: "0 24px", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 17 }}>
                Our Services
              </a>
            </div>
          </div>
          <div style={{ position: "relative", padding: "0 0 40px 40px" }}>
            <div style={{ height: 520, borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,.15)" }}>
              <img src="/images/hero-whatsapp.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ position: "absolute", top: 24, right: -12, display: "flex", alignItems: "center", gap: 10, background: "#fff", color: "#161A1D", borderRadius: 14, padding: "12px 16px", boxShadow: "0 16px 40px rgba(0,0,0,.45)" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E3F7EA", color: "#00A848", display: "grid", placeItems: "center" }}>
                <CheckIcon color="#00A848" />
              </div>
              <div>
                <div style={{ fontSize: 13, color: "#6B7378" }}>New order</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 18 }}>₹1,640</div>
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, bottom: 0, width: "78%", background: "rgba(12,20,23,.88)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: TEAL_BRIGHT, color: BG, display: "grid", placeItems: "center", fontWeight: 800 }}>S</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff" }}>Sharma Sweets</div>
                    <div style={{ fontSize: 13, color: "#4ADE80" }}>● auto-reply on</div>
                  </div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: MUTED_2 }}>WhatsApp</div>
              </div>
              <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.09)", borderRadius: 12, padding: "10px 14px", maxWidth: "80%" }}>Namaste! Do you deliver to Rohini?</div>
              <div style={{ alignSelf: "flex-end", background: "#0E7C86", color: "#fff", borderRadius: 12, padding: "10px 14px", maxWidth: "80%" }}>Ji haan. Delivery is free above ₹499. Want to see today&apos;s menu?</div>
              <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.09)", borderRadius: 12, padding: "10px 14px", maxWidth: "80%" }}>Yes, 2 kg kaju katli please.</div>
              <div style={{ alignSelf: "flex-end", background: "#0E7C86", color: "#fff", borderRadius: 12, padding: "10px 14px", maxWidth: "80%" }}>
                Order placed: <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>₹1,640</span>. Dhanyavaad!
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section style={{ position: "relative", padding: "0 24px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {[
            { value: "7 days", label: "Typical time to go live", color: TEAL, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> },
            { value: "24×7", label: "Instant WhatsApp replies", color: "#4ADE80", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg> },
            { value: "हिं + EN", label: "Hindi and English, both ways", color: AMBER, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg> },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", gap: 14, alignItems: "center", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.07)", color: s.color, display: "grid", placeItems: "center" }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 24, fontWeight: 600, color: "#fff" }}>{s.value}</div>
                <div style={{ color: MUTED, fontSize: 15 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" style={{ position: "relative", padding: "72px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: TEAL, marginBottom: 10 }}>// SERVICES · हमारी सेवाएँ</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 32px", letterSpacing: "-1px", color: "#fff" }}>Three tools. Use one or all.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            {serviceCards.map((c) => (
              <div key={c.title} style={{ background: "linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, padding: 28 }}>
                <div style={{ height: 170, margin: "-28px -28px 22px", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
                  <img src={c.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: c.iconBg, color: c.iconColor, display: "grid", placeItems: "center" }}>{c.icon}</div>
                  <span style={{ fontSize: 13, color: MUTED_2 }}>{c.label}</span>
                </div>
                <h3 style={{ fontSize: 26, margin: "20px 0 8px", color: "#fff" }}>{c.title}</h3>
                <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.55, margin: 0 }}>{c.desc}</p>
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {c.bullets.map((b) => (
                    <div key={b} style={{ display: "flex", gap: 10, alignItems: "center", color: "#D5DEE1" }}>
                      <CheckIcon color={c.checkColor} />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section style={{ position: "relative", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: TEAL, marginBottom: 10 }}>// WHO IT&apos;S FOR · किनके लिए</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 32px", letterSpacing: "-1px", color: "#fff" }}>Made for every kind of local business.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
            {audienceCards.map((a) => (
              <div key={a.title} style={{ position: "relative", height: 320, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
                <img src={a.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "48px 20px 18px", background: "linear-gradient(transparent, rgba(12,20,23,.92))", pointerEvents: "none", fontWeight: 700, fontSize: 20, color: "#fff" }}>
                  {a.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer journey */}
      <section style={{ position: "relative", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: TEAL, marginBottom: 10 }}>// CUSTOMER JOURNEY · ग्राहक का सफ़र</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 40px", letterSpacing: "-1px", color: "#fff" }}>From first visit to repeat order.</h2>
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: "32px 16px" }}>
            <div style={{ position: "absolute", top: 36, left: "12%", right: "12%", borderTop: "2px dashed rgba(79,209,217,.35)" }} />
            {journeySteps.map((s) => (
              <div key={s.title} style={{ flex: "1 1 200px", textAlign: "center", position: "relative" }}>
                <div style={{ width: 72, height: 72, margin: "0 auto", borderRadius: "50%", background: BG, border: `2px solid ${s.color}`, color: s.color, display: "grid", placeItems: "center", boxShadow: `0 0 28px ${s.color}33` }}>
                  {s.icon}
                </div>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: 18, marginTop: 14 }}>{s.title}</div>
                <div style={{ color: MUTED, fontSize: 15, marginTop: 4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" style={{ position: "relative", padding: "24px 24px 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", background: "linear-gradient(135deg, #006C78, #008490 60%, #09AEB5)", borderRadius: 20, padding: 52, color: "#fff", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 40, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginBottom: 10, color: "#CFF3F5" }}>// FREE DEMO</div>
            <h2 style={{ margin: "0 0 12px", fontSize: 40, fontWeight: 800, letterSpacing: "-1px" }}>Book a Free Demo</h2>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55 }}>
              Tell us about your business and we will call you to suggest the right mix of services. Pricing is shared on the call.
            </p>
          </div>
          <form style={{ background: BG, border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 12, color: BODY }}>
            <input placeholder="Your name" style={{ height: 46, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.05)", color: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 16, fontFamily: "inherit" }} />
            <input placeholder="Business name" style={{ height: 46, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.05)", color: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 16, fontFamily: "inherit" }} />
            <input placeholder="Phone / WhatsApp number" style={{ height: 46, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.05)", color: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 16, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontWeight: 600 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" />Website</label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" />WhatsApp</label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" />Calling Bot</label>
            </div>
            <button type="button" style={{ height: 50, border: 0, borderRadius: 8, background: AMBER, color: INK, fontWeight: 800, fontSize: 17, fontFamily: "inherit", cursor: "pointer" }}>
              Book a Free Demo
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", borderTop: "1px solid rgba(255,255,255,.08)", color: MUTED_2, padding: "28px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
            vyapar<span style={{ color: AMBER }}>·</span>one
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/login">Customer Portal</Link>
            <Link href="/privacy-policy">Privacy Policy</Link>
            <span>© 2026 Vyapar-One. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
