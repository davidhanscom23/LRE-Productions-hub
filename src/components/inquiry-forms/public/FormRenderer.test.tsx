import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldDef, FormDefinition, PublicFormBundle, PublicFormSettings, QualifyResponse } from "@/lib/inquiry-forms/types";
import { DEFAULT_FORM_SETTINGS } from "@/lib/inquiry-forms/defaults";
import { HONEYPOT_INPUT_NAME } from "@/lib/inquiry-forms/definition";
import { FormRenderer } from "./FormRenderer";
import { PREVIEW_RIBBON_TEXT } from "./BrandChrome";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// These cases let REAL time pass in 15 ms act() slices (the 1.5 s redirect fallback alone is ~110
// slices), which overruns vitest's 5 s default on a loaded machine. A timed-out case keeps running
// and its act() calls overlap the next case, so one slow run fails the rest of the file.
vi.setConfig({ testTimeout: 30_000 });

const TODAY = "2026-11-04";

let seq = 0;
function f(partial: Partial<FieldDef> & Pick<FieldDef, "key" | "type" | "label">): FieldDef {
  seq += 1;
  return { id: `fld-${seq}`, required: false, width: "full", ...partial };
}

const DEF: FormDefinition = {
  version: 1,
  steps: [
    {
      id: "s-you",
      kind: "fields",
      title: "Let's check your date",
      progressLabel: "You",
      fields: [
        f({ key: "full_name", type: "text", role: "name", label: "Full name", required: true, width: "half" }),
        f({ key: "mobile_phone", type: "phone", role: "phone", label: "Mobile phone", required: true, width: "half" }),
        f({ key: "email", type: "email", role: "email", label: "Email", required: true }),
        f({ key: "event_date", type: "date", role: "event_date", label: "Event date", required: true, width: "half" }),
        f({ key: "venue", type: "address", role: "event_location", label: "Venue or city", required: true, width: "half" }),
      ],
    },
    { id: "s-check", kind: "qualify", title: "Checking our calendar", progressLabel: "Availability", fields: [], checks: ["date", "location"] },
    {
      id: "s-finish",
      kind: "fields",
      title: "Last step",
      progressLabel: "Finish",
      fields: [f({ key: "contact_pref", type: "contact_preference", role: "contact_preference", label: "How should we reach you?", required: true })],
    },
  ],
};

function settings(over: Partial<PublicFormSettings> = {}): PublicFormSettings {
  const base = { ...(DEFAULT_FORM_SETTINGS as unknown as PublicFormSettings) };
  return {
    ...base,
    brand: "vident",
    accentColor: "#ae4213",
    submitLabel: "Send my request",
    qualify: {
      ...base.qualify,
      celebrate: true,
      popupTitle: "YOUR SEARCH IS OVER!",
      popupSubtitle: "WE ARE AVAILABLE",
      timings: { messageIntervalMs: 500, minCheckMs: 20, preCelebrationMs: 10, popupMs: 20 },
    },
    onDateUnavailable: { actions: ["change_date", "waitlist", "continue"], message: "That date is already busy for us." },
    ...over,
  };
}

function bundle(over: Partial<PublicFormBundle> = {}): PublicFormBundle {
  return {
    formId: "form-1",
    slug: "check-your-date",
    name: "Check Your Date",
    versionId: "ver-1",
    definition: DEF,
    settings: settings(),
    brand: {
      key: "vident",
      name: "LRE Productions",
      logoUrl: "/logo.png",
      logoOnDark: false,
      siteUrl: "https://example.com",
      privacyUrl: "https://hub.example.com/privacy",
      phone: "904-571-9064",
      email: "events@example.com",
      accentColor: "#ae4213",
      legalLine: "LRE Productions, Inc.",
    },
    turnstileSiteKey: null,
    preview: false,
    ...over,
  };
}

