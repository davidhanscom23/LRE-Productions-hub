import { describe, expect, it, vi } from "vitest";
// @ts-expect-error jsdom ships no type declarations and @types/jsdom is not a dependency of this repo
import { JSDOM as UntypedJSDOM } from "jsdom";
import ts from "typescript";
import { EMBED_HOST_SOURCE, EMBED_MESSAGE_SOURCE, type FormToHostMessage } from "@/lib/inquiry-forms/types";
import { isFormMessage, isHostMessage } from "@/lib/inquiry-forms/embed-protocol";
import { buildEmbedScript } from "./embed-script";

const HUB = "https://hub.example.com";
const HOST_URL = "https://www.example-host.com/contact?utm_source=google&gclid=abc123#section";

type JsdomWindow = Window & typeof globalThis;
interface JSDOM {
  window: JsdomWindow;
}
const JSDOM = UntypedJSDOM as new (html: string, options: Record<string, unknown>) => JSDOM;

interface Page {
  dom: JSDOM;
  win: JsdomWindow;
  assign: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  run: () => void;
}

/** A host page in its own jsdom; the script runs against a window proxy with spyable location/scroll. */
async function hostPage(opts: { body: string; url?: string; baked?: string; storage?: "throw" | Record<string, string> }): Promise<Page> {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${opts.body}</body></html>`, {
    url: opts.url ?? HOST_URL,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  if (win.document.readyState !== "complete") {
    await new Promise<void>((resolve) => win.addEventListener("load", () => resolve()));
  }
  if (opts.storage && opts.storage !== "throw") {
    for (const [k, v] of Object.entries(opts.storage)) win.localStorage.setItem(k, v);
  }
  const assign = vi.fn();
  const scrollTo = vi.fn();
  const warn = vi.fn();
  // jsdom's Location members are non-configurable, so the script gets a plain stand-in with a spy.
  const page = new URL(win.location.href);
  const location = {
    href: page.href,
    origin: page.origin,
    protocol: page.protocol,
    host: page.host,
    hostname: page.hostname,
    pathname: page.pathname,
    search: page.search,
    hash: page.hash,
    assign,
  };
  const proxy = new Proxy(win, {
    get(target, prop) {
      if (prop === "location") return location;
      if (prop === "scrollTo") return scrollTo;
      if (prop === "console") return { warn };
      if (prop === "localStorage" && opts.storage === "throw") throw new Error("SecurityError");
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
  });
  const script = buildEmbedScript(opts.baked ?? HUB);
  const fn = new win.Function("window", "document", script) as (w: unknown, d: unknown) => void;
  return { dom, win, assign, scrollTo, warn, run: () => fn(proxy, win.document) };
}

function iframes(p: Page): HTMLIFrameElement[] {
  return Array.from(p.win.document.querySelectorAll("iframe")) as unknown as HTMLIFrameElement[];
}

function send(p: Page, iframe: HTMLIFrameElement | null, data: unknown, origin = HUB) {
  const ev = new p.win.MessageEvent("message", { data, origin });
  Object.defineProperty(ev, "source", { value: iframe ? iframe.contentWindow : p.win });
  p.win.dispatchEvent(ev);
}

function msg(slug: string, body: Record<string, unknown>) {
  return { source: EMBED_MESSAGE_SOURCE, v: 1, slug, ...body };
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("embed.js mounting", () => {
  it("mounts one iframe per container with the slug, embed=1 and forwarded attribution", async () => {
    const p = await hostPage({
      body: `<div data-inquiry-form="check-your-date" data-inquiry-form-origin="${HUB}"></div><div data-inquiry-form="book-partner-brand"></div>`,
    });
    p.run();
    const [a, b] = iframes(p);
    expect(iframes(p)).toHaveLength(2);
    const src = new URL(a.src);
    expect(src.origin).toBe(HUB);
    expect(src.pathname).toBe("/inquire/check-your-date");
    expect(src.searchParams.get("embed")).toBe("1");
    expect(src.searchParams.get("utm_source")).toBe("google");
    expect(src.searchParams.get("gclid")).toBe("abc123");
    expect(src.searchParams.get("page_url")).toBe("https://www.example-host.com/contact?utm_source=google&gclid=abc123");
    expect(src.searchParams.get("host_domain")).toBe("www.example-host.com");
    expect(src.searchParams.get("landing_url")).toBe("https://www.example-host.com/contact?utm_source=google&gclid=abc123");
    expect(a.title).toBe("check-your-date inquiry form");
    expect(a.style.height).toBe("560px");
    expect(a.style.width).toBe("100%");
    expect(a.getAttribute("loading")).toBe("lazy");
    expect(new URL(b.src).pathname).toBe("/inquire/book-partner-brand");
    expect(p.win.document.querySelector("[data-inquiry-form]")?.hasAttribute("data-inquiry-form-rendered")).toBe(true);
  });

  it("never mounts twice (re-init, or the script loaded twice) and keeps one message listener", async () => {
    const p = await hostPage({ body: `<div data-inquiry-form="check-your-date"></div>` });
    const add = vi.spyOn(p.win, "addEventListener");
    p.run();
    p.run();
    (p.win as unknown as { InquiryForms: { init: () => void } }).InquiryForms.init();
    expect(iframes(p)).toHaveLength(1);
    expect(add.mock.calls.filter((c) => c[0] === "message")).toHaveLength(1);
  });

  it("reads click ids from the hash too", async () => {
    const p = await hostPage({
      url: "https://www.example-host.com/landing#/book?utm_campaign=spring&fbclid=fb1",
      body: `<div data-inquiry-form="check-your-date"></div>`,
    });
    p.run();
    const src = new URL(iframes(p)[0].src);
    expect(src.searchParams.get("utm_campaign")).toBe("spring");
    expect(src.searchParams.get("fbclid")).toBe("fb1");
  });

  it("skips an invalid slug with a console warning", async () => {
    const p = await hostPage({ body: `<div data-inquiry-form="Bad Slug!"></div><div data-inquiry-form="ab"></div>` });
    p.run();
    expect(iframes(p)).toHaveLength(0);
    expect(p.warn).toHaveBeenCalled();
  });

  it("picks up a container added after the script ran (site builders that render late)", async () => {
    const p = await hostPage({ body: `<main id="app"></main>` });
    p.run();
    expect(iframes(p)).toHaveLength(0);
    const div = p.win.document.createElement("div");
    div.setAttribute("data-inquiry-form", "check-your-date");
    p.win.document.getElementById("app")?.appendChild(div);
    await tick(120);
    expect(iframes(p)).toHaveLength(1);
  });
});

describe("embed.js origin resolution", () => {
  const container = `<div data-inquiry-form="check-your-date"></div>`;

  it("a container may name this script's own hub (its src origin or the baked origin)", async () => {
    const p = await hostPage({
      body: `${container.replace("<div ", `<div data-inquiry-form-origin="https://preview.hub.example.com" `)}<script src="https://preview.hub.example.com/inquire/embed.js"></script>`,
      baked: HUB,
    });
    p.run();
    expect(new URL(iframes(p)[0].src).origin).toBe("https://preview.hub.example.com");
  });

  it("never mounts a container that names a foreign origin, and leaves it for that hub's own script", async () => {
    const p = await hostPage({
      body: `<span data-inquiry-form="any-slug" data-inquiry-form-origin="https://evil.example"></span><script src="${HUB}/inquire/embed.js"></script>`,
      baked: HUB,
    });
    p.run();
    expect(iframes(p)).toHaveLength(0);
    expect(p.win.document.querySelector("span")?.hasAttribute("data-inquiry-form-rendered")).toBe(false);
    expect(p.warn).toHaveBeenCalled();
    // A forged redirect from that origin is never honored (no frame is registered for it).
    send(p, null, msg("any-slug", { type: "redirect", url: "https://evil.example/login" }), "https://evil.example");
    await tick(450);
    expect(p.assign).not.toHaveBeenCalled();
  });

  it("ignores a foreign script tag attribute when the script knows its hub", async () => {
    const p = await hostPage({
      body: `${container}<script src="${HUB}/inquire/embed.js" data-inquiry-form-origin="https://script.example.org"></script>`,
      baked: "https://baked.example.net",
    });
    p.run();
    expect(new URL(iframes(p)[0].src).origin).toBe(HUB);
  });

  it("uses the script tag attribute only when the script carries no hub origin of its own", async () => {
    const p = await hostPage({
      body: `${container}<script src="https://www.example-host.com/wp-content/cache/min/1/inquire/embed.js" data-inquiry-form-origin="https://script.example.org"></script>`,
      baked: "",
    });
    p.run();
    expect(new URL(iframes(p)[0].src).origin).toBe("https://script.example.org");
  });

  it("then the script's own src origin when its path is exactly /inquire/embed.js", async () => {
    const p = await hostPage({ body: `${container}<script src="https://preview.hub.example.com/inquire/embed.js"></script>`, baked: HUB });
    p.run();
    expect(new URL(iframes(p)[0].src).origin).toBe("https://preview.hub.example.com");
  });

  it("ignores a copy cached on the host domain and falls back to the baked origin", async () => {
    const p = await hostPage({
      body: `${container}<script src="https://www.example-host.com/wp-content/cache/min/1/inquire/embed.js"></script>`,
      baked: HUB,
    });
    p.run();
    expect(new URL(iframes(p)[0].src).origin).toBe(HUB);
  });

  it("refuses non-http(s) origins and warns when no origin is left", async () => {
    const p = await hostPage({
      body: `<div data-inquiry-form="check-your-date" data-inquiry-form-origin="javascript:alert(1)"></div>`,
      baked: "not a url",
    });
    p.run();
    expect(iframes(p)).toHaveLength(0);
    expect(p.warn).toHaveBeenCalled();
  });
});

describe("embed.js messages", () => {
  async function mounted() {
    const p = await hostPage({ body: `<div id="c" data-inquiry-form="check-your-date"></div>` });
    p.run();
    return { p, iframe: iframes(p)[0] };
  }

  it("resizes from a valid height message and clamps to 200..6000", async () => {
    const { p, iframe } = await mounted();
    send(p, iframe, msg("check-your-date", { type: "height", height: 731.2 }));
    expect(iframe.style.height).toBe("732px");
    send(p, iframe, msg("check-your-date", { type: "height", height: 99999 }));
    expect(iframe.style.height).toBe("6000px");
    send(p, iframe, msg("check-your-date", { type: "height", height: 12 }));
    expect(iframe.style.height).toBe("200px");
  });

  it("ignores messages from another origin, another window, another slug or another protocol version", async () => {
    const { p, iframe } = await mounted();
    send(p, iframe, msg("check-your-date", { type: "height", height: 900 }), "https://evil.example.com");
    send(p, null, msg("check-your-date", { type: "height", height: 900 }));
    send(p, iframe, msg("book-partner-brand", { type: "height", height: 900 }));
    send(p, iframe, { ...msg("check-your-date", { type: "height", height: 900 }), v: 2 });
    send(p, iframe, { type: "leadgate-resize", formId: "x", height: 900 });
    send(p, iframe, JSON.stringify(msg("check-your-date", { type: "height", height: 900 })));
    expect(iframe.style.height).toBe("560px");
  });

  it("marks the container ready", async () => {
    const { p, iframe } = await mounted();
    send(p, iframe, msg("check-your-date", { type: "ready" }));
    expect(p.win.document.getElementById("c")?.hasAttribute("data-inquiry-form-ready")).toBe(true);
  });

  it("scrolls the frame top into view with 90px headroom only when it is out of view", async () => {
    const { p, iframe } = await mounted();
    Object.defineProperty(p.win, "pageYOffset", { value: 1200, configurable: true });
    iframe.getBoundingClientRect = () => ({ top: 120, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    send(p, iframe, msg("check-your-date", { type: "step", index: 1, total: 5 }));
    expect(p.scrollTo).not.toHaveBeenCalled();
    iframe.getBoundingClientRect = () => ({ top: -500, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    send(p, iframe, msg("check-your-date", { type: "step", index: 2, total: 5 }));
    expect(p.scrollTo).toHaveBeenCalledWith({ top: 610, behavior: "smooth" });
  });

  it("keeps the 90px headroom when the frame's shrink arrives before its step message", async () => {
    const { p, iframe } = await mounted();
    Object.defineProperty(p.win, "pageYOffset", { value: 1200, configurable: true });
    // The shorter step made the page shorter: the browser clamped the scroll and the top sits at 0 px.
    send(p, iframe, msg("check-your-date", { type: "height", height: 400 }));
    iframe.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    send(p, iframe, msg("check-your-date", { type: "step", index: 1, total: 5 }));
    expect(p.scrollTo).toHaveBeenCalledWith({ top: 1110, behavior: "smooth" });
  });

  it("re-checks the headroom when the shrink arrives right after the step message", async () => {
    const { p, iframe } = await mounted();
    Object.defineProperty(p.win, "pageYOffset", { value: 1200, configurable: true });
    iframe.getBoundingClientRect = () => ({ top: 90, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    send(p, iframe, msg("check-your-date", { type: "step", index: 1, total: 5 }));
    expect(p.scrollTo).not.toHaveBeenCalled();
    // Then the frame shrinks and the clamp pulls the top up to 0 px.
    iframe.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    send(p, iframe, msg("check-your-date", { type: "height", height: 400 }));
    expect(p.scrollTo).toHaveBeenCalledWith({ top: 1110, behavior: "smooth" });
    // A plain resize long after the step never scrolls the visitor's page.
    p.scrollTo.mockClear();
    const later = Date.now() + 5000;
    const spy = vi.spyOn((p.win as unknown as { Date: DateConstructor }).Date, "now").mockReturnValue(later);
    send(p, iframe, msg("check-your-date", { type: "height", height: 700 }));
    spy.mockRestore();
    expect(p.scrollTo).not.toHaveBeenCalled();
  });

  it("fires the host conversion once: dataLayer, fbq Lead and a DOM event", async () => {
    const { p, iframe } = await mounted();
    const fbq = vi.fn();
    (p.win as unknown as { fbq: unknown }).fbq = fbq;
    const onEvent = vi.fn();
    p.win.document.addEventListener("inquiryform:submitted", (e) => onEvent((e as CustomEvent).detail));
    const submitted = msg("check-your-date", { type: "submitted", ending: "completed", formName: "Check Your Date" });
    send(p, iframe, submitted);
    send(p, iframe, submitted);
    const dl = (p.win as unknown as { dataLayer: unknown[] }).dataLayer;
    expect(dl).toEqual([{ event: "inquiry_form_submitted", inquiry_form: "check-your-date", inquiry_ending: "completed" }]);
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("track", "Lead");
    expect(onEvent).toHaveBeenCalledWith({ slug: "check-your-date", ending: "completed", formName: "Check Your Date" });
  });

  it("a throwing host pixel never breaks the page", async () => {
    const { p, iframe } = await mounted();
    (p.win as unknown as { fbq: unknown }).fbq = () => {
      throw new Error("pixel down");
    };
    expect(() => send(p, iframe, msg("check-your-date", { type: "submitted", ending: "waitlisted", formName: "X" }))).not.toThrow();
  });

  it("redirects the whole page only to absolute http(s), after acking the frame", async () => {
    const { p, iframe } = await mounted();
    const ack = vi.spyOn(iframe.contentWindow as Window, "postMessage");
    send(p, iframe, msg("check-your-date", { type: "redirect", url: "javascript:alert(document.cookie)" }));
    send(p, iframe, msg("check-your-date", { type: "redirect", url: "/thank-you" }));
    await tick(10);
    expect(p.assign).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();

    send(p, iframe, msg("check-your-date", { type: "redirect", url: "https://example.com/thank-you" }));
    expect(ack).toHaveBeenCalledWith({ source: EMBED_HOST_SOURCE, v: 1, type: "redirect-ack" }, HUB);
    expect(isHostMessage(ack.mock.calls[0][0])).toBe(true);
    await tick(10);
    expect(p.assign).toHaveBeenCalledWith("https://example.com/thank-you");

    send(p, iframe, msg("check-your-date", { type: "redirect", url: "https://elsewhere.example.com/" }));
    await tick(10);
    expect(p.assign).toHaveBeenCalledTimes(1);
  });

  it("gives a just-fired conversion a moment before navigating", async () => {
    const { p, iframe } = await mounted();
    send(p, iframe, msg("check-your-date", { type: "submitted", ending: "completed", formName: "X" }));
    send(p, iframe, msg("check-your-date", { type: "redirect", url: "https://example.com/thank-you" }));
    await tick(50);
    expect(p.assign).not.toHaveBeenCalled();
    await tick(450);
    expect(p.assign).toHaveBeenCalledTimes(1);
  });
});

describe("embed.js first-touch attribution", () => {
  const container = `<div data-inquiry-form="check-your-date"></div>`;
  const KEY = "inquiryForms.firstTouch.v1";

  it("reuses the stored landing page and click ids on a later page without params", async () => {
    const at = Date.now() - 24 * 60 * 60 * 1000;
    const p = await hostPage({
      url: "https://www.example-host.com/contact",
      body: container,
      storage: { [KEY]: JSON.stringify({ at, landing: "https://www.example-host.com/?utm_source=facebook", params: { utm_source: "facebook", fbclid: "fb9" } }) },
    });
    p.run();
    const src = new URL(iframes(p)[0].src);
    expect(src.searchParams.get("utm_source")).toBe("facebook");
    expect(src.searchParams.get("fbclid")).toBe("fb9");
    expect(src.searchParams.get("landing_url")).toBe("https://www.example-host.com/?utm_source=facebook");
    expect(src.searchParams.get("page_url")).toBe("https://www.example-host.com/contact");
  });

  it("starts over after 30 days", async () => {
    const at = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const p = await hostPage({
      url: "https://www.example-host.com/contact",
      body: container,
      storage: { [KEY]: JSON.stringify({ at, landing: "https://old.example/", params: { utm_source: "old" } }) },
    });
    p.run();
    const src = new URL(iframes(p)[0].src);
    expect(src.searchParams.get("utm_source")).toBeNull();
    expect(src.searchParams.get("landing_url")).toBe("https://www.example-host.com/contact");
    const stored = JSON.parse(p.win.localStorage.getItem(KEY) ?? "{}");
    expect(stored.landing).toBe("https://www.example-host.com/contact");
  });

  it("still mounts when localStorage is blocked", async () => {
    const p = await hostPage({ body: container, storage: "throw" });
    p.run();
    expect(iframes(p)).toHaveLength(1);
    expect(new URL(iframes(p)[0].src).searchParams.get("gclid")).toBe("abc123");
  });
});

describe("protocol agreement", () => {
  it("every message the form posts is accepted by the shared guard", async () => {
    const samples: FormToHostMessage[] = [
      { source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date", type: "ready" },
      { source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date", type: "height", height: 812 },
      { source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date", type: "step", index: 4, total: 5 },
      { source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date", type: "submitted", ending: "completed", formName: "Check Your Date" },
      { source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date", type: "redirect", url: "https://example.com/thanks" },
    ];
    for (const m of samples) expect(isFormMessage(m)).toBe(true);
  });
});

/** Syntax newer than ES2017 found in `source` (empty = plain ES2017). Throws on a parse error. */
function newerThanEs2017(source: string): string[] {
  const file = ts.createSourceFile("embed.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const parseDiagnostics = (file as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? [];
  if (parseDiagnostics.length > 0) throw new Error("embed script does not parse");
  const found: string[] = [];
    const visit = (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.QuestionDotToken:
          found.push("optional chaining");
          break;
        case ts.SyntaxKind.QuestionQuestionToken:
        case ts.SyntaxKind.QuestionQuestionEqualsToken:
        case ts.SyntaxKind.BarBarEqualsToken:
        case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
          found.push("ES2020+ operator");
          break;
        case ts.SyntaxKind.SpreadAssignment:
          found.push("object spread");
          break;
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.PrivateIdentifier:
          found.push("class fields");
          break;
        case ts.SyntaxKind.BigIntLiteral:
          found.push("bigint");
          break;
        case ts.SyntaxKind.MetaProperty:
        case ts.SyntaxKind.ImportKeyword:
          found.push("import");
          break;
        default:
          break;
      }
      if (ts.isCatchClause(node) && !node.variableDeclaration) found.push("optional catch binding");
      if (ts.isBindingElement(node) && node.dotDotDotToken && ts.isObjectBindingPattern(node.parent)) found.push("object rest");
      if (ts.isForOfStatement(node) && node.awaitModifier) found.push("for await");
      if (ts.isNumericLiteral(node) && node.getText(file).includes("_")) found.push("numeric separator");
      if (ts.isRegularExpressionLiteral(node)) {
        const text = node.getText(file);
        const flags = text.slice(text.lastIndexOf("/") + 1);
        if (/[sd]/.test(flags) || text.includes("(?<")) found.push("ES2018+ regex");
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  return found;
}

describe("embed.js syntax", () => {
  it("is plain ES2017 (no optional chaining, nullish, object spread, optional catch binding, class fields)", async () => {
    expect(newerThanEs2017(buildEmbedScript(HUB))).toEqual([]);
  });

  it("the syntax check itself catches planted ES2018+ code", async () => {
    const planted = [
      "var a = b?.c;",
      "var d = e ?? 1;",
      "var o = { ...p };",
      "try { x(); } catch { y(); }",
      "var { q, ...rest } = r;",
      "var re = /a.b/s;",
    ].join("\n");
    expect(newerThanEs2017(planted)).toEqual([
      "optional chaining",
      "ES2020+ operator",
      "object spread",
      "optional catch binding",
      "object rest",
      "ES2018+ regex",
    ]);
  });

  it("bakes only a clean http(s) origin", async () => {
    expect(buildEmbedScript("https://hub.example.com/some/path")).toContain('var BAKED_ORIGIN = "https://hub.example.com";');
    expect(buildEmbedScript("javascript:alert(1)")).toContain('var BAKED_ORIGIN = "";');
    expect(buildEmbedScript('"; alert(1); "')).toContain('var BAKED_ORIGIN = "";');
  });
});
