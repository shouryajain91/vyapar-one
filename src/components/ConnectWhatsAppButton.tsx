"use client";

import { showDemoCaption, PERM_MGMT, PERM_MSG } from "@/lib/demo";
import { buttonClass } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    FB?: {
      init: (opts: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras?: Record<string, unknown>;
        }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FacebookLoginResponse {
  authResponse?: { code: string };
  status?: string;
}

interface SignupData {
  waba_id?: string;
  phone_number_id?: string;
}

export function ConnectWhatsAppButton({
  clientId,
  label = "Connect WhatsApp",
  variant = "primary",
}: {
  clientId: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [sdkReady, setSdkReady] = useState(false);

  // Load the Facebook JS SDK once.
  useEffect(() => {
    if (window.FB) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID!,
        xfbml: false,
        version: "v21.0",
      });
      setSdkReady(true);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // Listen for the postMessage event Embedded Signup sends with
  // the waba_id and phone_number_id once the user finishes the flow.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          const { waba_id, phone_number_id } = data.data as SignupData;
          if (waba_id && phone_number_id) {
            window.sessionStorage.setItem(
              "wa_signup_data",
              JSON.stringify({ waba_id, phone_number_id })
            );
          }
        }
      } catch {
        // not a JSON message we care about
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const finishSignup = useCallback(
    async (response: FacebookLoginResponse) => {
      const code = response.authResponse?.code;
      if (!code) {
        setStatus("error");
        return;
      }

      const stored = window.sessionStorage.getItem("wa_signup_data");
      const signupData: SignupData = stored ? JSON.parse(stored) : {};

      if (!signupData.waba_id || !signupData.phone_number_id) {
        console.error("Missing waba_id/phone_number_id from signup flow");
        setStatus("error");
        return;
      }

      try {
        const res = await fetch("/api/onboarding/embedded-signup-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            code,
            waba_id: signupData.waba_id,
            phone_number_id: signupData.phone_number_id,
          }),
        });
        if (res.ok) {
          setStatus("connected");
          showDemoCaption({ text: "Connected. The business account and phone number are now linked to this workspace.", permission: PERM_MGMT, ms: 7000 });
          window.sessionStorage.removeItem("wa_signup_data");
          router.refresh();
        } else {
          setStatus("error");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    },
    [clientId, router]
  );

  const handleConnect = useCallback(() => {
    if (!window.FB) return;
    setStatus("connecting");
    showDemoCaption({ text: "Meta Embedded Signup opens. The business logs in, picks its WhatsApp Business account and phone number, and grants access.", permission: `${PERM_MGMT} + ${PERM_MSG}`, ms: 12000 });

    // IMPORTANT: this callback must be a plain (non-async) function.
    // The Facebook SDK does a strict typeof/constructor check on the
    // login callback and silently rejects an async function (its
    // runtime type is AsyncFunction, not Function), which causes
    // FB.login to throw before the popup ever opens. So we hand it a
    // synchronous wrapper and fire off the async work inside.
    window.FB.login(
      function (response) {
        void finishSignup(response);
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID!,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
  }, [finishSignup]);

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={!sdkReady || status === "connecting"}
        className={buttonClass(variant)}
      >
        {status === "connected"
          ? "Connected ✓"
          : status === "connecting"
          ? "Connecting..."
          : label}
      </button>
      {status === "error" && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Something went wrong connecting WhatsApp. Please try again.
        </p>
      )}
    </div>
  );
}