type Call = { url: string; body: unknown };
let calls: Call[] = [];
let qualifyReply: QualifyResponse;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  let body: unknown = null;
  try {
    body = init?.body ? JSON.parse(String(init.body)) : null;
  } catch {
    body = init?.body ?? null;
  }
  calls.push({ url, body });
  if (url === "/api/inquire/start") return json(200, { ok: true, submissionId: "sub-1", token: "tok-1", currentStep: 1 });
  if (url.endsWith("/qualify")) return json(200, qualifyReply);
  if (url.endsWith("/save")) return json(200, { ok: true, currentStep: 2 });
  if (url.endsWith("/complete")) {
    return json(200, { ok: true, ending: { kind: "completed", title: "You're all set!", message: "Thanks for reaching out.", redirectUrl: null } });
  }
  return json(200, { ok: true });
}

const fetchMock = vi.fn(defaultFetch);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  calls = [];
  qualifyReply = {
    ok: true,
    qualification: {
      date: { result: "available", checkedFor: "2027-05-15", message: "Great news, we're available.", checkedAt: "x" },
      location: { result: "pass", message: "You're in our area.", checkedAt: "x" },
    },
    celebrate: true,
    urgency: "Popular dates don't last long.",
  };
  window.sessionStorage.clear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

async function render(b: PublicFormBundle, embed = false) {
  await act(async () => {
    root.render(<FormRenderer bundle={b} embed={embed} today={TODAY} />);
  });
}

/**
 * Let real time pass in small act() slices: act flushes React work only when its scope ends, so a
 * chain of timers (box revealed -> pause -> next box) needs one slice per link.
 */
async function wait(ms: number) {
  const slice = 15;
  for (let elapsed = 0; elapsed < ms; elapsed += slice) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, slice));
    });
  }
}

/**
 * Like wait(), but stops as soon as `done()` holds. The reveal is a chain of timers, and how long it takes
 * varies by machine (a fixed 250 ms was too short on Node 22 on the VPS), so tests wait for the outcome.
 */
async function waitUntil(done: () => boolean, label: string, timeoutMs = 3000) {
  const slice = 15;
  for (let elapsed = 0; elapsed < timeoutMs; elapsed += slice) {
    if (done()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, slice));
    });
  }
  if (!done()) throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`);
}

const dialogOpen = () => document.querySelector('[role="dialog"]') !== null;

function input(id: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`#iqf-f-${id}`);
  if (!el) throw new Error(`missing #iqf-f-${id}`);
  return el;
}

async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  });
}

async function fillFirstStep(date = "2027-05-15") {
  await type(input("full_name"), "Dana Cole");
  await type(input("mobile_phone"), "904-555-0100");
  await type(input("email"), "dana@example.com");
  await type(input("event_date"), date);
  await type(input("venue"), "Casa Monica, St. Augustine");
}

const writes = () => calls.filter((c) => /\/(start|save|complete)$/.test(c.url));

