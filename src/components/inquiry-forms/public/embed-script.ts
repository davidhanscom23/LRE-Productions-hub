/**
 * Inquiry Forms - source of the hosted embed script served at /inquire/embed.js.
 *
 * The one snippet a site owner pastes:
 *   <div data-inquiry-form="check-your-date" data-inquiry-form-origin="https://hub.example.com"></div>
 *   <script src="https://hub.example.com/inquire/embed.js" async></script>
 *
 * Rules carried from LeadGate and KM Hub incidents (study 2 sec 17-18, KM Hub lessons sec 1.2):
 * - Plain ES2017, no dependencies, safe when injected async or delayed (WP Rocket runs it with
 *   document.currentScript === null, so the script tag is optional and every read of it is guarded).
 * - Origin: container data-inquiry-form-origin > script data-inquiry-form-origin (or data-origin) > the
 *   script src origin only when its path is exactly /inquire/embed.js (a minified copy cached on the host
 *   domain must not point the iframe at the host) > the origin baked in by the server.
 * - The origin is pinned by the hub, never by page markup: once the script knows its own hub (the baked
 *   origin or its /inquire/embed.js src origin), a container or script attribute naming any other origin is
 *   refused. Such a container is skipped without the rendered mark, so another hub's own script can mount it.
 * - Every message is checked: e.origin === the frame's origin, e.source === that iframe's window, and the
 *   source / v / slug shape. Height is clamped 200..6000 and never re-applied when unchanged.
 * - Step change scrolls the frame top into view with 90px headroom, only when it is out of view (or above the
 *   headroom). Height messages right after a step re-check it, so the order of shrink and step never matters.
 * - Redirect: absolute http(s) only, ack the frame, then navigate the whole page.
 * - Submitted: dataLayer push + fbq Lead (when present) + a DOM CustomEvent, once per frame.
 * - Attribution from the host query AND hash, plus a first-touch record in localStorage for 30 days.
 * - [data-inquiry-form-rendered] guard, one global message listener, late containers picked up.
 *
 * The script body only touches the `w` / `d` parameters it is invoked with, so tests can run it against
 * a jsdom window with a spyable location.
 */

/** Exact public path of the script (also used by the origin rule inside it). */
export const EMBED_SCRIPT_PATH = "/inquire/embed.js";

