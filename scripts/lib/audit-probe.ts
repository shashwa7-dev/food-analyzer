// The in-page half of pnpm ui:audit: serialised into the page by page.evaluate, so it must be
// self-contained (no imports, no closures over module scope). Returns every offender it finds.
//
// Rules (spec §3):
//   wrap     — a button, tab, chip or pill whose text breaks onto a second line, or overflows its box.
//   lime     — text whose computed colour is --brand (lime is a fill, never text).
//   contrast — text below WCAG AA (4.5:1, or 3:1 for large text) against the nearest opaque background.
//   target   — an interactive element smaller than 44×44 px with no ::before/::after or parent hit area.
//   height   — (ui-audit.ts, not this probe) Today's meal cards differ in height.

export type Finding = { rule: "wrap" | "lime" | "contrast" | "target" | "height" | "missing"; selector: string; text: string; detail: string };
export type ProbeResult = { findings: Finding[]; checked: { text: number; contrastSkipped: number; controls: number; targets: number } };

export function probe(): ProbeResult {
  const findings: Finding[] = [];
  const checked = { text: 0, contrastSkipped: 0, controls: 0, targets: 0 };

  // --- colours: let the canvas resolve any CSS colour (oklch, color-mix, …) to sRGB -----------------
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = 1;
  const ctx = cvs.getContext("2d", { willReadFrequently: true })!;
  const cache = new Map<string, [number, number, number, number]>();
  function rgba(css: string): [number, number, number, number] {
    const hit = cache.get(css);
    if (hit) return hit;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    // getImageData un-premultiplies; at alpha 0 the channels are meaningless.
    const out: [number, number, number, number] = [r!, g!, b!, a! / 255];
    cache.set(css, out);
    return out;
  }
  const over = (top: number[], bottom: number[]) => {
    const a = top[3]!;
    return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a)).concat(1);
  };
  const lum = (c: number[]) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x! + 0.05) / (y! + 0.05);
  };
  const probeEl = document.createElement("span");
  probeEl.style.color = "var(--brand)";
  document.body.appendChild(probeEl);
  const brand = rgba(getComputedStyle(probeEl).color);
  probeEl.remove();
  const sameColour = (a: number[], b: number[]) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]!) <= 2) && a[3]! > 0.5;

  // --- helpers ----------------------------------------------------------------------------------------
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.visibility === "collapse") return false;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === "none" || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const srOnly = (el: Element) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (cs.position === "absolute" && r.width <= 1 && r.height <= 1) || cs.clipPath === "inset(50%)" || cs.clip === "rect(0px, 0px, 0px, 0px)";
  };
  const decorative = (el: Element) => !!el.closest("[aria-hidden=true], [inert], svg, [role=presentation][aria-hidden]");
  const disabled = (el: Element) => !!el.closest(":disabled, [aria-disabled=true], [data-disabled]");
  function selector(el: Element): string {
    const parts: string[] = [];
    for (let e: Element | null = el, i = 0; e && e !== document.body && i < 4; e = e.parentElement, i++) {
      let s = e.tagName.toLowerCase();
      const label = e.getAttribute("aria-label");
      const slot = e.getAttribute("data-slot");
      if (e.id && !/^(_r_|base-ui|radix)/.test(e.id) && !e.id.includes(":")) s += `#${e.id}`;
      else if (label) s += `[aria-label="${label.slice(0, 40)}"]`;
      else if (slot) s += `[data-slot=${slot}]`;
      else if (e.getAttribute("role")) s += `[role=${e.getAttribute("role")}]`;
      else {
        const cls = [...e.classList].filter((c) => !/[:[\]/]/.test(c)).slice(0, 2);
        if (cls.length) s += `.${cls.join(".")}`;
      }
      parts.unshift(s);
      if (e.id || label) break;
    }
    return parts.join(" > ");
  }
  const textOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || el.getAttribute("aria-label") || "";

  // A modal sheet or dialog makes the page behind it inert: only audit the topmost one.
  const modals = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].filter(visible);
  const scope: Element = modals.at(-1) ?? document.body;

  // --- background behind a text element -----------------------------------------------------------------
  // Walks the paint stack under the text's centre (elementsFromPoint) when it's on screen, else the
  // ancestor chain, compositing translucent fills until an opaque one. A gradient counts as each of its
  // colour stops (the text is checked against the worst). Returns null when an image, video or canvas
  // sits in the way (contrast can't be computed from styles).
  const COLOUR = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color|color-mix)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi;
  function backgrounds(el: Element, x: number, y: number): number[][] | null {
    let stack: Element[] = [];
    if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight) {
      stack = document.elementsFromPoint(x, y);
      const at = stack.findIndex((e) => e === el || e.contains(el) || el.contains(e));
      stack = at >= 0 ? stack.slice(at) : [];
    }
    if (!stack.length) for (let e: Element | null = el; e; e = e.parentElement) stack.push(e);
    // Each layer is the set of colours it may show (one for a fill, its stops for a gradient).
    const layers: number[][][] = [];
    for (const e of stack) {
      if (/^(IMG|VIDEO|CANVAS|IFRAME)$/.test(e.tagName)) return null;
      const cs = getComputedStyle(e);
      const op = Number(cs.opacity);
      const img = cs.backgroundImage;
      if (img && img !== "none") {
        if (/url\(/.test(img)) return null;
        const stops = (img.match(COLOUR) ?? []).map((s) => rgba(s)).map((c) => [c[0]!, c[1]!, c[2]!, c[3]! * op]);
        if (stops.length) layers.push(stops);
      }
      const c = rgba(cs.backgroundColor);
      if (c[3]! > 0) layers.push([[c[0]!, c[1]!, c[2]!, c[3]! * op]]);
      if (c[3]! >= 0.999 && op >= 0.999) break;
    }
    let out = [[255, 255, 255, 1]];
    for (const l of layers.reverse()) out = l.flatMap((top) => out.map((b) => over(top, b))).slice(0, 32);
    return out;
  }

  // --- text: lime and contrast ------------------------------------------------------------------------
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !(n.textContent ?? "").trim()) continue;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE|OPTION)$/.test(el.tagName)) continue;
    seen.add(el);
    if (!visible(el) || decorative(el) || srOnly(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rect = range.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    checked.text++;
    const cs = getComputedStyle(el);
    let alpha = 1;
    for (let e: Element | null = el; e; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
    const fg = rgba(cs.color);
    const text = (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (sameColour(fg, brand)) findings.push({ rule: "lime", selector: selector(el), text, detail: "lime used as text" });
    if (disabled(el)) continue; // WCAG 1.4.3 exempts inactive controls
    if (fg[3]! < 0.05) { checked.contrastSkipped++; continue; } // gradient-clipped text
    const bgs = backgrounds(el, rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!bgs) { checked.contrastSkipped++; continue; }
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    let worst = { got: Infinity, eff: [0, 0, 0, 1], bg: [0, 0, 0, 1] };
    for (const b of bgs) {
      const eff = over([fg[0]!, fg[1]!, fg[2]!, fg[3]! * alpha], b);
      const got = ratio(eff, b);
      if (got < worst.got) worst = { got, eff, bg: b };
    }
    const { got, eff, bg } = worst;
    if (got < need - 0.005) {
      const hex = (c: number[]) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
      findings.push({ rule: "contrast", selector: selector(el), text, detail: `${got.toFixed(2)}:1 < ${need}:1 (${hex(eff)} on ${hex(bg)}, ${size}px/${cs.fontWeight})` });
    }
  }

  // --- no-wrap: buttons, tabs, chips, pills --------------------------------------------------------------
  // Each text node inside the control must sit on one line (its range has one line box), and the control
  // must not overflow. Stacked rows (name over meta) pass: each line is its own text node.
  // Links styled as buttons or pills count too: a flex/grid <a> with a fill or a border.
  const pillLink = (a: Element) => {
    const cs = getComputedStyle(a);
    return /flex|grid/.test(cs.display) && (rgba(cs.backgroundColor)[3]! > 0 || parseFloat(cs.borderTopWidth) > 0);
  };
  const controls = [
    ...scope.querySelectorAll("button, [role=button], [role=tab], a[data-slot=button], [data-chip], [data-pill]"),
    ...[...scope.querySelectorAll("a[href]:not([data-slot=button])")].filter(pillLink),
  ];
  for (const el of controls) {
    if (!visible(el) || srOnly(el)) continue;
    checked.controls++;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let wrapped = false;
    for (let n = tw.nextNode(); n && !wrapped; n = tw.nextNode()) {
      if (!(n.textContent ?? "").trim() || !n.parentElement || !visible(n.parentElement)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const tops = new Set<number>();
      for (const q of r.getClientRects()) if (q.width > 0.5) tops.add(Math.round(q.top / 4));
      // Collapse neighbouring buckets (sub-pixel jitter between rects on one line).
      const lines = [...tops].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1]! > 1).length;
      if (lines > 1) wrapped = true;
    }
    const ws = getComputedStyle(el).whiteSpace;
    const overflow = el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0;
    if (wrapped || overflow) {
      findings.push({ rule: "wrap", selector: selector(el), text: textOf(el), detail: wrapped ? `text wraps (white-space: ${ws})` : `overflows: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}` });
    }
  }

  // --- tap targets ---------------------------------------------------------------------------------------
  const MIN = 44 - 0.5;
  const interactive = [...scope.querySelectorAll(
    "a[href], button, [role=button], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option], input:not([type=hidden]), select, textarea, summary",
  )];
  const pseudoBox = (el: Element, r: DOMRect, which: "::before" | "::after") => {
    const cs = getComputedStyle(el, which);
    if (!cs.content || cs.content === "none" || cs.display === "none" || cs.position !== "absolute") return null;
    const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : NaN);
    let w = px(cs.width);
    let h = px(cs.height);
    // getComputedStyle resolves an inset-only pseudo's width/height to px; fall back to the insets.
    if (Number.isNaN(w)) w = r.width - (px(cs.left) || 0) - (px(cs.right) || 0);
    if (Number.isNaN(h)) h = r.height - (px(cs.top) || 0) - (px(cs.bottom) || 0);
    return { w, h };
  };
  const inlineProseLink = (el: Element) => {
    if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false;
    const block = el.parentElement?.closest("p, li, dd, td, figcaption, small, label, span, div");
    const all = (block?.textContent ?? "").trim().length;
    return all > (el.textContent ?? "").trim().length + 3;
  };
  for (const el of interactive) {
    if (el.closest("[aria-hidden=true], [inert]")) continue;
    if (!visible(el) && !(el.tagName === "INPUT" && el.closest("label"))) continue;
    let target: Element = el;
    // Visually hidden native inputs (custom radios, checkboxes, file pickers): their label is the target.
    if (el.tagName === "INPUT" && (srOnly(el) || Number(getComputedStyle(el).opacity) === 0)) {
      const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      if (!label || !visible(label)) continue;
      target = label;
    } else if (srOnly(el)) continue;
    // A <label> around a control, or a link nested in a bigger link/button, is covered by its parent.
    if (target === el && el.parentElement?.closest("a[href], button, [role=button], label") && el.tagName !== "LABEL") {
      const p = el.parentElement.closest("a[href], button, [role=button], label")!;
      const pr = p.getBoundingClientRect();
      if (pr.width >= MIN && pr.height >= MIN) continue;
    }
    if (inlineProseLink(target)) continue;
    checked.targets++;
    const r = target.getBoundingClientRect();
    if (r.width >= MIN && r.height >= MIN) continue;
    const pseudo = [pseudoBox(target, r, "::before"), pseudoBox(target, r, "::after")].some((b) => b && Math.max(b.w, r.width) >= MIN && Math.max(b.h, r.height) >= MIN);
    if (pseudo) continue;
    // A parent that is itself the hit area: a tight wrapper (≤ 96 px each way, or a field row for a
    // text input) at least 44×44 that holds no other interactive element.
    let parentOk = false;
    for (let p = target.parentElement, i = 0; p && i < 2 && !parentOk; p = p.parentElement, i++) {
      const pr = p.getBoundingClientRect();
      const others = [...p.querySelectorAll("a[href], button, [role=button], [role=tab], input, select, textarea")].filter((o) => o !== el && visible(o));
      const textField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      const tight = textField ? pr.height <= 96 : pr.width <= 96 && pr.height <= 96;
      const cursor = getComputedStyle(p).cursor === "pointer" || p.tagName === "LABEL" || textField;
      if (pr.width >= MIN && pr.height >= MIN && tight && cursor && (others.length === 0 || textField)) parentOk = true;
    }
    if (parentOk) continue;
    findings.push({ rule: "target", selector: selector(target), text: textOf(target), detail: `${Math.round(r.width)}×${Math.round(r.height)} px` });
  }

  return { findings, checked };
}