describe("FormRenderer first step", () => {
  it("renders bound labels, autocomplete tokens, the business-date minimum and the honeypot", async () => {
    await render(bundle());
    expect(container.querySelector('label[for="iqf-f-full_name"]')?.textContent).toContain("Full name");
    expect(input("full_name").getAttribute("autocomplete")).toBe("name");
    expect(input("mobile_phone").getAttribute("autocomplete")).toBe("tel");
    expect(input("mobile_phone").type).toBe("tel");
    expect(input("email").getAttribute("autocomplete")).toBe("email");
    expect(input("venue").getAttribute("autocomplete")).toBe("off");
    expect(input("event_date").min).toBe(TODAY);
    const hp = container.querySelector<HTMLInputElement>(`input[name="${HONEYPOT_INPUT_NAME}"]`);
    expect(hp).not.toBeNull();
    expect(hp?.tabIndex).toBe(-1);
    expect(hp?.getAttribute("autocomplete")).toBe("off");
    expect(hp?.getAttribute("aria-hidden")).toBe("true");
    // Off screen through the .iqf-hp wrapper, which is hidden from assistive tech as a whole.
    expect(hp?.closest(".iqf-hp")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('input[name="company_website"]')).toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("Let's check your date");
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Check availability");
    expect(container.textContent).toContain("Step 1 of 3");
    expect(container.textContent).toContain("LRE Productions, Inc.");
  });

  it("gives the honeypot nothing browser autofill could match (the old company_website did)", async () => {
    // Words autofill keys on: it reads the name, the id and the label text of every input.
    const autofillWords = /company|organi[sz]ation|web|site|url|name|mail|phone|tel|mobile|address|street|city|zip|postal|country/i;
    expect(autofillWords.test("company_website")).toBe(true);
    await render(bundle());
    const hp = container.querySelector<HTMLInputElement>(`input[name="${HONEYPOT_INPUT_NAME}"]`) as HTMLInputElement;
    const label = container.querySelector(`label[for="${hp.id}"]`)?.textContent ?? "";
    expect(label).not.toBe("");
    for (const text of [hp.name, hp.id, label]) expect(autofillWords.test(text), text).toBe(false);
  });

  it("still sends whatever lands in the honeypot as body key hp", async () => {
    await render(bundle());
    await fillFirstStep();
    await type(container.querySelector<HTMLInputElement>(`input[name="${HONEYPOT_INPUT_NAME}"]`) as HTMLInputElement, "Acme Inc");
    await submit();
    await wait(30);
    const start = calls.find((c) => c.url === "/api/inquire/start");
    expect((start?.body as Record<string, unknown>).hp).toBe("Acme Inc");
  });

  it("shows inline errors with aria-invalid, focuses the first one, and sends nothing", async () => {
    await render(bundle());
    await submit();
    expect(input("full_name").getAttribute("aria-invalid")).toBe("true");
    expect(input("full_name").getAttribute("aria-describedby")).toContain("iqf-f-full_name-error");
    expect(container.querySelector("#iqf-f-full_name-error")?.textContent?.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(input("full_name"));
    expect(writes()).toHaveLength(0);
  });
});

describe("FormRenderer happy path", () => {
  it("starts with the first step only, reveals the server verdict, then completes", async () => {
    await render(bundle());
    await fillFirstStep();
    await submit();
    await wait(30);

    const start = calls.find((c) => c.url === "/api/inquire/start");
    expect(start).toBeTruthy();
    const body = start?.body as Record<string, unknown>;
    expect(body.formSlug).toBe("check-your-date");
    expect(body.hp).toBe("");
    expect(typeof body.elapsedMs).toBe("number");
    expect(body.answers).toEqual({
      full_name: "Dana Cole",
      mobile_phone: "904-555-0100",
      email: "dana@example.com",
      event_date: "2027-05-15",
      venue: "Casa Monica, St. Augustine",
    });
    expect(body).not.toHaveProperty("stage");
    expect(body).not.toHaveProperty("score");

    const qualify = calls.find((c) => c.url === "/api/inquire/sub-1/qualify");
    expect(qualify?.body).toEqual({ token: "tok-1" });
    expect(container.querySelector("h2")?.textContent).toBe("Checking our calendar");

    // The step's buttons appear only when the whole reveal has finished (navVisible in FormRenderer).
    await waitUntil(() => container.querySelector('button[type="submit"]') !== null, "the end of the reveal");
    expect(container.textContent).toContain("Great news, we're available.");
    expect(container.textContent).toContain("You're in our area.");
    expect(container.textContent).toContain("Popular dates don't last long.");
    expect(container.querySelector('[data-tone="good"]')).not.toBeNull();

    await submit();
    expect(container.querySelector("h2")?.textContent).toBe("Last step");
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Send my request");

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[name="iqf-contact_pref"]')?.click();
    });
    await submit();
    await wait(20);
    const complete = calls.find((c) => c.url === "/api/inquire/sub-1/complete");
    expect(complete?.body).toEqual({ token: "tok-1", answers: { contact_pref: "email" }, ending: "completed", turnstileToken: null });
    expect(container.textContent).toContain("You're all set!");
    expect(container.textContent).toContain("Thanks for reaching out.");
  });

  it("resumes on the same step after a reload in the same tab", async () => {
    await render(bundle());
    await fillFirstStep();
    await submit();
    await wait(200);
    act(() => root.unmount());
    root = createRoot(container);
    calls = [];
    await render(bundle());
    await wait(10);
    expect(container.querySelector("h2")?.textContent).toBe("Checking our calendar");
    // the cached verdict is shown again without a second qualify call
    expect(calls.filter((c) => c.url.endsWith("/qualify"))).toHaveLength(0);
    expect(container.textContent).toContain("Great news, we're available.");
  });
});

