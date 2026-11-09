import "server-only";

/**
 * Inquiry Forms - the date check (spec section 4, Availability). Rules are pure
 * (availability-core.ts); this file asks the hub adapter for bookings and capacity.
 * Any failure answers "unknown" (we confirm by hand), never "available".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessSettings, DateResult, DateVerdict } from "../types";
import type { HubAdapter } from "./adapter";
import {
  alternativeCandidates,
  dateMessage,
  isGoodAlternative,
  MAX_ALTERNATIVES,
  resultFromBookings,
  screenDate,
  wantsAlternatives,
} from "./availability-core";

const ALTERNATIVE_BATCH = 6;
/** Stop looking for alternatives after this long so the reveal stays quick. */
const ALTERNATIVE_BUDGET_MS = 6000;

async function resultFor(
  sb: SupabaseClient,
  adapter: HubAdapter,
  business: BusinessSettings,
  date: string,
  today: string,
): Promise<DateResult> {
  const a = business.availability;
  const screened = screenDate({ mode: a.mode, date, today, blackouts: a.blackouts, minNoticeDays: a.minNoticeDays });
  if (screened !== null) return screened;
  const capacity = await adapter.capacityOn(sb, date, a.capacity);
  if (capacity === null) return "unknown";
  const booked = await adapter.bookingsOn(sb, date);
  return resultFromBookings(booked, capacity);
}

async function findAlternatives(
  sb: SupabaseClient,
  adapter: HubAdapter,
  business: BusinessSettings,
  date: string,
  today: string,
): Promise<string[]> {
  const started = Date.now();
  const found: string[] = [];
  const candidates = alternativeCandidates(date);
  for (let i = 0; i < candidates.length && found.length < MAX_ALTERNATIVES; i += ALTERNATIVE_BATCH) {
    if (Date.now() - started > ALTERNATIVE_BUDGET_MS) break;
    const batch = candidates.slice(i, i + ALTERNATIVE_BATCH);
    const results = await Promise.all(
      batch.map((candidate) => resultFor(sb, adapter, business, candidate, today).catch(() => "unknown" as DateResult)),
    );
    // Keep nearest-first preference: walk the batch in candidate order.
    batch.forEach((candidate, j) => {
      if (found.length < MAX_ALTERNATIVES && isGoodAlternative(results[j])) found.push(candidate);
    });
  }
  return found.sort();
}

export interface DateCheck {
  verdict: DateVerdict;
  /** Set when something failed (the verdict is then "unknown"); the caller logs it. */
  error?: string;
}

/**
 * Check `date` ("YYYY-MM-DD", New York) for the business. Alternatives (up to 3 dates within 21
 * days, not past, not blacked out, available or open) only when `wantAlternatives`.
 */
export async function checkDate(
  sb: SupabaseClient,
  adapter: HubAdapter,
  business: BusinessSettings,
  date: string | null,
  opts: { today: string; wantAlternatives: boolean },
): Promise<DateCheck> {
  const checkedAt = new Date().toISOString();
  const messages = business.availability.messages;
  let result: DateResult;
  let error: string | undefined;
  try {
    result = date ? await resultFor(sb, adapter, business, date, opts.today) : "skipped";
  } catch (err) {
    result = "unknown";
    error = err instanceof Error ? err.message : "date check failed";
  }

  const verdict: DateVerdict = { result, checkedFor: date, message: dateMessage(result, messages), checkedAt };
  if (date && opts.wantAlternatives && wantsAlternatives(result)) {
    try {
      const alternatives = await findAlternatives(sb, adapter, business, date, opts.today);
      if (alternatives.length > 0) verdict.alternatives = alternatives;
    } catch (err) {
      error = error ?? (err instanceof Error ? err.message : "alternative dates failed");
    }
  }
  return error ? { verdict, error } : { verdict };
}
