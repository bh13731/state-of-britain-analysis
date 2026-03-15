(function() {
  "use strict";

  const LABEL_SELECTOR = "text.chart-annotation, text.chart-annotation-bold";
  const HALO_STYLE_ID = "annotation-layout-halo-style";
  const SHIFT_DATA_KEY = "annotationShiftY";
  const BASE_TRANSFORM_KEY = "annotationBaseTransform";

  function injectHaloStyle() {
    if (document.getElementById(HALO_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HALO_STYLE_ID;
    style.textContent = [
      "text.chart-annotation, text.chart-annotation-bold {",
      "  paint-order: stroke;",
      "  stroke: rgba(255,255,255,0.9);",
      "  stroke-width: 3px;",
      "  stroke-linejoin: round;",
      "}",
      "@media (max-width: 900px) {",
      "  text.chart-annotation { font-size: 11px; }",
      "  text.chart-annotation-bold { font-size: 12px; }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function rectFromDomRect(r) {
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }

  function inflateRect(r, p) {
    return { left: r.left - p, top: r.top - p, right: r.right + p, bottom: r.bottom + p };
  }

  function intersects(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (+cs.opacity <= 0.02) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  }

  function hasRenderablePaint(el) {
    const cs = window.getComputedStyle(el);
    const hasFill = cs.fill && cs.fill !== "none" && +cs.fillOpacity !== 0;
    const hasStroke = cs.stroke && cs.stroke !== "none" && +cs.strokeOpacity !== 0 && parseFloat(cs.strokeWidth || "0") > 0;
    return hasFill || hasStroke;
  }

  function shouldIgnoreObstacle(el) {
    const cls = (el.getAttribute("class") || "").toLowerCase();
    if (/(axis|tick|grid|domain|hover|guide|overlay|brush|tooltip|annotation)/.test(cls)) return true;
    if (el.closest(".axis, .grid")) return true;
    return false;
  }

  function applyShift(label, shift) {
    if (!Object.prototype.hasOwnProperty.call(label.dataset, BASE_TRANSFORM_KEY)) {
      label.dataset[BASE_TRANSFORM_KEY] = label.getAttribute("transform") || "";
    }
    const base = label.dataset[BASE_TRANSFORM_KEY];
    const y = shift || 0;
    label.dataset[SHIFT_DATA_KEY] = String(y);
    if (y === 0) {
      if (base) label.setAttribute("transform", base);
      else label.removeAttribute("transform");
      return;
    }
    const suffix = "translate(0," + y + ")";
    label.setAttribute("transform", base ? (base + " " + suffix) : suffix);
  }

  function collectObstacles(svg, labelsSet) {
    const out = [];
    const nodes = svg.querySelectorAll("path, rect, circle, ellipse, line, polygon, polyline");
    nodes.forEach(node => {
      if (!visible(node) || shouldIgnoreObstacle(node)) return;
      if (labelsSet && labelsSet.has(node)) return;
      if (!hasRenderablePaint(node)) return;
      const r = node.getBoundingClientRect();
      out.push(inflateRect(rectFromDomRect(r), 2));
    });
    return out;
  }

  function scoreRect(rect, obstacles, placed) {
    let score = 0;
    for (const r of obstacles) {
      if (intersects(rect, r)) score += 8;
    }
    for (const r of placed) {
      if (intersects(rect, r)) score += 25;
    }
    return score;
  }

  function layoutSvg(svg) {
    const labels = Array.from(svg.querySelectorAll(LABEL_SELECTOR)).filter(visible);
    if (!labels.length) return;

    labels.forEach(label => applyShift(label, 0));

    const labelsSet = new Set(labels);
    const obstacles = collectObstacles(svg, labelsSet);
    const svgRect = svg.getBoundingClientRect();

    labels.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });

    const placed = [];
    const candidates = [0, -8, 8, -16, 16, -24, 24, -32, 32, -40, 40, -52, 52, -64, 64];

    labels.forEach(label => {
      let bestShift = 0;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestRect = null;

      for (const shift of candidates) {
        applyShift(label, shift);
        const rect = inflateRect(rectFromDomRect(label.getBoundingClientRect()), 2);
        let score = scoreRect(rect, obstacles, placed) + Math.abs(shift) * 0.08;

        if (rect.top < svgRect.top - 6) score += 50;
        if (rect.bottom > svgRect.bottom + 6) score += 50;
        if (rect.left < svgRect.left - 6) score += 50;
        if (rect.right > svgRect.right + 6) score += 50;

        if (score < bestScore) {
          bestScore = score;
          bestShift = shift;
          bestRect = rect;
          if (score === 0) break;
        }
      }

      applyShift(label, bestShift);
      if (bestRect) placed.push(bestRect);
    });
  }

  let rafToken = 0;
  function scheduleLayout() {
    if (rafToken) return;
    rafToken = window.requestAnimationFrame(() => {
      rafToken = 0;
      document.querySelectorAll("svg").forEach(layoutSvg);
    });
  }

  function setupObservers() {
    const mo = new MutationObserver(scheduleLayout);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["transform", "style", "class", "opacity", "d", "x", "y", "cx", "cy"] });
    window.addEventListener("resize", scheduleLayout, { passive: true });
    window.addEventListener("load", scheduleLayout, { passive: true });
    setTimeout(scheduleLayout, 120);
    setTimeout(scheduleLayout, 500);
    setTimeout(scheduleLayout, 1200);
  }

  function init() {
    injectHaloStyle();
    scheduleLayout();
    setupObservers();
  }

  window.AnnotationLayout = { init: init, relayout: scheduleLayout };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
