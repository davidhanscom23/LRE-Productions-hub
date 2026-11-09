"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Minus,
  Plus,
  Star,
  Users,
  X,
} from "lucide-react";
import { submitQuoteRequestAction } from "@/app/quote/[slug]/actions";
import { verifyCoordinatorPasswordAction } from "@/app/quote/[slug]/access-actions";
import {
  computeQuote,
  technicianLabel,
  totalEventHours,
  type EventDay,
  type SpaceSelection,
} from "@/lib/venue-portals/pricing";
import type {
  PortalAddon,
  PortalBundle,
  PortalPackage,
} from "@/lib/venue-portals/types";

const STEPS = ["You", "Event", "Spaces", "Packages", "Add-ons", "Enhancements", "Contact"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);

type Role = "venue_coordinator" | "planner";
type Person = { first: string; last: string; email: string; phone: string };
const EMPTY_PERSON: Person = { first: "", last: "", email: "", phone: "" };

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

function addonPriceLabel(a: PortalAddon): string {
  if (a.priceUnit === "hour")
    return `${usd(a.unitPrice)}/hr${a.minQuantity > 1 ? `, ${a.minQuantity}-hr min` : ""}`;
  if (a.priceUnit === "each") return `${usd(a.unitPrice)} each`;
  return usd(a.unitPrice);
}

function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div
        aria-hidden
        className={`${className ?? ""} bg-gradient-to-br from-slate-800 to-slate-600`}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`${className ?? ""} object-cover`} />;
}

