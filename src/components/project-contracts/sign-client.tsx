"use client";

import { respondToContractAction } from "@/app/sign/[token]/actions";
import { CustomerEsignForm, type CustomerEsignFormValues } from "@/components/av-erp/customer-esign-form";
import { useState, useTransition } from "react";

export function SignClient({ token, defaultName, defaultEmail }: { token: string; defaultName: string; defaultEmail: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const submit = (values: CustomerEsignFormValues) =>
    start(async () => {
      setError(null);
      const res = await respondToContractAction({ token, ...values });
      if (res.ok) setDone(res.response);
      else setError(res.error);
    });

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-green-600/30 bg-green-600/10 px-4 py-5 text-sm">
        {done === "accepted"
          ? "Thank you! Your signature is recorded. A signed copy is on its way to your email."
          : "Thanks for letting us know. We will be in touch."}
      </div>
    );
  }
  return (
    <CustomerEsignForm
      docKind="contract"
      pending={pending}
      error={error}
      defaultName={defaultName}
      defaultEmail={defaultEmail}
      onSubmit={submit}
    />
  );
}
