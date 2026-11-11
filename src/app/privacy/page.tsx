import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — LRE Productions",
  description:
    "Privacy Policy for LRE Productions, including our staff SMS/text messaging program.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 9, 2026">
      <p>
        This Privacy Policy explains how LRE Productions, Inc.
        (&ldquo;LRE Productions,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
        or &ldquo;our&rdquo;) collects, uses, and protects information in
        connection with our staff portal at hub.lreproductions.com and our
        text-messaging program for team members. LRE Productions, Inc. is
        based in Tiverton, Rhode Island.
      </p>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="font-semibold text-[var(--foreground)]">
          SMS / text messaging consent &amp; data sharing
        </p>
        <p className="mt-2">
          LRE Productions operates a text-messaging (SMS) program for its
          team members.{" "}
          <strong>
            We do not share, sell, or provide your mobile phone number or
            messaging consent data to third parties or affiliates for marketing
            or promotional purposes.
          </strong>{" "}
          Mobile opt-in and consent information is never shared with any third
          parties for marketing. Message and data rates may apply, message
          frequency varies, and you can reply STOP to opt out or HELP for help
          at any time.
        </p>
      </div>

      <div>
        <H2>Who this policy covers</H2>
        <p className="mt-2">
          Our staff portal and SMS program are intended for LRE Productions
          team members, contractors, and applicants. We do not use this program
          to send marketing or promotional messages to the general public.
        </p>
      </div>

      <div>
        <H2>Information we collect</H2>
        <p className="mt-2">
          We collect information you provide to us and information needed to
          operate the staff portal, including: your name, mobile phone number,
          email address, role or department, work availability and scheduling
          details, and messages you send or receive through the portal. When you
          text with us, we collect the content of those messages and related
          delivery information.
        </p>
      </div>

      <div>
        <H2>How we use information</H2>
        <p className="mt-2">
          We use this information to operate our business and coordinate our
          team &mdash; for example, to share schedules and event details, send
          operational alerts and reminders (such as team huddle notifications),
          respond to your messages, and maintain the security of the portal. We
          do not sell your personal information.
        </p>
      </div>

      <div>
        <H2>SMS / text messaging program</H2>
        <p className="mt-2">
          With your consent, LRE Productions sends text messages to team
          members for operational purposes such as scheduling, shift and event
          coordination, huddle reminders, and time-sensitive alerts. Message
          frequency varies. Message and data rates may apply. You can opt out at
          any time by replying <strong>STOP</strong>, and you can reply{" "}
          <strong>HELP</strong> for assistance. See our{" "}
          <a href="/sms-terms" className="text-[var(--brand)] hover:underline">
            SMS Terms &amp; Conditions
          </a>{" "}
          for full details.
        </p>
        <p className="mt-3">
          <strong>
            We do not share, sell, or provide your mobile phone number or
            messaging consent data to third parties or affiliates for marketing
            or promotional purposes.
          </strong>{" "}
          Text-messaging originator opt-in data and consent are not shared with
          any third parties except the messaging providers described below
          solely to deliver the messages you have consented to receive.
        </p>
      </div>

      <div>
        <H2>How we share information</H2>
        <p className="mt-2">
          We share information only with service providers that help us operate
          the portal and messaging program &mdash; for example, our hosting and
          database providers and our SMS delivery provider (Twilio) &mdash; and
          only as needed to provide those services. We may also disclose
          information if required by law.
        </p>
      </div>

      <div>
        <H2>Data retention</H2>
        <p className="mt-2">
          We retain information for as long as needed to operate our business
          and meet legal and recordkeeping obligations, after which we delete or
          de-identify it.
        </p>
      </div>

      <div>
        <H2>Security</H2>
        <p className="mt-2">
          The staff portal is access-controlled and requires a login. We use
          reasonable administrative and technical safeguards to protect
          information, though no system can be guaranteed to be completely
          secure.
        </p>
      </div>

      <div>
        <H2>Your choices</H2>
        <p className="mt-2">
          You may opt out of text messages at any time by replying{" "}
          <strong>STOP</strong>. You may request access to or deletion of your
          information, or ask a question about this policy, by contacting us
          using the details below.
        </p>
      </div>

      <div>
        <H2>Children&rsquo;s privacy</H2>
        <p className="mt-2">
          Our portal and messaging program are intended for adults who work with
          LRE Productions and are not directed to children under 13.
        </p>
      </div>

      <div>
        <H2>Changes to this policy</H2>
        <p className="mt-2">
          We may update this Privacy Policy from time to time. When we do, we
          will revise the &ldquo;Last updated&rdquo; date at the top of this
          page.
        </p>
      </div>

      <div>
        <H2>Contact us</H2>
        <p className="mt-2">
          LRE Productions, Inc.
          <br />
          Tiverton, RI
          <br />
          Phone:{" "}
          <a href="tel:+19048341216" className="text-[var(--brand)] hover:underline">
            401-816-5496
          </a>
          <br />
          Email:{" "}
          <a
            href="mailto:hello@lreproductions.com"
            className="text-[var(--brand)] hover:underline"
          >
            hello@lreproductions.com
          </a>
        </p>
      </div>
    </LegalShell>
  );
}