/** Build the script source with the canonical hub origin baked in ("" when unknown). */
export function buildEmbedScript(bakedOrigin: string): string {
  const baked = JSON.stringify(cleanBakedOrigin(bakedOrigin));
  return `/* Inquiry Forms embed v1 */
(function (w, d) {
  "use strict";
  var BAKED_ORIGIN = ${baked};
  var SCRIPT_PATH = "${EMBED_SCRIPT_PATH}";
  var FORM_SOURCE = "inquiry-forms";
  var HOST_SOURCE = "inquiry-forms-host";
  var MIN_HEIGHT = 200;
  var MAX_HEIGHT = 6000;
  var INITIAL_HEIGHT = 560;
  var HEADROOM = 90;
  var REVEAL_WINDOW_MS = 1500;
  var STORE_KEY = "inquiryForms.firstTouch.v1";
  var FIRST_TOUCH_MS = 30 * 24 * 60 * 60 * 1000;
  var PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "gbraid", "wbraid", "fbclid", "msclkid"];
  var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  var state = w.__inquiryFormsEmbed;
  if (!state || typeof state !== "object" || !state.frames) {
    state = { frames: [], listening: false, observing: false };
    w.__inquiryFormsEmbed = state;
  }

  function warn(msg) {
    try { if (w.console && w.console.warn) w.console.warn("[inquiry-forms] " + msg); } catch (e) { /* ignore */ }
  }

  function cleanOrigin(value) {
    if (!value || typeof value !== "string") return null;
    try {
      var u = new URL(value.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      return u.origin;
    } catch (e) {
      return null;
    }
  }

  var me = null;
  try { me = d.currentScript || null; } catch (e) { me = null; }
  if (!me || !me.getAttribute) {
    try { me = d.querySelector('script[src*="' + SCRIPT_PATH + '"]'); } catch (e) { me = null; }
  }

  var scriptExplicitOrigin = null;
  var scriptSrcOrigin = null;
  if (me && me.getAttribute) {
    scriptExplicitOrigin = cleanOrigin(me.getAttribute("data-inquiry-form-origin")) ||
      cleanOrigin(me.getAttribute("data-origin"));
    var rawSrc = me.getAttribute("src") || "";
    if (rawSrc) {
      try {
        var su = new URL(rawSrc, w.location.href);
        if ((su.protocol === "https:" || su.protocol === "http:") && su.pathname === SCRIPT_PATH) {
          scriptSrcOrigin = su.origin;
        }
      } catch (e) { scriptSrcOrigin = null; }
    }
  }

  // The hub(s) this copy of the script belongs to. Empty only when it knows none (no baked origin and a
  // copy served from elsewhere); then the page attributes are all there is.
  var trusted = [];
  var bakedOrigin = cleanOrigin(BAKED_ORIGIN);
  if (scriptSrcOrigin) trusted.push(scriptSrcOrigin);
  if (bakedOrigin && bakedOrigin !== scriptSrcOrigin) trusted.push(bakedOrigin);

  function isTrusted(origin) {
    if (!origin) return false;
    if (trusted.length === 0) return true;
    for (var i = 0; i < trusted.length; i++) if (trusted[i] === origin) return true;
    return false;
  }

  function cut(value, max) {
    var s = String(value);
    return s.length > max ? s.slice(0, max) : s;
  }

  function hashQuery(hash) {
    if (!hash) return "";
    var h = hash.charAt(0) === "#" ? hash.slice(1) : hash;
    var q = h.indexOf("?");
    return q >= 0 ? h.slice(q + 1) : h;
  }

  function readParams() {
    var out = {};
    var found = false;
    var lists = [];
    try { lists.push(new URLSearchParams(w.location.search || "")); } catch (e) { /* ignore */ }
    try { lists.push(new URLSearchParams(hashQuery(w.location.hash || ""))); } catch (e) { /* ignore */ }
    for (var i = 0; i < lists.length; i++) {
      for (var k = 0; k < PARAM_KEYS.length; k++) {
        var key = PARAM_KEYS[k];
        var val = lists[i].get(key);
        if (val && !out[key]) {
          out[key] = cut(val, 200);
          found = true;
        }
      }
    }
    return found ? out : null;
  }

  function pageUrl() {
    var loc = w.location;
    return cut(loc.origin + loc.pathname + (loc.search || ""), 500);
  }

  function firstTouch(now, current) {
    var rec = null;
    try {
      var raw = w.localStorage ? w.localStorage.getItem(STORE_KEY) : null;
      if (raw) rec = JSON.parse(raw);
    } catch (e) { rec = null; }
    if (!rec || typeof rec !== "object" || typeof rec.at !== "number" || now - rec.at > FIRST_TOUCH_MS ||
        rec.at > now + 60000 || typeof rec.landing !== "string") {
      rec = { at: now, landing: pageUrl(), params: null };
    }
    if (current) rec.params = current;
    try { if (w.localStorage) w.localStorage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
    return rec;
  }

  function attribution() {
    var current = readParams();
    var rec = firstTouch(Date.now(), current);
    var params = current || (rec.params && typeof rec.params === "object" ? rec.params : {});
    var out = {};
    for (var k = 0; k < PARAM_KEYS.length; k++) {
      var key = PARAM_KEYS[k];
      if (typeof params[key] === "string" && params[key]) out[key] = cut(params[key], 200);
    }
    out.page_url = pageUrl();
    out.host_domain = cut(w.location.hostname || "", 200);
    if (d.referrer) out.referrer = cut(d.referrer, 500);
    if (rec.landing) out.landing_url = cut(rec.landing, 500);
    return out;
  }

  function buildSrc(origin, slug, attr) {
    var q = ["embed=1"];
    for (var key in attr) {
      if (Object.prototype.hasOwnProperty.call(attr, key) && attr[key]) {
        q.push(encodeURIComponent(key) + "=" + encodeURIComponent(attr[key]));
      }
    }
    return origin + "/inquire/" + encodeURIComponent(slug) + "?" + q.join("&");
  }

  var preconnected = {};
  function preconnect(origin) {
    if (preconnected[origin] || !d.head) return;
    preconnected[origin] = true;
    try {
      var link = d.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      d.head.appendChild(link);
    } catch (e) { /* ignore */ }
  }

  function mount(container) {
    if (!container || !container.getAttribute || container.hasAttribute("data-inquiry-form-rendered")) return;
    var slug = (container.getAttribute("data-inquiry-form") || "").trim();
    if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
      warn("skipped a container with an invalid form slug");
      return;
    }
    var named = cleanOrigin(container.getAttribute("data-inquiry-form-origin"));
    if (named && !isTrusted(named)) {
      // Not this hub's form: never frame, redirect or resize for an origin the markup picked.
      warn("skipped a container whose form origin is not this script's hub");
      return;
    }
    var origin = named || (isTrusted(scriptExplicitOrigin) ? scriptExplicitOrigin : null) ||
      scriptSrcOrigin || bakedOrigin;
    if (!origin) {
      warn("no form origin: add data-inquiry-form-origin to the container");
      return;
    }
    container.setAttribute("data-inquiry-form-rendered", "");
    var iframe = d.createElement("iframe");
    iframe.src = buildSrc(origin, slug, attribution());
    iframe.title = slug + " inquiry form";
    iframe.setAttribute("loading", "lazy");
    iframe.style.cssText = "display:block;width:100%;max-width:100%;border:0;margin:0;padding:0;height:" +
      INITIAL_HEIGHT + "px;";
    container.appendChild(iframe);
    state.frames.push({
      iframe: iframe, container: container, slug: slug, origin: origin,
      height: INITIAL_HEIGHT, submittedAt: 0, redirected: false, revealUntil: 0
    });
    preconnect(origin);
  }

  function frameFor(source) {
    if (!source) return null;
    for (var i = 0; i < state.frames.length; i++) {
      var f = state.frames[i];
      if (f.iframe.contentWindow === source) return f;
    }
    return null;
  }

  function setHeight(f, h) {
    var next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.ceil(h)));
    if (next === f.height) return;
    f.height = next;
    f.iframe.style.height = next + "px";
    // A shrink right after a step can clamp the page scroll and pull the frame top under the headroom.
    if (f.revealUntil && Date.now() <= f.revealUntil) revealTop(f);
  }

  function reducedMotion() {
    try { return !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  function revealTop(f) {
    var r = f.iframe.getBoundingClientRect();
    var vh = w.innerHeight || (d.documentElement ? d.documentElement.clientHeight : 0) || 0;
    if (r.top >= HEADROOM && r.top <= vh - 120) return;
    var y = w.pageYOffset || (d.documentElement ? d.documentElement.scrollTop : 0) || 0;
    var top = Math.max(0, r.top + y - HEADROOM);
    try {
      w.scrollTo({ top: top, behavior: reducedMotion() ? "auto" : "smooth" });
    } catch (e) {
      try { w.scrollTo(0, top); } catch (e2) { /* ignore */ }
    }
  }

  function fireConversions(f, data) {
    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: "inquiry_form_submitted", inquiry_form: f.slug, inquiry_ending: data.ending });
    } catch (e) { /* a host tag must never break the form */ }
    try { if (typeof w.fbq === "function") w.fbq("track", "Lead"); } catch (e) { /* ignore */ }
    try {
      f.container.dispatchEvent(new w.CustomEvent("inquiryform:submitted", {
        bubbles: true,
        detail: { slug: f.slug, ending: data.ending, formName: typeof data.formName === "string" ? data.formName : "" }
      }));
    } catch (e) { /* ignore */ }
  }

  function safeUrl(u) {
    if (typeof u !== "string" || u.length > 2048 || !/^https?:/i.test(u)) return null;
    try {
      var p = new URL(u);
      return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
    } catch (e) {
      return null;
    }
  }

  function onMessage(e) {
    var data = e ? e.data : null;
    if (!data || typeof data !== "object" || data.source !== FORM_SOURCE || data.v !== 1 ||
        typeof data.type !== "string" || typeof data.slug !== "string") return;
    var f = frameFor(e.source);
    if (!f || e.origin !== f.origin || data.slug !== f.slug) return;
    if (data.type === "ready") {
      f.container.setAttribute("data-inquiry-form-ready", "");
    } else if (data.type === "height") {
      if (typeof data.height === "number" && isFinite(data.height) && data.height > 0) setHeight(f, data.height);
    } else if (data.type === "step") {
      f.revealUntil = Date.now() + REVEAL_WINDOW_MS;
      revealTop(f);
    } else if (data.type === "submitted") {
      if (!f.submittedAt && (data.ending === "completed" || data.ending === "waitlisted")) {
        f.submittedAt = Date.now();
        fireConversions(f, data);
      }
    } else if (data.type === "redirect") {
      var url = safeUrl(data.url);
      if (!url || f.redirected) return;
      f.redirected = true;
      try { e.source.postMessage({ source: HOST_SOURCE, v: 1, type: "redirect-ack" }, f.origin); } catch (err) { /* ignore */ }
      var wait = f.submittedAt && Date.now() - f.submittedAt < 1000 ? 400 : 0;
      w.setTimeout(function () { w.location.assign(url); }, wait);
    }
  }

  function init() {
    var nodes;
    try { nodes = d.querySelectorAll("[data-inquiry-form]"); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  var pending = null;
  function watch() {
    if (state.observing || !w.MutationObserver || !d.documentElement) return;
    state.observing = true;
    var mo = new w.MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].addedNodes && records[i].addedNodes.length) {
          if (pending === null) pending = w.setTimeout(function () { pending = null; init(); }, 60);
          return;
        }
      }
    });
    mo.observe(d.documentElement, { childList: true, subtree: true });
  }

  if (!state.listening) {
    state.listening = true;
    w.addEventListener("message", onMessage);
  }
  w.InquiryForms = w.InquiryForms || {};
  w.InquiryForms.init = init;

  function start() {
    init();
    watch();
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start);
  else start();
})(window, document);
`;
}

/** Only an absolute http(s) origin may be baked into the script. */
function cleanBakedOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
  } catch {
    return "";
  }
}
