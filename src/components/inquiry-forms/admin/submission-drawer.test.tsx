// @vitest-environment jsdom
/**
 * The submission drawer's "Add to CRM" (CRM_WORDS.add, e.g. "Add to Leads"): what staff see when
 * their click created the record, when it already existed (another write won the claim), and while
 * another write holds it.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmissionDetail } from "./submissions-types";

const actions = vi.hoisted(() => ({
  addSubmissionToCrm: vi.fn(),
  getSubmissionDetail: vi.fn(),
  setSubmissionSpam: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/(app)/inquiry-forms/actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SubmissionDrawer } from "./submission-drawer";
import { CRM_WORDS } from "./submissions-format";

const ID = "33333333-3333-4333-8333-333333333333";

function detail(patch: Partial<SubmissionDetail> = {}): SubmissionDetail {
  return {
    id: ID,
    formId: "22222222-2222-4222-8222-222222222222",
    stage: "abandoned",
    lines: ["Full name: Dana Cole", "Email: dana@example.com"],
    qualification: {},
    score: null,
    scoreLabel: null,
    attribution: {},
    crmHref: null,
    log: [],
    startedAt: "2026-11-04T19:00:00.000Z",
    completedAt: null,
    formName: "Check Your Date",
    createdAt: "2026-11-04T19:00:00.000Z",
    lastActivityAt: "2026-11-04T19:02:00.000Z",
    abandonedAt: "2026-11-04T19:15:00.000Z",
    contact: { name: "Dana Cole", email: "dana@example.com", phone: null },
    eventDate: null,
    currentStep: 1,
    totalSteps: 4,
    spamReason: null,
    canAddToCrm: true,
    crmBusy: false,
    ...patch,
  };
}

const LINKED = detail({ crmHref: "/clients/c-1", canAddToCrm: false });

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(actions).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function open() {
  await act(async () => {
    root.render(<SubmissionDrawer submissionId={ID} onClose={() => {}} />);
  });
}

function addButton(): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent?.includes(CRM_WORDS.add));
}

async function clickAdd() {
  await act(async () => {
    addButton()?.click();
  });
}

describe("SubmissionDrawer: stacking", () => {
  it("renders under <body>, outside the page's z-10 content wrapper, so skin art can never paint over it", async () => {
    actions.getSubmissionDetail.mockResolvedValueOnce({ ok: true, detail: detail() });
    container.className = "relative z-10";
    await open();
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(container.contains(dialog)).toBe(false);
    expect(dialog?.parentElement?.parentElement).toBe(document.body);
    expect(dialog?.parentElement?.className).toContain("z-[60]");
  });
});

describe("SubmissionDrawer: Add to CRM", () => {
  it("says the card was added when this click created it", async () => {
    actions.getSubmissionDetail.mockResolvedValueOnce({ ok: true, detail: detail() }).mockResolvedValueOnce({ ok: true, detail: LINKED });
    actions.addSubmissionToCrm.mockResolvedValueOnce({ ok: true, crmHref: "/clients/c-1", already: false });
    await open();
    await clickAdd();
    expect(actions.addSubmissionToCrm).toHaveBeenCalledWith(ID);
    expect(document.body.textContent).toContain(CRM_WORDS.added);
    expect(document.body.querySelector('a[href="/clients/c-1"]')?.textContent).toContain(CRM_WORDS.open);
  });

  it("says Already in the CRM when the record existed, and makes no claim of a new one", async () => {
    actions.getSubmissionDetail.mockResolvedValueOnce({ ok: true, detail: detail() }).mockResolvedValueOnce({ ok: true, detail: LINKED });
    actions.addSubmissionToCrm.mockResolvedValueOnce({ ok: true, crmHref: "/clients/c-1", already: true });
    await open();
    await clickAdd();
    expect(document.body.textContent).toContain(CRM_WORDS.already);
    expect(document.body.textContent).not.toContain(CRM_WORDS.added);
    expect(addButton()).toBeUndefined();
  });

  it("shows that another write holds the card instead of offering the button", async () => {
    actions.getSubmissionDetail.mockResolvedValueOnce({ ok: true, detail: detail({ canAddToCrm: false, crmBusy: true }) });
    await open();
    expect(document.body.textContent).toContain(CRM_WORDS.busy);
    expect(addButton()).toBeUndefined();
  });

  it("never shows Added next to the old 'left partway' block while the drawer reloads", async () => {
    let finishReload: (v: unknown) => void = () => undefined;
    actions.getSubmissionDetail
      .mockResolvedValueOnce({ ok: true, detail: detail() })
      .mockReturnValueOnce(new Promise((r) => (finishReload = r)));
    actions.addSubmissionToCrm.mockResolvedValueOnce({ ok: true, crmHref: "/clients/c-1", already: false });
    await open();
    await clickAdd();
    // The add answered, the reload has not: no success line beside the stale Add state.
    expect(document.body.textContent).not.toContain(CRM_WORDS.added);
    await act(async () => finishReload({ ok: true, detail: LINKED }));
    expect(document.body.textContent).toContain(CRM_WORDS.added);
    expect(document.body.querySelector('a[href="/clients/c-1"]')?.textContent).toContain(CRM_WORDS.open);
  });

  it("switches to the busy state when the click loses the claim", async () => {
    actions.getSubmissionDetail
      .mockResolvedValueOnce({ ok: true, detail: detail() })
      .mockResolvedValueOnce({ ok: true, detail: detail({ canAddToCrm: false, crmBusy: true }) });
    actions.addSubmissionToCrm.mockResolvedValueOnce({ ok: false, busy: true, error: CRM_WORDS.busy });
    await open();
    await clickAdd();
    expect(document.body.textContent).toContain(CRM_WORDS.busy);
    expect(addButton()).toBeUndefined();
  });
});
