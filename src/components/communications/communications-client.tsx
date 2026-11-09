"use client";

import { useState } from "react";
import { BellRing, Mail, MessageSquare, Radio, Send } from "lucide-react";

type Props = {
  pushConfigured: boolean;
  emailConfigured: boolean;
  smsConfigured: boolean;
  adminEmail: string;
};

type Status = { kind: "idle" | "ok" | "error"; text?: string };

function ChannelRow({
  icon,
  name,
  configured,
  pendingNote,
}: {
  icon: React.ReactNode;
  name: string;
  configured: boolean;
  pendingNote?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--foreground)]">
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">{name}</p>
          {!configured && pendingNote ? (
            <p className="text-xs text-[var(--muted)]">{pendingNote}</p>
          ) : null}
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          configured
            ? "bg-emerald-500/15 text-emerald-600"
            : "bg-amber-500/15 text-amber-600"
        }`}
      >
        {configured ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

export function CommunicationsClient({
  pushConfigured,
  emailConfigured,
  smsConfigured,
  adminEmail,
}: Props) {
  const [pushStatus, setPushStatus] = useState<Status>({ kind: "idle" });
  const [pushBusy, setPushBusy] = useState(false);
  const [emailTo, setEmailTo] = useState(adminEmail);
  const [emailStatus, setEmailStatus] = useState<Status>({ kind: "idle" });
  const [emailBusy, setEmailBusy] = useState(false);

  async function testPush() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushStatus({ kind: "idle" });
    try {
      const r = await fetch("/api/communications/test-push", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setPushStatus({
          kind: "ok",
          text: `Sent to ${d.devices} device${d.devices === 1 ? "" : "s"} — check your lock screen.`,
        });
      } else {
        setPushStatus({ kind: "error", text: d.error || "Couldn't send." });
      }
    } catch {
      setPushStatus({ kind: "error", text: "Couldn't send." });
    } finally {
      setPushBusy(false);
    }
  }

  async function testEmail() {
    if (emailBusy) return;
    setEmailBusy(true);
    setEmailStatus({ kind: "idle" });
    try {
      const r = await fetch("/api/communications/test-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: emailTo }),
      });
      const d = await r.json();
      if (r.ok) {
        setEmailStatus({ kind: "ok", text: `Sent to ${d.to}.` });
      } else {
        setEmailStatus({ kind: "error", text: d.error || "Couldn't send." });
      }
    } catch {
      setEmailStatus({ kind: "error", text: "Couldn't send." });
    } finally {
      setEmailBusy(false);
    }
  }

  function statusLine(s: Status) {
    if (s.kind === "idle") return null;
    return (
      <p
        className={`mt-2 text-xs ${
          s.kind === "ok" ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {s.text}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          <Radio className="h-3.5 w-3.5" />
          Communications
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Channels &amp; test center
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The delivery channels the hub uses to reach staff, and quick tests to
          confirm they&apos;re working.
        </p>
      </header>

      {/* Channel status */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
          Channels
        </h2>
        <div className="divide-y divide-[var(--border)]">
          <ChannelRow
            icon={<BellRing className="h-4 w-4" />}
            name="Push notifications"
            configured={pushConfigured}
            pendingNote="Add VAPID keys to enable."
          />
          <ChannelRow
            icon={<Mail className="h-4 w-4" />}
            name="Email (Resend)"
            configured={emailConfigured}
            pendingNote="Add RESEND_API_KEY / EMAIL_FROM to enable."
          />
          <ChannelRow
            icon={<MessageSquare className="h-4 w-4" />}
            name="SMS (Twilio)"
            configured={smsConfigured}
            pendingNote="Connect Twilio (Account SID, Auth Token, number) to enable."
          />
        </div>
      </section>

      {/* Test center */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Test center
        </h2>

        {/* Push */}
        <div className="border-b border-[var(--border)] pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Test push
              </p>
              <p className="text-xs text-[var(--muted)]">
                Sends a notification to your own devices.
              </p>
            </div>
            <button
              type="button"
              onClick={testPush}
              disabled={pushBusy || !pushConfigured}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {pushBusy ? "Sending…" : "Send"}
            </button>
          </div>
          {statusLine(pushStatus)}
        </div>

        {/* Email */}
        <div className="border-b border-[var(--border)] py-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Test email
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={testEmail}
              disabled={emailBusy || !emailConfigured || !emailTo.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {emailBusy ? "Sending…" : "Send"}
            </button>
          </div>
          {statusLine(emailStatus)}
        </div>

        {/* SMS */}
        <div className="pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Test SMS
              </p>
              <p className="text-xs text-[var(--muted)]">
                {smsConfigured
                  ? "Available in the SMS Portal."
                  : "Connect Twilio to enable SMS."}
              </p>
            </div>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] disabled:opacity-60"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {smsConfigured ? "SMS Portal" : "Not connected"}
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs text-[var(--muted)]">
        A full message/audit log (every SMS, email, and notification sent) will
        land here alongside the SMS Portal.
      </p>
    </div>
  );
}
