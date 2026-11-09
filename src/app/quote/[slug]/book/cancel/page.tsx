import Link from "next/link";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ request_id?: string }>;
};

export default async function BookDepositCancelPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const { request_id: requestId } = await searchParams;

  if (requestId && isServiceRoleConfigured()) {
    const db = createServiceClient();
    await db
      .from("venue_portal_quote_requests")
      .update({ deposit_status: "canceled" })
      .eq("id", requestId)
      .eq("deposit_status", "pending");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Vident Productions
      </p>
      <h1 className="mt-3 font-serif text-3xl text-slate-900">
        Deposit checkout canceled
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        No charge was made. Your booking request is still saved — you can try Book
        Now again when you are ready, or Send a Quote instead.
      </p>
      <Link
        href={`/quote/${slug}`}
        className="mt-8 inline-flex items-center justify-center self-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Return to quote
      </Link>
    </main>
  );
}
