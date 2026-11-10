"use client";

import { useState, useTransition } from "react";
import { respondToPublicEstimateAction } from "@/app/estimate/[token]/respond-actions";
import {
  CustomerEsignForm,
  type CustomerEsignFormValues,
} from "@/components/av-erp/customer-esign-form";

type Props = {
  token: string;
  defaultName?: string;
  defaultEmail?: string;
  estimateResponse: "accepted" | "declined" | null;
  estimateNote: string;
  estimateSignerName?: string;
  contractResponse: "accepted" | "declined" | null;
  contractNote: string;
  contractSignerName?: string;
  /** When true, show contract panel after estimate accepted (or already Order). */
  allowContractSign: boolean;
};

function DoneBanner({
  title,
  note,
  signerName,
}: {
  title: string;
  note: string;
  signerName?: string;
}) {
  return (
    <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Thanks — LRE has been notified.
      </p>
      {signerName?.trim() ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Signed by {signerName.trim()}
        </p>
      ) : null}
      {note.trim() ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function EstimateResponseClient({
  token,
  defaultName = "",
  defaultEmail = "",
  estimateResponse,
  estimateNote,
  estimateSignerName = "",
  contractResponse,
  contractNote,
  contractSignerName = "",
  allowContractSign,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [estimateDone, setEstimateDone] = useState(estimateResponse);
  const [contractDone, setContractDone] = useState(contractResponse);
  const [estNote, setEstNote] = useState(estimateNote);
  const [estSigner, setEstSigner] = useState(estimateSignerName);
  const [conNote, setConNote] = useState(contractNote);
  const [conSigner, setConSigner] = useState(contractSignerName);

  function submit(
    docKind: "estimate" | "contract",
    values: CustomerEsignFormValues,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await respondToPublicEstimateAction({
        token,
        docKind,
        ...values,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (docKind === "estimate") {
        setEstimateDone(result.response);
        setEstNote(values.note);
        setEstSigner(values.signerName);
      } else {
        setContractDone(result.response);
        setConNote(values.note);
        setConSigner(values.signerName);
      }
    });
  }

  return (
    <div>
      {estimateDone ? (
        <DoneBanner
          title={
            estimateDone === "accepted"
              ? "Estimate accepted"
              : "Estimate declined"
          }
          note={estNote}
          signerName={
            estimateDone === "accepted" ? estSigner : undefined
          }
        />
      ) : (
        <CustomerEsignForm
          docKind="estimate"
          pending={pending}
          error={error}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          onSubmit={(values) => submit("estimate", values)}
        />
      )}

      {estimateDone === "accepted" && allowContractSign ? (
        contractDone ? (
          <DoneBanner
            title={
              contractDone === "accepted"
                ? "Contract signed"
                : "Contract declined"
            }
            note={conNote}
            signerName={
              contractDone === "accepted" ? conSigner : undefined
            }
          />
        ) : (
          <CustomerEsignForm
            docKind="contract"
            pending={pending}
            error={error}
            defaultName={estSigner || defaultName}
            defaultEmail={defaultEmail}
            acceptLabel="Sign contract"
            onSubmit={(values) => submit("contract", values)}
          />
        )
      ) : null}
    </div>
  );
}