describe("FormRenderer unavailable date", () => {
  it("opens the dialog with the configured actions, and Escape closes it", async () => {
    qualifyReply = {
      ok: true,
      qualification: {
        date: { result: "unavailable", checkedFor: "2027-05-15", message: "We're booked that day.", checkedAt: "x" },
        location: { result: "pass", message: "You're in our area.", checkedAt: "x" },
      },
      celebrate: false,
      urgency: null,
    };
    await render(bundle());
    await fillFirstStep();
    await submit();
    await waitUntil(dialogOpen, "the unavailable-date dialog");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.textContent).toContain("That date is already busy for us.");
    const labels = Array.from(dialog?.querySelectorAll(".iqf-dialog-actions button") ?? []).map((b) => b.textContent);
    expect(labels).toEqual(["Pick a different date", "Join the waitlist", "Send my request anyway"]);
    expect(container.querySelector('[data-tone="bad"]')).not.toBeNull();

    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("waitlist continues to the last step and completes as waitlisted", async () => {
    qualifyReply = {
      ok: true,
      qualification: { date: { result: "unavailable", checkedFor: "2027-05-15", message: "Booked.", checkedAt: "x" } },
      celebrate: false,
      urgency: null,
    };
    await render(bundle());
    await fillFirstStep();
    await submit();
    await waitUntil(dialogOpen, "the unavailable-date dialog");
    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>(".iqf-dialog-actions button"))
        .find((b) => b.textContent === "Join the waitlist")
        ?.click();
    });
    expect(container.querySelector("h2")?.textContent).toBe("Last step");
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Join the waitlist");
    await act(async () => {
      container.querySelector<HTMLInputElement>('input[name="iqf-contact_pref"]')?.click();
    });
    await submit();
    await wait(20);
    const complete = calls.find((c) => c.url.endsWith("/complete"));
    expect((complete?.body as { ending: string }).ending).toBe("waitlisted");
  });
});

describe("FormRenderer embed mode", () => {
  const REDIRECT = "https://example.com/thank-you";
  let parentPost: ReturnType<typeof vi.fn>;
  let fakeParent: { postMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    parentPost = vi.fn();
    fakeParent = { postMessage: parentPost };
    Object.defineProperty(window, "parent", { value: fakeParent, configurable: true, writable: true });
  });

  afterEach(() => {
    delete (window as unknown as { parent?: unknown }).parent;
  });

  async function runToEnding(redirectUrl: string | null) {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/inquire/start") return json(200, { ok: true, submissionId: "sub-1", token: "tok-1", currentStep: 1 });
      if (url.endsWith("/qualify")) return json(200, qualifyReply);
      if (url.endsWith("/complete")) {
        return json(200, { ok: true, ending: { kind: "completed", title: "Request received", message: "Thanks!", redirectUrl } });
      }
      return json(200, { ok: true });
    });
    await render(bundle({ settings: settings({ hostEvent: true }) }), true);
    await fillFirstStep();
    await submit();
    await wait(250);
    await submit();
    await act(async () => {
      container.querySelector<HTMLInputElement>('input[name="iqf-contact_pref"]')?.click();
    });
    await submit();
    await wait(30);
  }

  const posted = () => parentPost.mock.calls.map((c) => c[0] as Record<string, unknown>);

  it("posts ready, a step message per step change, then submitted (hostEvent on)", async () => {
    await runToEnding(null);
    const types = posted().map((m) => m.type);
    expect(types[0]).toBe("ready");
    expect(posted().filter((m) => m.type === "step").map((m) => m.index)).toEqual(expect.arrayContaining([1, 2]));
    const submitted = posted().find((m) => m.type === "submitted");
    expect(submitted).toEqual({ source: "inquiry-forms", v: 1, slug: "check-your-date", type: "submitted", ending: "completed", formName: "Check Your Date" });
    for (const m of posted()) expect(m.source).toBe("inquiry-forms");
    // embedded forms drop the page chrome
    expect(container.querySelector(".iqf-header")).toBeNull();
    expect(container.textContent).not.toContain("a brand of First Coast Events");
  });

  it("asks the host to redirect and shows a Continue link when no ack arrives within 1.5 s", async () => {
    await runToEnding(REDIRECT);
    expect(posted().find((m) => m.type === "redirect")).toMatchObject({ type: "redirect", url: REDIRECT });
    expect(container.textContent).toContain("Taking you to example.com...");
    await wait(1600);
    const link = container.querySelector<HTMLAnchorElement>(".iqf-ending a");
    expect(link?.href).toBe(REDIRECT);
    expect(link?.target).toBe("_top");
    expect(link?.textContent).toBe("Continue");
  });

  const ACK = { source: "inquiry-forms-host", v: 1, type: "redirect-ack" };

  function deliver(data: unknown, source: unknown, origin: string) {
    const ev = new MessageEvent("message", { data, origin });
    Object.defineProperty(ev, "source", { value: source });
    window.dispatchEvent(ev);
  }

  it("ignores an ack that does not come from window.parent", async () => {
    await runToEnding(REDIRECT);
    await act(async () => {
      deliver(ACK, window, "https://evil.example.com");
      deliver({ ...ACK, v: 2 }, fakeParent, "https://www.example-host.com");
    });
    await wait(1600);
    expect(container.querySelector(".iqf-ending a")?.textContent).toBe("Continue");
  });

  it("hands navigation to the host once window.parent acks", async () => {
    await runToEnding(REDIRECT);
    await act(async () => {
      deliver(ACK, fakeParent, "https://www.example-host.com");
    });
    await wait(1600);
    expect(container.querySelector(".iqf-ending a")).toBeNull();
    expect(container.textContent).toContain("Taking you to example.com...");
  });
});

