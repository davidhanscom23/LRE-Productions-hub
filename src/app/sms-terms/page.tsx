import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "SMS Terms & Conditions — LRE Productions",
  description:
    "Terms and conditions for the LRE Productions staff text-messaging (SMS) program.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
      {children}
    </h2>
  );
}

export default function SmsTermsPage() {
  return (
    <LegalShell title="SMS Terms &amp; Conditions" updated="August 9, 2026">
      <p>
        These Terms &amp; Conditions govern the text-messaging (SMS/MMS) program
        operated by LRE Productions, Inc. (&ldquo;LRE
        Productions,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) for our team members. By providing your mobile number
        and opting in, you agree to these terms.
      </p>

      <div>
        <H2>Program description</H2>
        <p className="mt-2">
          LRE Productions sends text messages to team members for operational
          purposes, including scheduling, shift and event coordination, team
          huddle reminders, and time-sensitive staff alerts. This is an
          internal, non-marketing program for people who work with us.
        </p>
      </div>

      <div>
        <H2>Opting in / consent</H2>
        <p className="mt-2">
          You provide your consent to receive text messages when you give us
          your mobile number as part of your staff profile or otherwise opt in.
          Your consent to receive texts is not a condition of any purchase.
        </p>
      </div>

      <div>
        <H2>Message frequency</H2>
        <p className="mt-2">
          Message frequency varies based on scheduling and event activity.
        </p>
      </div>

      <div>
        <H2>Cost</H2>
        <p className="mt-2">
          <strong>Message and data rates may apply.</strong> LRE Productions
          does not charge for the messages, but your mobile carrier&rsquo;s
          standard rates will apply based on your plan.
        </p>
      </div>

      <div>
        <H2>Opting out</H2>
        <p className="mt-2">
          You can cancel the SMS program at any time by texting{" "}
          <strong>STOP</strong> to the number you receive messages from. After
          you send <strong>STOP</strong>, we will send a one-time confirmation
          and will stop sending you text messages. You may re-join at any time by
          texting <strong>START</strong> or by contacting us.
        </p>
      </div>

      <div>
        <H2>Help</H2>
        <p className="mt-2">
          For help, reply <strong>HELP</strong> to any message, or contact us at{" "}
          <a href="tel:+19048341216" className="text-[var(--brand)] hover:underline">
            401-816-5496
          </a>{" "}
          or{" "}
          <a
            href="mailto:hello@lreproductions.com"
            className="text-[var(--brand)] hover:underline"
          >
            hello@lreproductions.com
          </a>
          .
        </p>
      </div>

      <div>
        <H2>Supported carriers</H2>
        <p className="mt-2">
          Carriers are not liable for delayed or undelivered messages. Delivery
          is subject to your carrier&rsquo;s network availability.
        </p>
      </div>

      <div>
        <H2>Privacy</H2>
        <p className="mt-2">
          Your privacy matters to us.{" "}
          <strong>
            We do not share, sell, or provide your mobile phone number or
            messaging consent data to third parties or affiliates for marketing
            or promotional purposes.
          </strong>{" "}
          Information is shared only with the providers that help us deliver
          these messages. For more detail, see our{" "}
          <a href="/privacy" className="text-[var(--brand)] hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>

      <div>
        <H2>Changes to these terms</H2>
        <p className="mt-2">
          We may update these Terms &amp; Conditions from time to time. When we
          do, we will revise the &ldquo;Last updated&rdquo; date at the top of
          this page.
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