export function QuoteWizard({
  bundle,
  coordinatorGate = false,
}: {
  bundle: PortalBundle;
  coordinatorGate?: boolean;
}) {
  const { portal, spaces, packages, addons, enhancements } = bundle;
  const popularId = packages.find((p) => p.isPopular)?.id ?? null;

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [coordAccess, setCoordAccess] = useState<{
    token: string;
    savingsPct: number;
    savingsLabel: string;
  } | null>(null);
  const [coordPassword, setCoordPassword] = useState("");
  const [coordChecking, setCoordChecking] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [guests, setGuests] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [days, setDays] = useState<EventDay[]>([
    { date: "", startTime: portal.defaultStartTime, endTime: portal.defaultEndTime },
  ]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pkgBySpace, setPkgBySpace] = useState<Record<string, string | null>>({});
  const [addonQty, setAddonQty] = useState<Record<string, Record<string, number>>>({});
  const [interested, setInterested] = useState<string[]>([]);
  const [contact, setContact] = useState<Person>(EMPTY_PERSON);
  const [client, setClient] = useState<Person>(EMPTY_PERSON);
  const [sameAsClient, setSameAsClient] = useState(false);
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: "quote" | "book"; preview: boolean } | null>(null);

  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const guestN = Number(guests) || 0;

  const selections: SpaceSelection[] = useMemo(
    () =>
      selected.flatMap((id) => {
        const s = spaceById.get(id);
        if (!s) return [];
        return [
          {
            spaceId: id,
            spaceName: s.name,
            packageId: s.isCustomQuote ? null : (pkgBySpace[id] ?? null),
            addons: s.isCustomQuote ? {} : (addonQty[id] ?? {}),
          },
        ];
      }),
    [selected, spaceById, pkgBySpace, addonQty],
  );

  // Venue savings are only ever shown to coordinators who entered the password.
  const coordRates = useMemo(
    () =>
      role === "venue_coordinator" && coordAccess
        ? { ...portal.rates, savingsPct: coordAccess.savingsPct, savingsLabel: coordAccess.savingsLabel || "Savings" }
        : portal.rates,
    [role, coordAccess, portal.rates],
  );

  const quote = useMemo(
    () => computeQuote({ rates: coordRates, packages, addons, technicians: bundle.technicians, selections, days }),
    [coordRates, packages, addons, bundle.technicians, selections, days],
  );

  const minPackagePrice = packages.length ? Math.min(...packages.map((p) => p.price)) : null;
  const fitCount = guestN
    ? spaces.filter((s) => s.capacity == null || s.capacity >= guestN).length
    : null;

  // ---- validation -------------------------------------------------------
  const eventValid =
    Boolean(eventType) &&
    guestN > 0 &&
    days.every((d) => d.date && TIME_RE.test(d.startTime) && TIME_RE.test(d.endTime));
  const contactValid =
    contact.first.trim() !== "" && contact.last.trim() !== "" && EMAIL_RE.test(contact.email.trim());
  const canContinue =
    step === 0 ? role !== null && (role !== "venue_coordinator" || !coordinatorGate || coordAccess !== null) : step === 1 ? eventValid : step === 2 ? selected.length > 0 : true;

  function go(to: number) {
    setError(null);
    setStep(to);
    setMaxStep((m) => Math.max(m, to));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- state mutators ---------------------------------------------------
  function toggleSpace(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      setPkgBySpace((p) => (id in p ? p : { ...p, [id]: popularId }));
      return [...cur, id];
    });
  }
  function setQty(spaceId: string, a: PortalAddon, next: number) {
    let q = Math.max(0, next);
    if (a.maxQuantity != null) q = Math.min(q, a.maxQuantity);
    if (q > 0 && q < a.minQuantity) q = a.minQuantity;
    setAddonQty((cur) => ({ ...cur, [spaceId]: { ...(cur[spaceId] ?? {}), [a.id]: q } }));
  }
  function stepQty(spaceId: string, a: PortalAddon, dir: 1 | -1) {
    const cur = addonQty[spaceId]?.[a.id] ?? 0;
    if (dir === 1) setQty(spaceId, a, cur === 0 ? Math.max(1, a.minQuantity) : cur + 1);
    else setQty(spaceId, a, cur <= a.minQuantity ? 0 : cur - 1);
  }
  function updateDay(i: number, patch: Partial<EventDay>) {
    setDays((cur) => cur.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function toggleMultiDay() {
    setMultiDay((m) => {
      if (m) setDays((cur) => cur.slice(0, 1));
      return !m;
    });
  }

  async function checkCoordPassword() {
    if (!coordPassword.trim() || coordChecking) return;
    setCoordChecking(true);
    setCoordError(null);
    try {
      const res = await verifyCoordinatorPasswordAction(portal.slug, coordPassword);
      if (res.ok) {
        setCoordAccess({ token: res.token, savingsPct: res.savingsPct, savingsLabel: res.savingsLabel });
        setCoordPassword("");
      } else {
        setCoordError(res.error);
      }
    } catch {
      setCoordError("Something went wrong. Please try again.");
    } finally {
      setCoordChecking(false);
    }
  }

  async function submit(kind: "quote" | "book") {
    if (!role || !contactValid || submitting) return;
    setSubmitting(true);
    setError(null);
    const clientPerson = role === "venue_coordinator" ? (sameAsClient ? contact : client) : undefined;
    try {
      const res = await submitQuoteRequestAction({
        slug: portal.slug,
        kind,
        role,
        contact,
        client: clientPerson,
        eventType,
        guestCount: guestN || null,
        days,
        selections: selections.map((s) => ({
          spaceId: s.spaceId,
          packageId: s.packageId,
          addons: s.addons,
        })),
        enhancementIds: interested,
        notes,
        coordinatorToken: role === "venue_coordinator" ? coordAccess?.token : undefined,
        website,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (kind === "book" && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      setDone({ kind, preview: Boolean(res.preview) });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- step bodies (plain functions so inputs never remount) ------------
  const renderYou = () => (
    <>
      <Heading step={1} title="Who's planning?" sub="This helps us send the quote to the right person." />
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["venue_coordinator", `I'm ${portal.name}'s event coordinator`, "Building a quote on behalf of a client"],
            ["planner", "I'm planning the event", "Building a quote for my own event"],
          ] as const
        ).map(([value, title, sub]) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            onClick={() => setRole(value)}
            className={`relative rounded-2xl border-2 bg-white p-5 text-left transition ${
              role === value ? "border-[var(--accent)] shadow-md" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {role === value && <Tick />}
            <p className="pr-8 text-base font-semibold">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{sub}</p>
          </button>
        ))}
      </div>
      {role === "venue_coordinator" && coordinatorGate && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          {coordAccess ? (
            <p className="text-sm font-medium text-emerald-700">Coordinator access confirmed. You can continue.</p>
          ) : (
            <>
              <label className="block text-sm font-medium">
                Coordinator password
                <input
                  type="password"
                  autoComplete="off"
                  value={coordPassword}
                  onChange={(e) => setCoordPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void checkCoordPassword();
                    }
                  }}
                  className={`${inputCls} mt-1`}
                />
              </label>
              {coordError && <p role="alert" className="mt-2 text-sm text-red-700">{coordError}</p>}
              <button
                type="button"
                disabled={coordChecking || !coordPassword.trim()}
                onClick={() => void checkCoordPassword()}
                className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {coordChecking ? "Checking…" : "Continue"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  const renderEvent = () => (
    <>
      <Heading step={2} title="Tell us about your event" sub="Dates and times help us calculate labor." />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Event type
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="">Select…</option>
            {portal.eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Expected guests
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 150"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className={`${inputCls} mt-1`}
          />
        </label>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-medium">Multi-day event</span>
        <button
          type="button"
          role="switch"
          aria-checked={multiDay}
          aria-label="Multi-day event"
          onClick={toggleMultiDay}
          className={`relative h-6 w-11 rounded-full transition ${multiDay ? "bg-[var(--accent)]" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${multiDay ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {days.map((d, i) => (
          <div key={i} className="grid items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <label className="block text-sm font-medium">
              {multiDay ? `Day ${i + 1} date` : "Date"}
              <input
                type="date"
                value={d.date ?? ""}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
                onChange={(e) => updateDay(i, { date: e.target.value })}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    /* browser without showPicker: native control still works */
                  }
                }}
                className={`${inputCls} mt-1 cursor-pointer`}
              />
            </label>
            <label className="block text-sm font-medium">
              Start
              <input type="time" value={d.startTime} onChange={(e) => updateDay(i, { startTime: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-sm font-medium">
              End
              <input type="time" value={d.endTime} onChange={(e) => updateDay(i, { endTime: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
            {multiDay && days.length > 1 && (
              <button type="button" aria-label={`Remove day ${i + 1}`} onClick={() => setDays((c) => c.filter((_, idx) => idx !== i))} className="mb-1 rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {multiDay && days.length < 14 && (
          <button
            type="button"
            onClick={() => setDays((c) => [...c, { date: "", startTime: portal.defaultStartTime, endTime: portal.defaultEndTime }])}
            className={secondaryBtn}
          >
            <Plus className="h-4 w-4" /> Add day
          </button>
        )}
      </div>
    </>
  );

  const renderSpaces = () => (
    <>
      <Heading step={3} title="Select your space(s)" sub="Pick one or more. Each gets its own package." />
      {fitCount !== null && (
        <p className="mb-3 flex items-center justify-end gap-1.5 text-sm text-slate-500">
          <Users className="h-4 w-4" /> {fitCount} of {spaces.length} spaces fit {guestN} guests
        </p>
      )}
      {spaces.length === 0 && <Empty text="No spaces are set up for this venue yet." />}
      <div className="grid gap-4 sm:grid-cols-2">
        {spaces.map((s) => {
          const on = selected.includes(s.id);
          const tooSmall = guestN > 0 && s.capacity != null && s.capacity < guestN;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSpace(s.id)}
              className={`overflow-hidden rounded-2xl border-2 bg-white text-left transition ${
                on ? "border-[var(--accent)] shadow-md" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="relative">
                <Img src={s.imageUrl} alt={s.name} className="h-44 w-full" />
                {on && <Tick />}
              </div>
              <div className="p-4">
                <p className="font-serif text-xl">{s.name}</p>
                <p className="mt-1 text-sm font-medium text-[var(--accent)]">
                  {s.isCustomQuote || minPackagePrice === null ? "Custom quote" : `From ${usd(minPackagePrice)}`}
                </p>
                {s.capacity != null && (
                  <p className={`mt-1 text-xs ${tooSmall ? "text-amber-700" : "text-slate-500"}`}>
                    {tooSmall ? `Holds up to ${s.capacity} guests, less than your ${guestN}` : `Holds up to ${s.capacity} guests`}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  const renderPackages = () => (
    <>
      <Heading step={4} title="Pick your packages" sub="Equipment packages. Delivery and labor are calculated for your event." />
      {selections.map((sel) => {
        const space = spaceById.get(sel.spaceId)!;
        return (
          <section key={sel.spaceId} className="mb-8">
            <h3 className="mb-3 font-serif text-2xl">{space.name}</h3>
            {space.isCustomQuote ? (
              <Empty text={`${space.name} is quoted individually. Our team will build the right setup with you.`} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {packages.map((p) => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    on={sel.packageId === p.id}
                    onPick={() => setPkgBySpace((c) => ({ ...c, [sel.spaceId]: p.id }))}
                  />
                ))}
                <button
                  type="button"
                  aria-pressed={sel.packageId === null}
                  onClick={() => setPkgBySpace((c) => ({ ...c, [sel.spaceId]: null }))}
                  className={`rounded-2xl border-2 bg-white p-5 text-left ${sel.packageId === null ? "border-[var(--accent)]" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <p className="font-semibold">No package</p>
                  <p className="mt-1 text-sm text-slate-500">I&apos;ll add items myself in the next step.</p>
                </button>
              </div>
            )}
          </section>
        );
      })}
    </>
  );

  const renderAddons = () => (
    <>
      <Heading step={5} title="Add-ons" sub="Optional extras for each space. Adjust any time." />
      {addons.length === 0 && <Empty text="No add-ons are set up for this venue yet." />}
      {selections.map((sel) => {
        const space = spaceById.get(sel.spaceId)!;
        if (space.isCustomQuote) return null;
        return (
          <section key={sel.spaceId} className="mb-8">
            <h3 className="mb-3 font-serif text-2xl">{space.name}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {addons.map((a) => {
                const qty = sel.addons[a.id] ?? 0;
                return (
                  <div key={a.id} className={`flex items-center gap-3 rounded-xl border p-3 ${qty > 0 ? "border-[var(--accent)] bg-amber-50/40" : "border-slate-200 bg-white"}`}>
                    {a.imageUrl && <Img src={a.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-slate-50" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{a.name}</p>
                      {a.description && <p className="line-clamp-2 text-xs text-slate-500">{a.description}</p>}
                      <p className="mt-0.5 text-sm font-medium text-[var(--accent)]">{addonPriceLabel(a)}</p>
                      {!a.isOrderable && a.note && <p className="mt-0.5 text-xs text-slate-500">{a.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Fewer ${a.name}`} disabled={qty === 0} onClick={() => stepQty(sel.spaceId, a, -1)} className="rounded-full border border-slate-300 p-1.5 disabled:opacity-30">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">{qty}</span>
                      <button type="button" aria-label={`More ${a.name}`} disabled={!a.isOrderable} onClick={() => stepQty(sel.spaceId, a, 1)} className="rounded-full bg-[var(--accent)] p-1.5 text-slate-900 disabled:opacity-30">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );

  const renderEnhancements = () => (
    <>
      <Heading step={6} title="Complete the experience" sub="Tap anything you'd like pricing on. It isn't added to your AV total." />
      {enhancements.length === 0 && <Empty text="Nothing extra to add here. Continue to finish your request." />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {enhancements.map((e) => {
          const on = interested.includes(e.id);
          return (
            <div key={e.id} className={`overflow-hidden rounded-2xl border-2 bg-white ${on ? "border-[var(--accent)]" : "border-slate-200"}`}>
              <Img src={e.imageUrl} alt={e.name} className="h-36 w-full" />
              <div className="p-4">
                <p className="font-serif text-xl">{e.name}</p>
                <p className="mt-1 text-sm text-slate-600">{e.description}</p>
                <p className="mt-3 text-sm font-semibold">Request pricing</p>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setInterested((c) => (c.includes(e.id) ? c.filter((x) => x !== e.id) : [...c, e.id]))}
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-transparent bg-[var(--accent)] text-slate-900" : "border-slate-300 bg-white"}`}
                >
                  {on ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                  {on ? "Interested" : "I'm interested"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const personFields = (label: string, p: Person, set: (p: Person) => void, required: boolean) => (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-base font-semibold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" required={required} value={p.first} onChange={(v) => set({ ...p, first: v })} autoComplete="given-name" />
        <Field label="Last name" required={required} value={p.last} onChange={(v) => set({ ...p, last: v })} autoComplete="family-name" />
        <Field label="Email" required={required} type="email" value={p.email} onChange={(v) => set({ ...p, email: v })} autoComplete="email" />
        <Field label="Phone" type="tel" value={p.phone} onChange={(v) => set({ ...p, phone: v })} autoComplete="tel" />
      </div>
    </fieldset>
  );

  const renderContact = () => (
    <>
      <Heading step={7} title="Where should we send it?" sub="" />
      <div className="space-y-6">
        {personFields(role === "venue_coordinator" ? "Your details (coordinator)" : "Your details", contact, setContact, true)}
        {role === "venue_coordinator" && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sameAsClient} onChange={(e) => setSameAsClient(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              I&apos;m also the client / same as my details
            </label>
            {!sameAsClient && personFields("Client details", client, setClient, false)}
          </>
        )}
        <label className="block text-sm font-medium">
          Anything we should know? (optional)
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, special requests, load-in notes…" className={`${inputCls} mt-1`} />
        </label>
        {/* Honeypot: hidden from people, tempting to bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
      </div>
    </>
  );

  // ---- done screen ------------------------------------------------------
  if (done) {
    return (
      <Shell portal={portal}>
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]"><Check className="h-7 w-7" /></div>
          <h2 className="font-serif text-3xl">{done.kind === "book" ? "Booking request received" : "Quote request received"}</h2>
          <p className="mt-3 text-slate-600">
            {done.preview
              ? "Preview only: this request was saved for testing and no emails were sent."
              : "Thank you! We'll confirm availability and send your official quote shortly. A confirmation is on its way to your inbox."}
          </p>
          <p className="mt-4 text-lg font-semibold">Estimated total {usd(quote.total)}</p>
        </div>
      </Shell>
    );
  }

  // ---- estimate sidebar -------------------------------------------------
  const estimate = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your instant estimate</p>
      <h2 className="mt-1 font-serif text-2xl">
        {selections.length === 0 ? "Choose a space" : selections.length === 1 ? selections[0].spaceName : `${selections.length} spaces`}
      </h2>
      <div className="mt-4 space-y-3 text-sm">
        {quote.spaces.map((s) => (
          <div key={s.spaceId}>
            {selections.length > 1 && <p className="font-semibold">{s.spaceName}</p>}
            {s.packageLine && (
              <Row
                label={s.packageLine.label}
                amount={s.packageLine.amount}
                onRemove={() => setPkgBySpace((c) => ({ ...c, [s.spaceId]: null }))}
                removeLabel={`Remove ${s.packageLine.label}`}
              />
            )}
            {s.addonLines.map((l) => {
              const a = addons.find((x) => x.name === l.label);
              return (
                <Row
                  key={l.label}
                  label={`${l.label}${l.detail ? ` (${l.detail})` : ""}`}
                  amount={l.amount}
                  muted
                  onRemove={a ? () => setQty(s.spaceId, a, 0) : undefined}
                  removeLabel={`Remove ${l.label}`}
                />
              );
            })}
          </div>
        ))}
        {selections.length > 0 && (
          <div className="space-y-1 border-t border-slate-200 pt-3 text-slate-600">
            {quote.delivery > 0 && <Row label="Delivery" amount={quote.delivery} muted />}
            {quote.setup > 0 && <Row label="Setup & strike" amount={quote.setup} muted />}
            {quote.technicians.map((t) => (
              <Row key={t.name} label={technicianLabel(t)} amount={t.amount} muted />
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
        <Row label="Subtotal" amount={quote.subtotal} />
        {quote.savings > 0 && <Row label={quote.savingsLabel} amount={-quote.savings} accent />}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-semibold">Estimated total</span>
        <span className="font-serif text-3xl">{usd(quote.total)}</span>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Estimates cover equipment, delivery, setup and labor for your event and exclude tax.
        We&apos;ll confirm availability and send your official quote.
      </p>
    </div>
  );

  return (
    <Shell portal={portal}>
      <nav aria-label="Progress" className="mb-8">
        <ol className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                disabled={i > maxStep}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Go to ${label}`}
                onClick={() => go(i)}
                className="w-full text-left disabled:cursor-not-allowed"
              >
                <span className={`block h-1 rounded-full ${i <= maxStep ? "bg-[var(--accent)]" : "bg-slate-200"}`} />
                <span className={`mt-2 hidden text-[11px] font-medium uppercase tracking-wide sm:block ${i === step ? "text-[var(--accent)]" : i <= maxStep ? "text-slate-800" : "text-slate-400"}`}>
                  {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500 sm:hidden">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative min-w-0">
          {step === 0 && renderYou()}
          {step === 1 && renderEvent()}
          {step === 2 && renderSpaces()}
          {step === 3 && renderPackages()}
          {step === 4 && renderAddons()}
          {step === 5 && renderEnhancements()}
          {step === 6 && renderContact()}

          {error && (
            <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-slate-700 disabled:opacity-30">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < 6 ? (
              <button type="button" onClick={() => go(step + 1)} disabled={!canContinue} className={primaryBtn}>
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => submit("quote")} disabled={!contactValid || submitting} className={secondaryBtn}>
                  {submitting ? "Sending…" : "Send a Quote"}
                </button>
                <button type="button" onClick={() => submit("book")} disabled={!contactValid || submitting} className={primaryBtn}>
                  Book Now <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">{estimate}</aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated total</span>
        <span className="font-serif text-2xl">{usd(quote.total)}</span>
      </div>
      <span className="sr-only">{totalEventHours(days)} event hours</span>
    </Shell>
  );
}

// ---- presentational helpers --------------------------------------------

function Shell({ portal, children }: { portal: PortalBundle["portal"]; children: React.ReactNode }) {
  return (
    <div style={{ "--accent": portal.accentColor } as CSSProperties} className="min-h-screen bg-stone-50 text-slate-900">
      <header className="relative isolate overflow-hidden bg-slate-900 text-white">
        {portal.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portal.heroImageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
        )}
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          {portal.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portal.logoUrl} alt={portal.name} className="mb-6 h-12 w-auto" />
          ) : (
            <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">{portal.name}</p>
          )}
          <h1 className="font-serif text-4xl sm:text-5xl">{portal.headline}</h1>
          {portal.intro && <p className="mt-4 max-w-2xl text-base text-white/85">{portal.intro}</p>}
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Powered by Vident Productions</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 lg:pb-12">{children}</main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        {portal.name} × Vident Productions. Estimates include delivery, setup, strike and labor, calculated for your event.
      </footer>
    </div>
  );
}

function Heading({ step, title, sub }: { step: number; title: string; sub: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Step {step}</p>
      <h2 className="mt-1 font-serif text-3xl sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 text-slate-600">{sub}</p>}
    </div>
  );
}

function Tick() {
  return (
    <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-slate-900 shadow">
      <Check className="h-4 w-4" />
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{text}</p>;
}

function Row({ label, amount, muted, accent, onRemove, removeLabel }: { label: string; amount: number; muted?: boolean; accent?: boolean; onRemove?: () => void; removeLabel?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${muted ? "text-slate-600" : ""} ${accent ? "text-[var(--accent)]" : ""}`}>
      <span className="min-w-0">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
        {amount < 0 ? `−${usd(-amount)}` : usd(amount)}
        {onRemove && (
          <button type="button" aria-label={removeLabel} onClick={onRemove} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; autoComplete?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {required && <span className="text-red-600"> *</span>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${inputCls} mt-1`} />
    </label>
  );
}

function PackageCard({ pkg, on, onPick }: { pkg: PortalPackage; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`relative flex flex-col rounded-2xl border-2 bg-white p-5 text-left transition ${on ? "border-[var(--accent)] shadow-md" : "border-slate-200 hover:border-slate-300"}`}
    >
      {pkg.isPopular && (
        <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-900">
          <Star className="h-3 w-3" /> Most popular
        </span>
      )}
      {on && <Tick />}
      <p className="pr-8 font-serif text-2xl leading-tight">{pkg.name}</p>
      {pkg.tagline && <p className="mt-1 text-sm text-slate-500">{pkg.tagline}</p>}
      <p className="mt-4 text-3xl font-bold">{usd(pkg.price)}</p>
      <p className="text-xs text-slate-500">equipment, plus delivery and labor calculated for your event</p>
      <ul className="mt-4 space-y-2 text-sm">
        {pkg.items.map((it) => (
          <li key={it} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
