// @ts-check
/**
 * @file debt.js — National debt, debt interest, quantitative easing, gilt yields
 * @description Interactive D3.js scrollytelling charts for the debt story.
 * Depends on shared/utils.js being loaded first.
 */
(function() {
"use strict";

sobInstallErrorHandler();
if (!sobCheckD3()) return;

/* =========================================================
   COLOURS & CONSTANTS
   ========================================================= */
const C = SOB_COLORS;
const DURATION = 350;
const MOBILE = SOB_MOBILE;


/* =========================================================
   HELPERS
   ========================================================= */
function truncLabel(s, max) { return s.length > max ? s.slice(0, max - 1) + "\u2026" : s; }

/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
/** @type {Object} API response data */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/spending.json")
  .then(d => { DATA = sobUnwrapApiResponse(d); init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big number
  const latest = DATA.aggregates.find(a => a.fy === "2024-25");
  document.getElementById("bn-interest").textContent = "\u00a3" + Math.round(latest.debtInterest) + "bn";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-scale svg, #chart-cause svg, #chart-qe svg, #chart-outlook svg").remove();
  buildAllCharts();
  document.querySelectorAll(".step-inner.active").forEach(el => {
    const step = el.closest(".step");
    updateChart(step.dataset.section, +step.dataset.step);
  });
}

/* =========================================================
   BUILD ALL CHARTS
   ========================================================= */
function buildAllCharts() {
  buildScaleChart();
  buildCauseChart();
  buildQEChart();
  buildOutlookChart();
}

/* =========================================================
   CHART 1: THE SCALE (Slides 1 & 2)
   Slide 1: Big number callout with comparison bars
   Slide 2: Debt interest line over time from 1978
   ========================================================= */
function buildScaleChart() {
  const container = document.getElementById("chart-scale");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart comparing UK debt interest spending to other government departments, and showing debt interest over time from 1978");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const agg = DATA.aggregates;
  const latest = agg.find(a => a.fy === "2024-25");

  // --- STEP 0: Comparison bars ---
  const barGroup = g.append("g").attr("class", "bar-view");

  const comparisons = [
    { label: "Debt interest", value: latest.debtInterest, color: C.crimson },
    { label: "Defence", value: 71.5, color: "#B0B0A8" },
    { label: "Transport", value: 30.5, color: "#B0B0A8" },
    { label: "Home Office", value: 22.5, color: "#B0B0A8" },
    { label: "Justice", value: 13.6, color: "#B0B0A8" }
  ];

  const yBar = d3.scaleBand().domain(comparisons.map(d => d.label)).range([0, dim.innerH]).padding(0.3);
  const xBar = d3.scaleLinear().domain([0, 120]).range([0, dim.innerW]);

  barGroup.append("g").attr("class", "grid")
    .call(d3.axisBottom(xBar).ticks(5).tickSize(dim.innerH).tickFormat(""))
    .attr("transform", "translate(0,0)")
    .call(g => g.select(".domain").remove())
    .selectAll("line").attr("stroke", C.grid);

  barGroup.selectAll(".comp-bar")
    .data(comparisons).enter().append("rect")
    .attr("x", 0).attr("y", d => yBar(d.label))
    .attr("width", d => xBar(d.value)).attr("height", yBar.bandwidth())
    .attr("fill", d => d.color).attr("rx", 1)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.label}</div><div class="tt-value">${sobFmtBnShort(d.value)} per year</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  const mobile = sobIsMobile();
  barGroup.selectAll(".comp-label")
    .data(comparisons).enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", -8).attr("y", d => yBar(d.label) + yBar.bandwidth() / 2 + 5)
    .attr("text-anchor", "end")
    .attr("fill", d => d.color === C.crimson ? C.crimson : C.muted)
    .attr("font-weight", d => d.color === C.crimson ? 700 : 500)
    .text(d => mobile ? truncLabel(d.label, 10) : d.label);

  barGroup.selectAll(".comp-value")
    .data(comparisons).enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", d => xBar(d.value) + 10).attr("y", d => yBar(d.label) + yBar.bandwidth() / 2 + 5)
    .attr("fill", d => d.color === C.crimson ? C.crimson : C.muted)
    .attr("font-weight", d => d.color === C.crimson ? 700 : 400)
    .text(d => sobFmtBnShort(d.value));

  // Combined total annotation
  const combinedTotal = 30.5 + 22.5 + 13.6;
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", dim.innerH + 30)
    .attr("text-anchor", "end")
    .attr("fill", C.muted)
    .text("Transport + Home Office + Justice = " + sobFmtBnShort(combinedTotal));

  // --- STEP 1: Debt interest line chart over time ---
  const lineGroup = g.append("g").attr("class", "line-view").style("opacity", 0);

  const historic = agg.filter(d => !d.forecast);
  const forecast = agg.filter(d => d.forecast);
  const lastHistoric = historic[historic.length - 1];
  const forecastBridge = [lastHistoric, ...forecast];

  const xLine = d3.scaleLinear().domain([1978, 2030]).range([0, dim.innerW]);
  const yLine = d3.scaleLinear().domain([0, d3.max(agg, d => d.debtInterest) * 1.12]).range([dim.innerH, 0]);

  // Grid
  lineGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yLine).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Y axis — units on first tick only (Tufte: maximise data-ink ratio)
  lineGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yLine).ticks(6).tickFormat((d, i) => i === 0 ? "\u00a3" + d + "bn" : d).tickSize(0))
    .call(g => g.select(".domain").remove());
  // Horizontal axis label above y-axis (Wilke: never rotate)
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14).attr("text-anchor", "start").attr("fill", C.muted)
    .text("Annual debt interest, \u00a3bn");

  // X axis
  lineGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Shaded area under line
  const areaGen = d3.area()
    .x(d => xLine(d.year)).y0(dim.innerH).y1(d => yLine(d.debtInterest))
    .curve(d3.curveMonotoneX);
  lineGroup.append("path").datum(historic)
    .attr("d", areaGen).attr("fill", C.crimsonLight).attr("stroke", "none");

  // Historic line
  const lineGen = d3.line().x(d => xLine(d.year)).y(d => yLine(d.debtInterest)).curve(d3.curveMonotoneX);
  lineGroup.append("path").datum(historic)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5);

  // Forecast line (dashed)
  lineGroup.append("path").datum(forecastBridge)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Annotation: inflection point — offset into white space with leader line (Cleveland/Knaflic)
  const yr2020 = agg.find(a => a.year === 2020);
  const annotX = xLine(2012);
  const annotY = Math.min(yLine(yr2020.debtInterest) - 70, 40);
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", annotX).attr("y", annotY)
    .attr("text-anchor", "middle").attr("fill", C.crimsonDark).attr("font-weight", 600)
    .text("Rates spike,");
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", annotX).attr("y", annotY + 15)
    .attr("text-anchor", "middle").attr("fill", C.crimsonDark)
    .text("bill triples");
  // Leader line from annotation to data point
  lineGroup.append("line")
    .attr("x1", annotX + 30).attr("x2", xLine(2020) - 6)
    .attr("y1", annotY + 18).attr("y2", yLine(yr2020.debtInterest) - 6)
    .attr("stroke", C.crimsonDark).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  // Data point marker
  lineGroup.append("circle")
    .attr("cx", xLine(2020)).attr("cy", yLine(yr2020.debtInterest))
    .attr("r", 3).attr("fill", C.crimsonDark);

  // Label at end — 10px padding from data point (Cleveland: 8px+ padding)
  const lastForecast = forecast[forecast.length - 1];
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastForecast.year) + 10).attr("y", yLine(lastForecast.debtInterest) + 4)
    .attr("fill", C.crimson).text(sobFmtBnShort(lastForecast.debtInterest));

  // Forecast label
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2027)).attr("y", 12)
    .attr("text-anchor", "middle").attr("fill", C.muted).text("Forecast \u2192");

  // Annotation: 1978 level — offset with leader line (Cleveland: 8px+ padding)
  const yr1978 = agg.find(a => a.year === 1978);
  const yr1978AnnotY = yLine(yr1978.debtInterest) + 30;
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(1982)).attr("y", yr1978AnnotY)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("\u00a36bn in 1978");
  lineGroup.append("line")
    .attr("x1", xLine(1980)).attr("x2", xLine(1978) + 4)
    .attr("y1", yr1978AnnotY - 12).attr("y2", yLine(yr1978.debtInterest) + 6)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Hover overlay
  const hoverRect = lineGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = lineGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  const hoverDot = lineGroup.append("circle").attr("r", 4).attr("fill", C.crimson).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = agg.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDot.attr("cx", xLine(year)).attr("cy", yLine(d.debtInterest)).style("opacity", 1);
    const spendShare = d.tme ? d3.format(".1f")(d.debtInterest / d.tme * 100) + "% of total spending" : "";
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value" style="color:${C.crimson}">Debt interest: ${sobFmtBnShort(d.debtInterest)}</div>
      ${spendShare ? '<div class="tt-value">' + spendShare + '</div>' : ""}`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0);
    sobHideTooltip();
  });
}

function updateScaleChart(step) {
  const svg = d3.select("#chart-scale svg");
  if (step === 0) {
    svg.select(".bar-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".bar-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 2: HOW WE GOT HERE (Slides 3 & 4)
   Slide 3: Debt as % of GDP
   Slide 4: Debt vs debt interest indexed (dual axis)
   ========================================================= */
function buildCauseChart() {
  const container = document.getElementById("chart-cause");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing UK debt as percentage of GDP and the decoupling of debt stock from debt interest costs");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const pctGDP = DATA.pctGDP;
  const agg = DATA.aggregates;
  const historicPct = pctGDP.filter(d => !d.forecast);
  const forecastPct = pctGDP.filter(d => d.forecast);
  const lastHistPct = historicPct[historicPct.length - 1];
  const forecastBridgePct = [lastHistPct, ...forecastPct];

  const xLine = d3.scaleLinear().domain([1978, 2030]).range([0, dim.innerW]);

  // --- STEP 0: Debt as % GDP ---
  const debtView = g.append("g").attr("class", "debt-pct-view");

  const yDebt = d3.scaleLinear().domain([0, 110]).range([dim.innerH, 0]);

  debtView.append("g").attr("class", "grid")
    .call(d3.axisLeft(yDebt).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  debtView.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yDebt).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());
  // Horizontal axis label above y-axis (Wilke: never rotate)
  debtView.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14).attr("text-anchor", "start").attr("fill", C.muted)
    .text("Public sector net debt, % of GDP");

  debtView.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Shaded area
  const areaDebt = d3.area()
    .x(d => xLine(d.year)).y0(dim.innerH).y1(d => yDebt(d.debt))
    .curve(d3.curveMonotoneX);
  debtView.append("path").datum(historicPct)
    .attr("d", areaDebt).attr("fill", C.amberLight).attr("stroke", "none");

  // Historic line
  const lineDebt = d3.line().x(d => xLine(d.year)).y(d => yDebt(d.debt)).curve(d3.curveMonotoneX);
  debtView.append("path").datum(historicPct)
    .attr("d", lineDebt).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5);

  // Forecast line
  debtView.append("path").datum(forecastBridgePct)
    .attr("d", lineDebt).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Crisis annotations
  const crises = [
    { year: 1990, label: "ERM crisis", yOff: -30 },
    { year: 2008, label: "Bank bailouts", yOff: -50 },
    { year: 2020, label: "COVID borrowing", yOff: -30 }
  ];
  crises.forEach(c => {
    const d = pctGDP.find(a => a.year === c.year);
    if (!d) return;
    debtView.append("line")
      .attr("x1", xLine(c.year)).attr("x2", xLine(c.year))
      .attr("y1", yDebt(d.debt) + c.yOff + 14).attr("y2", yDebt(d.debt) - 4)
      .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
    debtView.append("text").attr("class", "chart-annotation")
      .attr("x", xLine(c.year)).attr("y", yDebt(d.debt) + c.yOff)
      .attr("text-anchor", "middle").attr("fill", C.amber).attr("font-weight", 600)
      .text(c.label);
  });

  // 1990 low point annotation — offset below with leader line (Cleveland)
  const d1990 = pctGDP.find(a => a.year === 1990);
  const annot1990Y = yDebt(d1990.debt) + 35;
  debtView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(1990)).attr("y", annot1990Y)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("22% in 1990");
  debtView.append("line")
    .attr("x1", xLine(1990)).attr("x2", xLine(1990))
    .attr("y1", annot1990Y - 13).attr("y2", yDebt(d1990.debt) + 6)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // End label
  const lastPctF = forecastPct[forecastPct.length - 1];
  debtView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastPctF.year) + 10).attr("y", yDebt(lastPctF.debt) + 4)
    .attr("fill", C.amber).text(sobFmtPct(lastPctF.debt));

  debtView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2027)).attr("y", 12)
    .attr("text-anchor", "middle").attr("fill", C.muted).text("Forecast \u2192");

  // Hover
  const hoverRect0 = debtView.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine0 = debtView.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  const hoverDot0 = debtView.append("circle").attr("r", 4).attr("fill", C.amber).style("opacity", 0);

  hoverRect0.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = pctGDP.find(a => a.year === year);
    if (!d) return;
    hoverLine0.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDot0.attr("cx", xLine(year)).attr("cy", yDebt(d.debt)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value" style="color:${C.amber}">Debt: ${sobFmtPct(d.debt)} of GDP</div>`, event);
  }).on("mouseleave", function() {
    hoverLine0.style("opacity", 0); hoverDot0.style("opacity", 0); sobHideTooltip();
  });

  // --- STEP 1: Dual axis — debt stock (left, amber) vs debt interest (right, crimson) ---
  const dualView = g.append("g").attr("class", "dual-view").style("opacity", 0);

  const yDebtStock = d3.scaleLinear().domain([0, d3.max(agg, d => d.debt) * 1.08]).range([dim.innerH, 0]);
  const yInterest = d3.scaleLinear().domain([0, d3.max(agg, d => d.debtInterest) * 1.12]).range([dim.innerH, 0]);

  const historicAgg = agg.filter(d => !d.forecast);
  const forecastAgg = agg.filter(d => d.forecast);
  const lastHistAgg = historicAgg[historicAgg.length - 1];
  const forecastBridgeAgg = [lastHistAgg, ...forecastAgg];

  // Grid
  dualView.append("g").attr("class", "grid")
    .call(d3.axisLeft(yDebtStock).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Left axis (debt stock) — units on first tick only (Tufte)
  dualView.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yDebtStock).ticks(6).tickFormat((d, i) => i === 0 ? "\u00a3" + d3.format(",")(d) + "bn" : d3.format(",")(d)).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", C.amber);
  // Horizontal label above left axis (Wilke)
  dualView.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14).attr("text-anchor", "start").attr("fill", C.amber)
    .text("Debt stock, \u00a3bn");

  // Right axis (debt interest) — units on first tick only (Tufte)
  dualView.append("g").attr("class", "axis y-axis-right")
    .attr("transform", `translate(${dim.innerW},0)`)
    .call(d3.axisRight(yInterest).ticks(6).tickFormat((d, i) => i === 0 ? "\u00a3" + d + "bn" : d).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", C.crimson);
  // Horizontal label above right axis (Wilke)
  dualView.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", -14).attr("text-anchor", "end").attr("fill", C.crimson)
    .text("Debt interest, \u00a3bn");

  // X axis
  dualView.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Debt stock line
  const lineDebtStock = d3.line().x(d => xLine(d.year)).y(d => yDebtStock(d.debt)).curve(d3.curveMonotoneX);
  dualView.append("path").datum(historicAgg)
    .attr("d", lineDebtStock).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5);
  dualView.append("path").datum(forecastBridgeAgg)
    .attr("d", lineDebtStock).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Debt interest line
  const lineInterest = d3.line().x(d => xLine(d.year)).y(d => yInterest(d.debtInterest)).curve(d3.curveMonotoneX);
  dualView.append("path").datum(historicAgg)
    .attr("d", lineInterest).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5);
  dualView.append("path").datum(forecastBridgeAgg)
    .attr("d", lineInterest).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Direct labels — 10px padding from data (Cleveland: 8px+ minimum)
  const lastFA = forecastAgg[forecastAgg.length - 1];
  dualView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastFA.year) + 10).attr("y", yDebtStock(lastFA.debt) - 10)
    .attr("fill", C.amber).text("Debt stock");
  dualView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastFA.year) + 10).attr("y", yInterest(lastFA.debtInterest) + 18)
    .attr("fill", C.crimson).text("Interest");

  // "Free money era" annotation
  dualView.append("rect")
    .attr("x", xLine(2008)).attr("y", 0)
    .attr("width", xLine(2020) - xLine(2008)).attr("height", dim.innerH)
    .attr("fill", "rgba(153,27,27,0.04)").attr("stroke", "none");
  dualView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2014)).attr("y", 20)
    .attr("text-anchor", "middle").attr("fill", C.crimsonDark).attr("font-weight", 600)
    .text("\"Free money\" era");
  dualView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2014)).attr("y", 35)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("Near-zero rates masked the risk");

  // Forecast label
  dualView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2027)).attr("y", dim.innerH - 10)
    .attr("text-anchor", "middle").attr("fill", C.muted).text("Forecast \u2192");

  // Dual-axis caveat (Few/Tufte: dual axes can mislead)
  dualView.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", dim.innerH + 32)
    .attr("text-anchor", "end").attr("fill", C.muted).attr("font-size", "11px")
    .text("Caution: two independent scales. Compare trends, not levels.");

  // Hover
  const hoverRect1 = dualView.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine1 = dualView.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  const hoverDotD = dualView.append("circle").attr("r", 4).attr("fill", C.amber).style("opacity", 0);
  const hoverDotI = dualView.append("circle").attr("r", 4).attr("fill", C.crimson).style("opacity", 0);

  hoverRect1.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = agg.find(a => a.year === year);
    if (!d) return;
    hoverLine1.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDotD.attr("cx", xLine(year)).attr("cy", yDebtStock(d.debt)).style("opacity", 1);
    hoverDotI.attr("cx", xLine(year)).attr("cy", yInterest(d.debtInterest)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value" style="color:${C.amber}">Debt: ${sobFmtBnShort(d.debt)}</div>
      <div class="tt-value" style="color:${C.crimson}">Interest: ${sobFmtBnShort(d.debtInterest)}</div>
      <div class="tt-value">Effective rate: ${d3.format(".2f")(d.debtInterest / d.debt * 100)}%</div>`, event);
  }).on("mouseleave", function() {
    hoverLine1.style("opacity", 0); hoverDotD.style("opacity", 0); hoverDotI.style("opacity", 0);
    sobHideTooltip();
  });
}

function updateCauseChart(step) {
  const svg = d3.select("#chart-cause svg");
  if (step === 0) {
    svg.select(".debt-pct-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".dual-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".debt-pct-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".dual-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 3: THE QE BILL (Slides 5 & 6)
   Slide 5: APF indemnity over time (bar chart)
   Slide 6: Comparison — APF losses vs department budgets
   ========================================================= */
function buildQEChart() {
  const container = document.getElementById("chart-qe");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing Bank of England Asset Purchase Facility indemnity payments to taxpayers and comparison with department budgets");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // APF indemnity data (from HM Treasury breakdown)
  const apfData = [
    { fy: "2020-21", year: 2020, value: 33.3 },
    { fy: "2021-22", year: 2021, value: 47.8 },
    { fy: "2022-23", year: 2022, value: 135.2 },
    { fy: "2023-24", year: 2023, value: 84.3 },
    { fy: "2024-25", year: 2024, value: 71.0 }
  ];
  const totalAPF = apfData.reduce((s, d) => s + d.value, 0);

  // --- STEP 0: APF indemnity bar chart over time ---
  const apfView = g.append("g").attr("class", "apf-view");

  const xAPF = d3.scaleBand().domain(apfData.map(d => d.fy)).range([0, dim.innerW]).padding(0.3);
  const yAPF = d3.scaleLinear().domain([0, 150]).range([dim.innerH, 0]);

  apfView.append("g").attr("class", "grid")
    .call(d3.axisLeft(yAPF).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  apfView.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yAPF).ticks(6).tickFormat((d, i) => i === 0 ? "\u00a3" + d + "bn" : d).tickSize(0))
    .call(g => g.select(".domain").remove());

  apfView.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xAPF).tickSize(0))
    .call(g => g.select(".domain").remove());

  apfView.selectAll(".apf-bar")
    .data(apfData).enter().append("rect")
    .attr("x", d => xAPF(d.fy)).attr("y", d => yAPF(d.value))
    .attr("width", xAPF.bandwidth()).attr("height", d => dim.innerH - yAPF(d.value))
    .attr("fill", C.blue).attr("rx", 1)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.fy}</div>
        <div class="tt-value" style="color:${C.blue}">APF indemnity: ${sobFmtBnShort(d.value)}</div>
        <div class="tt-value">Taxpayer cost of QE losses</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Value labels on bars
  apfView.selectAll(".apf-label")
    .data(apfData).enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", d => xAPF(d.fy) + xAPF.bandwidth() / 2)
    .attr("y", d => yAPF(d.value) - 8)
    .attr("text-anchor", "middle").attr("fill", C.blue)
    .text(d => sobFmtBnShort(d.value));

  // Peak annotation — offset into white space with leader line (Cleveland/Knaflic)
  const peakBarX = xAPF("2022-23") + xAPF.bandwidth() / 2;
  const peakBarY = yAPF(135.2);
  const peakAnnotY = peakBarY - 50;
  apfView.append("text").attr("class", "chart-annotation")
    .attr("x", peakBarX)
    .attr("y", peakAnnotY)
    .attr("text-anchor", "middle").attr("fill", C.blue).attr("font-weight", 600)
    .text("Rate rises make every bond a loss");
  // Leader line from annotation to bar top
  apfView.append("line")
    .attr("x1", peakBarX).attr("x2", peakBarX)
    .attr("y1", peakAnnotY + 4).attr("y2", peakBarY - 10)
    .attr("stroke", C.blue).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Total annotation
  apfView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", dim.innerW).attr("y", dim.innerH + 32)
    .attr("text-anchor", "end").attr("fill", C.blue)
    .text("Cumulative total: " + sobFmtBnShort(totalAPF));

  // Title
  apfView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", 0).attr("y", -10).attr("fill", C.blue)
    .text("BoE APF indemnity payments");

  // --- STEP 1: Comparison — APF total vs department budgets ---
  const compView = g.append("g").attr("class", "comp-view").style("opacity", 0);

  // Department spending data (from API, 2024-25 values in £bn)
  const deptComparisons = [
    { label: "APF losses (5 yrs, 2020-25)", value: totalAPF, color: C.blue, bold: true },
    { label: "Work & Pensions (1 yr)", value: 297.5, color: "#B0B0A8", bold: false },
    { label: "Health & Social Care (1 yr)", value: 223.2, color: "#B0B0A8", bold: false },
    { label: "Education (1 yr)", value: 132.9, color: "#B0B0A8", bold: false },
    { label: "Defence (1 yr)", value: 71.5, color: "#B0B0A8", bold: false },
    { label: "Transport (1 yr)", value: 30.5, color: "#B0B0A8", bold: false },
    { label: "Home Office (1 yr)", value: 22.5, color: "#B0B0A8", bold: false },
    { label: "Justice (1 yr)", value: 13.6, color: "#B0B0A8", bold: false }
  ];

  const yComp = d3.scaleBand().domain(deptComparisons.map(d => d.label)).range([0, dim.innerH]).padding(0.25);
  const xComp = d3.scaleLinear().domain([0, 400]).range([0, dim.innerW]);

  compView.append("g").attr("class", "grid")
    .call(d3.axisBottom(xComp).ticks(5).tickSize(dim.innerH).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .selectAll("line").attr("stroke", C.grid);

  compView.selectAll(".dept-bar")
    .data(deptComparisons).enter().append("rect")
    .attr("x", 0).attr("y", d => yComp(d.label))
    .attr("width", d => xComp(d.value)).attr("height", yComp.bandwidth())
    .attr("fill", d => d.color).attr("rx", 1)
    .attr("opacity", d => d.bold ? 1 : 0.7)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.label}</div>
        <div class="tt-value">${sobFmtBnShort(d.value)}${d.bold ? " (2020-2025)" : " (2024-25 annual)"}</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  const mobileQE = sobIsMobile();
  compView.selectAll(".dept-label")
    .data(deptComparisons).enter().append("text")
    .attr("class", d => d.bold ? "chart-annotation-bold" : "chart-annotation")
    .attr("x", -8).attr("y", d => yComp(d.label) + yComp.bandwidth() / 2 + 5)
    .attr("text-anchor", "end")
    .attr("fill", d => d.bold ? C.blue : C.muted)
    .attr("font-weight", d => d.bold ? 700 : 400)
    .text(d => mobileQE ? truncLabel(d.label, 12) : d.label);

  compView.selectAll(".dept-value")
    .data(deptComparisons).enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", d => xComp(d.value) + 10)
    .attr("y", d => yComp(d.label) + yComp.bandwidth() / 2 + 5)
    .attr("fill", d => d.bold ? C.blue : C.muted)
    .attr("font-weight", d => d.bold ? 700 : 400)
    .text(d => sobFmtBnShort(d.value));

  // Methodological caveat -- prominent, not buried (Tufte: honest scales)
  compView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", 0).attr("y", dim.innerH + 28)
    .attr("fill", C.crimson).attr("font-size", "13px")
    .text("Note: APF figure is cumulative (5 yrs). Department figures are single-year.");

  // Title
  compView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", 0).attr("y", -10).attr("fill", C.blue)
    .text("APF indemnity payments vs annual department spending");
}

function updateQEChart(step) {
  const svg = d3.select("#chart-qe svg");
  if (step === 0) {
    svg.select(".apf-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".comp-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".apf-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".comp-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 4: THE OUTLOOK (Slides 7 & 8)
   Slide 7: Debt interest forecast to 2030
   Slide 8: Debt interest as % of receipts over time
   ========================================================= */
function buildOutlookChart() {
  const container = document.getElementById("chart-outlook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing OBR forecast for UK debt interest to 2030 and debt interest as share of tax receipts");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const agg = DATA.aggregates;
  const xLine = d3.scaleLinear().domain([1978, 2030]).range([0, dim.innerW]);

  const historic = agg.filter(d => !d.forecast);
  const forecast = agg.filter(d => d.forecast);
  const lastHist = historic[historic.length - 1];
  const forecastBridge = [lastHist, ...forecast];

  // --- STEP 0: Debt interest forecast with area ---
  const forecastView = g.append("g").attr("class", "forecast-view");

  const yInterest = d3.scaleLinear().domain([0, d3.max(agg, d => d.debtInterest) * 1.15]).range([dim.innerH, 0]);

  forecastView.append("g").attr("class", "grid")
    .call(d3.axisLeft(yInterest).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  forecastView.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yInterest).ticks(6).tickFormat((d, i) => i === 0 ? "\u00a3" + d + "bn" : d).tickSize(0))
    .call(g => g.select(".domain").remove());
  // Horizontal axis label above y-axis (Wilke)
  forecastView.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14).attr("text-anchor", "start").attr("fill", C.muted)
    .text("Annual debt interest, \u00a3bn");

  forecastView.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Area — historic
  const areaInterest = d3.area()
    .x(d => xLine(d.year)).y0(dim.innerH).y1(d => yInterest(d.debtInterest))
    .curve(d3.curveMonotoneX);
  forecastView.append("path").datum(historic)
    .attr("d", areaInterest).attr("fill", C.crimsonLight).attr("stroke", "none");

  // Area — forecast (lighter)
  forecastView.append("path").datum(forecastBridge)
    .attr("d", areaInterest).attr("fill", "rgba(153,27,27,0.06)").attr("stroke", "none");

  // Lines
  const lineInterest = d3.line().x(d => xLine(d.year)).y(d => yInterest(d.debtInterest)).curve(d3.curveMonotoneX);
  forecastView.append("path").datum(historic)
    .attr("d", lineInterest).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5);
  forecastView.append("path").datum(forecastBridge)
    .attr("d", lineInterest).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Annotations for key years
  const yr2030 = forecast[forecast.length - 1];
  forecastView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(yr2030.year) + 10).attr("y", yInterest(yr2030.debtInterest) + 4)
    .attr("fill", C.crimson).text(sobFmtBnShort(yr2030.debtInterest));

  // "Doesn't come down" annotation
  forecastView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2027)).attr("y", yInterest(130) - 20)
    .attr("text-anchor", "middle").attr("fill", C.crimsonDark).attr("font-weight", 600)
    .text("Cheap gilts maturing,");
  forecastView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2027)).attr("y", yInterest(130) - 5)
    .attr("text-anchor", "middle").attr("fill", C.crimsonDark)
    .text("replaced at 4-5% yields");

  // Forecast divider
  forecastView.append("line")
    .attr("x1", xLine(lastHist.year)).attr("x2", xLine(lastHist.year))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.faint).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  forecastView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(lastHist.year) + 6).attr("y", 16)
    .attr("fill", C.muted).text("Forecast \u2192");

  // Hover
  const hoverRect2 = forecastView.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = forecastView.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  const hoverDot2 = forecastView.append("circle").attr("r", 4).attr("fill", C.crimson).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = agg.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDot2.attr("cx", xLine(year)).attr("cy", yInterest(d.debtInterest)).style("opacity", 1);
    const borrowingShare = d.debtInterest / d.tme * 100;
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value" style="color:${C.crimson}">Debt interest: ${sobFmtBnShort(d.debtInterest)}</div>
      <div class="tt-value">${d3.format(".1f")(borrowingShare)}% of total spending</div>`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot2.style("opacity", 0); sobHideTooltip();
  });

  // --- STEP 1: Debt interest as % of receipts ---
  const pctView = g.append("g").attr("class", "pct-receipts-view").style("opacity", 0);

  // Calculate interest as % of receipts
  const pctData = agg.map(d => ({
    year: d.year, fy: d.fy, forecast: d.forecast,
    pctReceipts: d.debtInterest / d.receipts * 100,
    pctSpending: d.debtInterest / d.tme * 100
  }));
  const historicPct = pctData.filter(d => !d.forecast);
  const forecastPct = pctData.filter(d => d.forecast);
  const lastHistPct = historicPct[historicPct.length - 1];
  const forecastBridgePct = [lastHistPct, ...forecastPct];

  const yPct = d3.scaleLinear().domain([0, 14]).range([dim.innerH, 0]);

  pctView.append("g").attr("class", "grid")
    .call(d3.axisLeft(yPct).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  pctView.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yPct).ticks(7).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());
  // Horizontal axis label above y-axis (Wilke)
  pctView.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14).attr("text-anchor", "start").attr("fill", C.muted)
    .text("Debt interest as % of tax receipts");

  pctView.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Area under % receipts
  const areaPctR = d3.area()
    .x(d => xLine(d.year)).y0(dim.innerH).y1(d => yPct(d.pctReceipts))
    .curve(d3.curveMonotoneX);
  pctView.append("path").datum(historicPct)
    .attr("d", areaPctR).attr("fill", C.crimsonLight).attr("stroke", "none");

  // % of receipts line
  const linePctR = d3.line().x(d => xLine(d.year)).y(d => yPct(d.pctReceipts)).curve(d3.curveMonotoneX);
  pctView.append("path").datum(historicPct)
    .attr("d", linePctR).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5);
  pctView.append("path").datum(forecastBridgePct)
    .attr("d", linePctR).attr("fill", "none").attr("stroke", C.crimson).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // % of spending line (secondary)
  const linePctS = d3.line().x(d => xLine(d.year)).y(d => yPct(d.pctSpending)).curve(d3.curveMonotoneX);
  pctView.append("path").datum(historicPct)
    .attr("d", linePctS).attr("fill", "none").attr("stroke", C.faint).attr("stroke-width", 1.5);
  pctView.append("path").datum(forecastBridgePct)
    .attr("d", linePctS).attr("fill", "none").attr("stroke", C.faint).attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6,4");

  // End labels
  // End labels — 10px padding from data (Cleveland: 8px+ minimum)
  const lastPF = forecastPct[forecastPct.length - 1];
  pctView.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastPF.year) + 10).attr("y", yPct(lastPF.pctReceipts) + 4)
    .attr("fill", C.crimson).text(d3.format(".1f")(lastPF.pctReceipts) + "%");
  pctView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(lastPF.year) + 10).attr("y", yPct(lastPF.pctReceipts) + 18)
    .attr("fill", C.crimson).text("of tax revenue");

  pctView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(lastPF.year) + 10).attr("y", yPct(lastPF.pctSpending) + 4)
    .attr("fill", C.faint)
    .text(d3.format(".1f")(lastPF.pctSpending) + "% of spending");

  // "10p in every pound" annotation
  pctView.append("line")
    .attr("x1", xLine(1978)).attr("x2", xLine(2030))
    .attr("y1", yPct(10)).attr("y2", yPct(10))
    .attr("stroke", C.crimson).attr("stroke-width", 1).attr("stroke-dasharray", "4,3").attr("opacity", 0.4);
  pctView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(1984)).attr("y", yPct(10) - 6)
    .attr("fill", C.crimson).attr("opacity", 0.6)
    .text("10p in every pound");

  // Forecast divider
  pctView.append("line")
    .attr("x1", xLine(lastHist.year)).attr("x2", xLine(lastHist.year))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.faint).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  pctView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(lastHist.year) + 6).attr("y", 16)
    .attr("fill", C.muted).text("Forecast \u2192");

  // Low point annotation — offset with leader line (Cleveland)
  const lowPoint = historicPct.reduce((min, d) => d.pctReceipts < min.pctReceipts ? d : min);
  const lowAnnotY = yPct(lowPoint.pctReceipts) + 32;
  pctView.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(lowPoint.year)).attr("y", lowAnnotY)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text(d3.format(".1f")(lowPoint.pctReceipts) + "% in " + lowPoint.year);
  pctView.append("line")
    .attr("x1", xLine(lowPoint.year)).attr("x2", xLine(lowPoint.year))
    .attr("y1", lowAnnotY - 13).attr("y2", yPct(lowPoint.pctReceipts) + 6)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Hover
  const hoverRect3 = pctView.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine3 = pctView.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  const hoverDot3 = pctView.append("circle").attr("r", 4).attr("fill", C.crimson).style("opacity", 0);
  const hoverDot3b = pctView.append("circle").attr("r", 3).attr("fill", C.crimsonDark).style("opacity", 0);

  hoverRect3.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = pctData.find(a => a.year === year);
    if (!d) return;
    hoverLine3.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDot3.attr("cx", xLine(year)).attr("cy", yPct(d.pctReceipts)).style("opacity", 1);
    hoverDot3b.attr("cx", xLine(year)).attr("cy", yPct(d.pctSpending)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value" style="color:${C.crimson}">${d3.format(".1f")(d.pctReceipts)}% of tax revenue</div>
      <div class="tt-value" style="color:${C.crimsonDark}">${d3.format(".1f")(d.pctSpending)}% of spending</div>`, event);
  }).on("mouseleave", function() {
    hoverLine3.style("opacity", 0); hoverDot3.style("opacity", 0); hoverDot3b.style("opacity", 0);
    sobHideTooltip();
  });
}

function updateOutlookChart(step) {
  const svg = d3.select("#chart-outlook svg");
  if (step === 0) {
    svg.select(".forecast-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".pct-receipts-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".forecast-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".pct-receipts-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART TRANSITIONS
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "scale": updateScaleChart(step); break;
    case "cause": updateCauseChart(step); break;
    case "qe": updateQEChart(step); break;
    case "outlook": updateOutlookChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING - IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("scale"); }

})();