describe("FormRenderer preview mode", () => {
  it("shows the ribbon, uses the preview qualify endpoint and never writes", async () => {
    await render(bundle({ preview: true }));
    expect(container.textContent).toContain(PREVIEW_RIBBON_TEXT);
    expect(container.querySelector(`input[name="${HONEYPOT_INPUT_NAME}"]`)).toBeNull();
    await fillFirstStep();
    await submit();
    await wait(250);
    const preview = calls.find((c) => c.url === "/api/inquire/preview/qualify");
    expect((preview?.body as { formId: string }).formId).toBe("form-1");
    await submit();
    await act(async () => {
      container.querySelector<HTMLInputElement>('input[name="iqf-contact_pref"]')?.click();
    });
    await submit();
    await wait(20);
    expect(writes()).toHaveLength(0);
    expect(calls.filter((c) => c.url.includes("/view") || c.url.includes("/ping"))).toHaveLength(0);
    expect(container.querySelector(".iqf-ending")).not.toBeNull();
  });
});

describe("FormRenderer visibility matches the server", () => {
  const CHAIN: FormDefinition = {
    version: 1,
    steps: [
      {
        id: "c-1",
        kind: "fields",
        title: "You",
        fields: [
          f({ key: "full_name", type: "text", role: "name", label: "Full name", required: true }),
          f({ key: "email", type: "email", role: "email", label: "Email", required: true }),
          f({
            key: "a",
            type: "radio",
            label: "Planning a wedding?",
            required: true,
            choices: [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ],
          }),
        ],
      },
      {
        id: "c-2",
        kind: "fields",
        title: "Style",
        fields: [
          f({
            key: "b",
            type: "radio",
            label: "Ceremony style",
            choices: [
              { value: "x", label: "Indoor" },
              { value: "y", label: "Outdoor" },
            ],
            showIf: { fieldKey: "a", op: "equals", values: ["yes"] },
          }),
          f({ key: "note2", type: "text", label: "Anything else" }),
        ],
      },
      {
        id: "c-3",
        kind: "fields",
        title: "Last",
        fields: [
          f({
            key: "c",
            type: "text",
            label: "Tell us about the space",
            required: true,
            showIf: { fieldKey: "b", op: "not_equals", values: ["x"] },
          }),
          f({ key: "note3", type: "text", label: "Notes" }),
        ],
      },
    ],
  };
  const radio = (key: string, i: number) => container.querySelectorAll<HTMLInputElement>(`input[name="iqf-${key}"]`)[i];
  const back = async () => {
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes("Back"))?.click();
    });
  };

  it("shows a field whose condition reads a now-hidden answer from an earlier step, as the server does", async () => {
    await render(bundle({ definition: CHAIN }));
    await type(input("full_name"), "Dana Cole");
    await type(input("email"), "dana@example.com");
    await act(async () => radio("a", 0).click());
    await wait(40);
    await submit();
    await wait(40);
    await act(async () => radio("b", 0).click());
    await submit();
    await wait(40);
    expect(container.querySelector("h2")?.textContent).toBe("Last");
    expect(container.querySelector("#iqf-f-c")).toBeNull();
    await back();
    await wait(20);
    await back();
    await wait(20);
    await act(async () => radio("a", 1).click());
    await submit();
    await wait(40);
    await submit();
    await wait(40);
    expect(container.querySelector("h2")?.textContent).toBe("Last");
    // The server drops B (its condition is now false), so C is visible and required there.
    expect(container.querySelector("#iqf-f-c")).not.toBeNull();
  });
});

