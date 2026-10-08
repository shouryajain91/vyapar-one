import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Vyapar One",
  description:
    "How Vyapar One collects, uses, and protects your data and your customers' WhatsApp messages.",
};

const EFFECTIVE_DATE = "October 8, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold mt-10 mb-3 text-gray-900">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-medium mt-6 mb-2 text-gray-900">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-gray-700 mb-4">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-gray-700 mb-4">
      {children}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold mb-2 text-gray-900">
        Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 mb-10">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <P>
        Vyapar One (&quot;Vyapar One&quot;, &quot;we&quot;, &quot;us&quot;, or
        &quot;our&quot;) provides a platform that lets businesses connect
        their own WhatsApp Business Account (via Meta&apos;s WhatsApp
        Business Platform) and manage customer conversations from a shared
        inbox. This Privacy Policy explains what information we collect,
        how we use it, and the choices you have, both as a business using
        Vyapar One (&quot;Business User&quot;, &quot;you&quot;) and as a
        customer who messages a business that uses Vyapar One (&quot;End
        Customer&quot;).
      </P>

      <H2>1. Information We Collect</H2>
      <H3>a. Account and business information</H3>
      <Ul>
        <li>Business name, contact email, and login credentials.</li>
        <li>
          Information obtained through Meta&apos;s WhatsApp Embedded
          Signup, including your WhatsApp Business Account (WABA) ID,
          phone number ID, verified business display name, and an access
          token issued by Meta that authorizes Vyapar One to send and
          receive messages on your behalf.
        </li>
      </Ul>

      <H3>b. Message data</H3>
      <Ul>
        <li>
          The content, timestamps, delivery/read status, and message type
          (text, template, media, interactive button, etc.) of messages
          sent and received through your connected WhatsApp number.
        </li>
        <li>
          End Customers&apos; WhatsApp phone numbers and profile display
          names, as provided by WhatsApp when they message your business.
        </li>
      </Ul>

      <H3>c. Usage and technical data</H3>
      <Ul>
        <li>
          Log data such as IP address, browser type, and pages visited
          within the Vyapar One dashboard, used for security and
          troubleshooting.
        </li>
      </Ul>

      <H2>2. How We Use Information</H2>
      <Ul>
        <li>
          To operate the shared inbox and deliver messages between you and
          your End Customers.
        </li>
        <li>
          To authenticate your account and maintain the security of the
          platform.
        </li>
        <li>
          To sync WhatsApp message templates and their approval status from
          Meta.
        </li>
        <li>To provide customer support and respond to your requests.</li>
        <li>
          To comply with legal obligations and Meta&apos;s WhatsApp
          Business Platform policies.
        </li>
      </Ul>
      <P>
        We do not sell your data or your End Customers&apos; data to third
        parties, and we do not use message content to serve advertising.
      </P>

      <H2>3. How Information Is Shared</H2>
      <Ul>
        <li>
          <strong>Meta / WhatsApp.</strong> Because Vyapar One operates as
          a Tech Provider on Meta&apos;s WhatsApp Business Platform, all
          messages necessarily pass through Meta&apos;s infrastructure
          (Meta Platforms, Inc.) to be delivered to and from WhatsApp.
          Meta&apos;s own privacy policy and WhatsApp Business messaging
          terms govern their handling of this data. See{" "}
          <a
            href="https://www.whatsapp.com/legal/business-data-processing-terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            WhatsApp Business Data Processing Terms
          </a>
          .
        </li>
        <li>
          <strong>Service providers.</strong> We use infrastructure
          providers (such as hosting and database providers) strictly to
          operate the platform; they process data on our behalf under
          confidentiality obligations.
        </li>
        <li>
          <strong>Legal requirements.</strong> We may disclose information
          if required by law, regulation, or valid legal process.
        </li>
      </Ul>

      <H2>4. Data Security</H2>
      <P>
        WhatsApp access tokens are encrypted at rest (AES-256-GCM) and are
        never exposed to the browser. Incoming webhook requests from Meta
        are verified using HMAC signature validation. Access to the
        dashboard requires authentication, and each Business User can only
        view data belonging to their own connected WhatsApp account(s).
      </P>

      <H2>5. Data Retention</H2>
      <P>
        We retain message and account data for as long as your account is
        active, or as needed to provide the service. You may request
        deletion of your business account and associated data at any time
        by contacting us (see Section 8). Some data may be retained where
        required for legal, security, or fraud-prevention purposes.
      </P>

      <H2>6. Your Rights</H2>
      <P>
        Depending on your location, you may have rights to access,
        correct, export, or delete your personal data. Business Users can
        request these actions by contacting us directly. End Customers who
        wish to stop receiving messages from a business can reply
        &quot;STOP&quot; or use WhatsApp&apos;s built-in block/report
        features, and may also contact the business they messaged
        directly.
      </P>

      <H2>7. Children&apos;s Privacy</H2>
      <P>
        Vyapar One is intended for business use and is not directed to
        children. We do not knowingly collect personal data from children
        under 13 (or the minimum age required by applicable law).
      </P>

      <H2>8. Contact Us</H2>
      <P>
        If you have questions about this Privacy Policy or wish to
        exercise your data rights, contact us at{" "}
        <a href="mailto:privacy@vyapar-one.com" className="underline">
          privacy@vyapar-one.com
        </a>
        .
      </P>

      <H2>9. Changes to This Policy</H2>
      <P>
        We may update this Privacy Policy from time to time. We will post
        the updated version on this page with a revised effective date.
      </P>
    </main>
  );
}