describe("FormRenderer Turnstile", () => {
  type Opts = Record<string, (t?: string) => void>;
  let widget: Opts | null = null;
  beforeEach(() => {
    widget = null;
    (window as unknown as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, opts: Opts) => {
        widget = opts;
        return "w-1";
      },
      reset: () => undefined,
      remove: () => undefined,
    };
  });
  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it("never sends a start without a token: the visitor is asked to finish the check, then it goes through", async () => {
    await render(bundle({ turnstileSiteKey: "site-key" }));
    await wait(20);
    expect(widget).not.toBeNull();
    // Cloudflare could not run the check (blocked script, network): no token will come.
    await act(async () => widget?.["error-callback"]?.());
    await fillFirstStep();
    await submit();
    await wait(60);
    expect(writes()).toHaveLength(0);
    expect(container.textContent).toContain("Please finish the quick security check");
    // The check finishes: the next press sends the start with the token.
    await act(async () => widget?.callback?.("tok-ok"));
    await submit();
    await wait(60);
    const start = calls.find((c) => c.url === "/api/inquire/start");
    expect((start?.body as Record<string, unknown>).turnstileToken).toBe("tok-ok");
  });
});

describe("FormRenderer fill time", () => {
  it("measures fill time from the first visit, not from a reload that restored the answers", async () => {
    const openedAt = Date.now() - 60_000;
    window.sessionStorage.setItem(
      "inquiry-forms:v1:check-your-date",
      JSON.stringify({
        v: 1,
        formId: "form-1",
        versionId: "ver-1",
        submission: null,
        stepIndex: 0,
        answers: {
          full_name: "Dana Cole",
          mobile_phone: "904-555-0100",
          email: "dana@example.com",
          event_date: "2027-05-15",
          venue: "Casa Monica, St. Augustine",
        },
        waitlist: false,
        qualify: {},
        ending: null,
        savedAt: Date.now() - 1000,
        openedAt,
      }),
    );
    await render(bundle());
    await wait(20);
    await submit();
    await wait(30);
    const start = calls.find((c) => c.url === "/api/inquire/start");
    expect((start?.body as Record<string, number>).elapsedMs).toBeGreaterThanOrEqual(60_000);
  });
});

describe("FormRenderer celebration", () => {
  it("gives the celebration its own space above the checks, never on top of the verdict text", async () => {
    const s = settings();
    await render(bundle({ settings: { ...s, qualify: { ...s.qualify, timings: { ...s.qualify.timings, popupMs: 5000 } } } }));
    await fillFirstStep();
    await submit();
    let popup: Element | null = null;
    for (let i = 0; i < 40 && !popup; i++) {
      await wait(15);
      popup = container.querySelector(".iqf-popup");
    }
    expect(popup).not.toBeNull();
    expect(popup?.closest(".iqf-checks")).toBeNull();
    expect(popup?.nextElementSibling?.classList.contains("iqf-checks")).toBe(true);
    expect(container.textContent).toContain("Great news, we're available.");
  });
});
