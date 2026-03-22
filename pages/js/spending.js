/**
 * @file spending.js — UK public finances — receipts vs expenditure, debt, spending composition, deficit outlook
 * @description Interactive D3.js scrollytelling charts for the spending story.
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
const DURATION = SOB_DURATION;
const MOBILE = SOB_MOBILE;



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/spending.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big numbers
  const latest = DATA.aggregates.find(a => a.fy === "2024-25");
  document.getElementById("bn-borrowing").textContent = "\u00a3" + Math.round(latest.borrowing) + "bn";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-gap svg, #chart-debt svg, #chart-composition svg, #chart-outlook svg").remove();
  buildAllCharts();
  // Reapply active states
  document.querySelectorAll(".step-inner.active").forEach(el => {
    const step = el.closest(".step");
    const sec = step.dataset.section;
    const idx = +step.dataset.step;
    updateChart(sec, idx);
  });
}

/* =========================================================
   BUILD ALL CHARTS (initial state)
   ========================================================= */
function buildAllCharts() {
  buildGapChart();
  buildDebtChart();
  buildCompositionChart();
  buildOutlookChart();
}

/* =========================================================
   CHART 1: THE GAP (Slides 1 & 2)
   ========================================================= */
function buildGapChart() {
  const container = document.getElementById("chart-gap");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`);
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // Data
  const agg = DATA.aggregates;
  const latest = agg.find(a => a.fy === "2024-25");

  // Scales for bar view (step 0)
  const xBar = d3.scaleBand().domain(["Receipts", "Expenditure"]).range([0, dim.innerW]).padding(0.4);
  const yBar = d3.scaleLinear().domain([0, 1400]).range([dim.innerH, 0]);

  // Scales for line view (step 1)
  const xLine = d3.scaleLinear().domain([1978, 2030]).range([0, dim.innerW]);
  const yLine = d3.scaleLinear().domain([0, d3.max(agg, d => Math.max(d.receipts, d.tme)) * 1.08]).range([dim.innerH, 0]);

  // Store on container for transitions
  container._scales = { xBar, yBar, xLine, yLine };
  container._dim = dim;
  container._g = g;
  container._svg = svg;

  // No standalone chart title needed — step text provides context

  // --- BAR VIEW (default, step 0) ---
  const barGroup = g.append("g").attr("class", "bar-view");

  // Y axis
  barGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yBar).ticks(6).tickFormat(d => d === 0 ? "0" : d).tickSize(0))
    .call(g => g.select(".domain").remove());
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -12).attr("text-anchor", "start").attr("fill", C.muted)
    .text("\u00a3bn");

  // Bars
  barGroup.append("rect")
    .attr("class", "bar-receipts")
    .attr("x", xBar("Receipts")).attr("y", yBar(latest.receipts))
    .attr("width", xBar.bandwidth()).attr("height", dim.innerH - yBar(latest.receipts))
    .attr("fill", C.green).attr("rx", 3);

  barGroup.append("rect")
    .attr("class", "bar-expenditure")
    .attr("x", xBar("Expenditure")).attr("y", yBar(latest.tme))
    .attr("width", xBar.bandwidth()).attr("height", dim.innerH - yBar(latest.tme))
    .attr("fill", C.red).attr("rx", 3);

  // Bar labels
  barGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xBar("Receipts") + xBar.bandwidth() / 2).attr("y", yBar(latest.receipts) - 10)
    .attr("text-anchor", "middle").text(sobFmtBnShort(latest.receipts));
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xBar("Receipts") + xBar.bandwidth() / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.green).attr("font-weight", 600).text("Receipts");

  barGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xBar("Expenditure") + xBar.bandwidth() / 2).attr("y", yBar(latest.tme) - 10)
    .attr("text-anchor", "middle").text(sobFmtBnShort(latest.tme));
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xBar("Expenditure") + xBar.bandwidth() / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.red).attr("font-weight", 600).text("Expenditure");

  // Gap annotation
  const gapY1 = yBar(latest.tme);
  const gapY2 = yBar(latest.receipts);
  const gapX = xBar("Expenditure") + xBar.bandwidth() + 16;
  barGroup.append("line").attr("x1", gapX).attr("x2", gapX)
    .attr("y1", gapY1).attr("y2", gapY2)
    .attr("stroke", C.red).attr("stroke-width", 2);
  barGroup.append("line").attr("x1", gapX - 6).attr("x2", gapX + 6)
    .attr("y1", gapY1).attr("y2", gapY1)
    .attr("stroke", C.red).attr("stroke-width", 2);
  barGroup.append("line").attr("x1", gapX - 6).attr("x2", gapX + 6)
    .attr("y1", gapY2).attr("y2", gapY2)
    .attr("stroke", C.red).attr("stroke-width", 2);
  barGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", gapX + 10).attr("y", (gapY1 + gapY2) / 2 + 5)
    .attr("fill", C.red).text("\u00a3" + Math.round(latest.borrowing) + "bn gap");

  // --- LINE VIEW (step 1, initially hidden) ---
  const lineGroup = g.append("g").attr("class", "line-view").style("opacity", 0).style("pointer-events", "none");

  // Separate historic and forecast data
  const historic = agg.filter(d => !d.forecast);
  const forecast = agg.filter(d => d.forecast);
  const lastHistoric = historic[historic.length - 1];
  const forecastWithBridge = [lastHistoric, ...forecast];

  // Shaded deficit area
  const deficitArea = d3.area()
    .x(d => xLine(d.year))
    .y0(d => yLine(d.receipts))
    .y1(d => yLine(d.tme))
    .curve(d3.curveMonotoneX);

  lineGroup.append("path")
    .datum(agg)
    .attr("d", deficitArea)
    .attr("fill", C.redLight).attr("stroke", "none");

  // Lines - receipts
  const lineGen = (field) => d3.line().x(d => xLine(d.year)).y(d => yLine(d[field])).curve(d3.curveMonotoneX);
  lineGroup.append("path").datum(historic)
    .attr("d", lineGen("receipts")).attr("fill", "none").attr("stroke", C.green).attr("stroke-width", 2.5);
  lineGroup.append("path").datum(forecastWithBridge)
    .attr("d", lineGen("receipts")).attr("fill", "none").attr("stroke", C.green).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Lines - expenditure
  lineGroup.append("path").datum(historic)
    .attr("d", lineGen("tme")).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);
  lineGroup.append("path").datum(forecastWithBridge)
    .attr("d", lineGen("tme")).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // X axis
  lineGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(sobIsMobile() ? 5 : 10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y axis
  lineGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yLine).ticks(6).tickFormat(d => d === 0 ? "0" : d).tickSize(0))
    .call(g => g.select(".domain").remove());
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -12).attr("text-anchor", "start").attr("fill", C.muted)
    .text("\u00a3bn");

  // Grid
  lineGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yLine).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Labels at end — enforce minimum 18px vertical separation to avoid overlap
  const lastAgg = agg[agg.length - 1];
  let ySpend = yLine(lastAgg.tme) + 4;
  let yRev = yLine(lastAgg.receipts) + 4;
  const minSep = 18;
  if (Math.abs(ySpend - yRev) < minSep) {
    const mid = (ySpend + yRev) / 2;
    ySpend = mid - minSep / 2;
    yRev = mid + minSep / 2;
  }
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastAgg.year) + 10).attr("y", ySpend)
    .attr("fill", C.red).text("Spending");
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(lastAgg.year) + 10).attr("y", yRev)
    .attr("fill", C.green).text("Revenue");

  // Surplus annotation
  const surplusX = xLine(1999);
  const surplusY = yLine(agg.find(a => a.year === 1999).receipts) - 20;
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", surplusX).attr("y", surplusY - 12)
    .attr("text-anchor", "middle").attr("fill", C.green)
    .text("Brief surplus");
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", surplusX).attr("y", surplusY + 2)
    .attr("text-anchor", "middle").attr("fill", C.green)
    .text("1999\u20132001");
  lineGroup.append("line")
    .attr("x1", surplusX).attr("x2", surplusX)
    .attr("y1", surplusY + 6).attr("y2", yLine(agg.find(a => a.year === 1999).receipts) - 4)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Forecast label
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2027)).attr("y", 12)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("Forecast \u2192");

  // Hover overlay for line view
  const hoverRect = lineGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = lineGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotR = lineGroup.append("circle").attr("r", 4).attr("fill", C.green).style("opacity", 0);
  const hoverDotE = lineGroup.append("circle").attr("r", 4).attr("fill", C.red).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = agg.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDotR.attr("cx", xLine(year)).attr("cy", yLine(d.receipts)).style("opacity", 1);
    hoverDotE.attr("cx", xLine(year)).attr("cy", yLine(d.tme)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value" style="color:${C.green}">Revenue: ${sobFmtBnShort(d.receipts)}</div>
      <div class="tt-value" style="color:${C.red}">Spending: ${sobFmtBnShort(d.tme)}</div>
      <div class="tt-value" style="color:${d.borrowing > 0 ? C.red : C.green}">${d.borrowing > 0 ? "Deficit" : "Surplus"}: ${sobFmtBnShort(Math.abs(d.borrowing))}</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDotR.style("opacity", 0); hoverDotE.style("opacity", 0);
    sobHideTooltip();
  });
}

function updateGapChart(step) {
  const container = document.getElementById("chart-gap");
  const svg = d3.select(container).select("svg");
  if (step === 0) {
    svg.select(".bar-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".bar-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 2: DEBT (Slides 3 & 4)
   ========================================================= */
function buildDebtChart() {
  const container = document.getElementById("chart-debt");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`);
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const pctGDP = DATA.pctGDP;
  const agg = DATA.aggregates;
  const historic = pctGDP.filter(d => !d.forecast);
  const forecast = pctGDP.filter(d => d.forecast);
  const lastHistoric = historic[historic.length - 1];
  const forecastWithBridge = [lastHistoric, ...forecast];

  // --- DEBT % GDP VIEW (step 0) ---
  const debtGroup = g.append("g").attr("class", "debt-pct-view");
  const x = d3.scaleLinear().domain([1978, 2030]).range([0, dim.innerW]);
  const yDebt = d3.scaleLinear().domain([0, 110]).range([dim.innerH, 0]);

  // Grid
  debtGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yDebt).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const debtArea = d3.area().x(d => x(d.year)).y0(dim.innerH).y1(d => yDebt(d.debt)).curve(d3.curveMonotoneX);
  debtGroup.append("path").datum(historic)
    .attr("d", debtArea).attr("fill", C.amberLight);
  debtGroup.append("path").datum(forecastWithBridge)
    .attr("d", debtArea).attr("fill", C.amberLight).style("opacity", 0.5);

  // Line
  const debtLine = d3.line().x(d => x(d.year)).y(d => yDebt(d.debt)).curve(d3.curveMonotoneX);
  debtGroup.append("path").datum(historic)
    .attr("d", debtLine).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5);
  debtGroup.append("path").datum(forecastWithBridge)
    .attr("d", debtLine).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Axes
  debtGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  debtGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yDebt).ticks(6).tickFormat(d => d === 0 ? "0" : d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());
  debtGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -12).attr("text-anchor", "start").attr("fill", C.muted)
    .text("% of GDP");

  // Annotations
  // Low point ~22% in 1990
  const low = pctGDP.find(d => d.year === 1990);
  debtGroup.append("circle").attr("cx", x(1990)).attr("cy", yDebt(low.debt)).attr("r", 4)
    .attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
  debtGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(1990) + 8).attr("y", yDebt(low.debt) + 4).attr("fill", C.amber)
    .text(sobFmtPct(low.debt) + " low");

  // Financial crisis
  debtGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2009)).attr("y", yDebt(64) - 30).attr("text-anchor", "middle").attr("fill", C.amber)
    .text("Financial crisis");
  debtGroup.append("line").attr("x1", x(2009)).attr("x2", x(2009))
    .attr("y1", yDebt(64) - 24).attr("y2", yDebt(64) - 4)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // COVID
  debtGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2020)).attr("y", yDebt(95) - 28).attr("text-anchor", "middle").attr("fill", C.amber)
    .text("COVID");
  debtGroup.append("line").attr("x1", x(2020)).attr("x2", x(2020))
    .attr("y1", yDebt(95) - 22).attr("y2", yDebt(95) - 4)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Current level
  const cur = pctGDP.find(d => d.year === 2024);
  debtGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2030) + 10).attr("y", yDebt(pctGDP[pctGDP.length - 1].debt) + 5).attr("fill", C.amber)
    .text(sobFmtPct(pctGDP[pctGDP.length - 1].debt));

  // Hover
  const hoverRect = debtGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = debtGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = debtGroup.append("circle").attr("r", 4).attr("fill", C.amber).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(x.invert(mx));
    const d = pctGDP.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot.attr("cx", x(year)).attr("cy", yDebt(d.debt)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value">Debt: ${sobFmtPct(d.debt)} of GDP</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // --- DEBT INTEREST VIEW (step 1, hidden) ---
  const intGroup = g.append("g").attr("class", "debt-int-view").style("opacity", 0).style("pointer-events", "none");
  const yInt = d3.scaleLinear().domain([0, d3.max(agg, d => d.debtInterest) * 1.18]).range([dim.innerH, 0]).nice();

  // Grid
  intGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yInt).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Defence reference line
  const defenceSpend = 71.5; // 2024-25 in £bn
  intGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yInt(defenceSpend)).attr("y2", yInt(defenceSpend))
    .attr("stroke", "#999990").attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  intGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", yInt(defenceSpend) - 8)
    .attr("text-anchor", "end").attr("fill", C.muted)
    .text("Defence budget \u00a372bn");

  // Area
  const intArea = d3.area().x(d => x(d.year)).y0(dim.innerH).y1(d => yInt(d.debtInterest)).curve(d3.curveMonotoneX);
  intGroup.append("path").datum(historic)
    .attr("d", intArea).attr("fill", C.blueLight);
  intGroup.append("path").datum(forecastWithBridge.map(d => ({...d, debtInterest: agg.find(a => a.year === d.year) ? agg.find(a => a.year === d.year).debtInterest : d.debtInterest})))
    .attr("d", d3.area().x(d => x(d.year)).y0(dim.innerH).y1(d => yInt(d.debtInterest)).curve(d3.curveMonotoneX))
    .attr("fill", C.blueLight).style("opacity", 0.5);

  // Line
  const intLine = d3.line().x(d => x(d.year)).y(d => yInt(d.debtInterest)).curve(d3.curveMonotoneX);
  const aggHistoric = agg.filter(d => !d.forecast);
  const aggForecast = agg.filter(d => d.forecast);
  const aggBridge = [aggHistoric[aggHistoric.length - 1], ...aggForecast];
  intGroup.append("path").datum(aggHistoric)
    .attr("d", intLine).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5);
  intGroup.append("path").datum(aggBridge)
    .attr("d", intLine).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Axes
  intGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  intGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yInt).ticks(6).tickFormat(d => d === 0 ? "0" : d).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis label (horizontal, above axis)
  intGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -12)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Debt interest, \u00a3bn");

  // Annotation: inflection — gilt yields surged from 2022, not 2020
  const inflectionYear = 2022;
  const inflectionD = agg.find(a => a.year === inflectionYear);
  if (inflectionD) {
    intGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(inflectionYear)).attr("y", yInt(inflectionD.debtInterest) - 36)
      .attr("text-anchor", "middle").attr("fill", C.blue).text("Gilt yields surge");
    intGroup.append("line")
      .attr("x1", x(inflectionYear)).attr("x2", x(inflectionYear))
      .attr("y1", yInt(inflectionD.debtInterest) - 30).attr("y2", yInt(inflectionD.debtInterest) - 4)
      .attr("stroke", C.blue).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // End label
  const lastAgg = agg[agg.length - 1];
  intGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastAgg.year) + 10).attr("y", yInt(lastAgg.debtInterest) + 5)
    .attr("fill", C.blue).text(sobFmtBnShort(lastAgg.debtInterest));

  // Hover
  const hoverRect2 = intGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = intGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot2 = intGroup.append("circle").attr("r", 4).attr("fill", C.blue).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(x.invert(mx));
    const d = agg.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot2.attr("cx", x(year)).attr("cy", yInt(d.debtInterest)).style("opacity", 1);
    const pctOfRev = d.receipts > 0 ? d3.format(".1f")(d.debtInterest / d.receipts * 100) : "—";
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value">Debt interest: ${sobFmtBnShort(d.debtInterest)}</div>
      <div class="tt-value" style="color:#555555">${pctOfRev}% of revenue</div>`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot2.style("opacity", 0); sobHideTooltip();
  });
}

function updateDebtChart(step) {
  const svg = d3.select("#chart-debt svg");
  if (step === 0) {
    svg.select(".debt-pct-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".debt-int-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".debt-pct-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".debt-int-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 3: COMPOSITION (Slides 5 & 6)
   ========================================================= */
function buildCompositionChart() {
  const container = document.getElementById("chart-composition");
  const dim = sobChartDims(container);
  // Make chart taller for horizontal bars
  const h = Math.max(580, dim.height);
  const m = { top: 30, right: 120, bottom: 20, left: sobIsMobile() ? 120 : 180 };
  const innerW = dim.width - m.left - m.right;
  const innerH = h - m.top - m.bottom;

  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", h)
    .attr("viewBox", `0 0 ${dim.width} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  // --- TAX REVENUE VIEW (step 0) ---
  const taxGroup = g.append("g").attr("class", "tax-view");
  const receipts = DATA.receiptTypes;
  const totalReceipts = d3.sum(receipts, d => d.value);
  const top3Names = ["Income tax (PAYE)", "VAT", "National Insurance"];

  const yTax = d3.scaleBand().domain(receipts.map(d => d.name)).range([0, innerH]).padding(0.25);
  const xTax = d3.scaleLinear().domain([0, d3.max(receipts, d => d.value) * 1.15]).range([0, innerW]);

  // Bars
  taxGroup.selectAll(".tax-bar").data(receipts).enter()
    .append("rect").attr("class", "tax-bar")
    .attr("x", 0).attr("y", d => yTax(d.name))
    .attr("width", d => xTax(d.value)).attr("height", yTax.bandwidth())
    .attr("fill", d => top3Names.includes(d.name) ? C.blue : C.faint)
    .attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.name}</div>
        <div class="tt-value">${sobFmtBnShort(d.value)} (${sobFmtPct(d.value / totalReceipts * 100)} of total)</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Labels
  taxGroup.selectAll(".tax-label").data(receipts).enter()
    .append("text").attr("class", d => top3Names.includes(d.name) ? "chart-annotation-bold" : "chart-annotation")
    .attr("x", d => xTax(d.value) + 6)
    .attr("y", d => yTax(d.name) + yTax.bandwidth() / 2 + 4.5)
    .attr("fill", d => top3Names.includes(d.name) ? C.ink : C.muted)
    .text(d => `${sobFmtBnShort(d.value)} (${Math.round(d.value / totalReceipts * 100)}%)`);

  // Name labels on left of bars
  taxGroup.selectAll(".tax-name").data(receipts).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", -8).attr("y", d => yTax(d.name) + yTax.bandwidth() / 2 + 4.5)
    .attr("text-anchor", "end")
    .attr("fill", d => top3Names.includes(d.name) ? C.ink : C.muted)
    .attr("font-weight", d => top3Names.includes(d.name) ? 600 : 400)
    .text(d => {
      const maxLen = sobIsMobile() ? 16 : 26;
      return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + "\u2026" : d.name;
    });

  // --- DEPARTMENT VIEW (step 1, hidden) ---
  const deptGroup = g.append("g").attr("class", "dept-view").style("opacity", 0).style("pointer-events", "none");
  const depts = DATA.departments.items
    .map(d => ({ name: d.name, value: d.values["2024-25"] / 1000 })) // convert millions to billions
    .sort((a, b) => b.value - a.value);
  const totalDept = d3.sum(depts, d => d.value);
  const top2Names = ["Work and Pensions", "Health and Social Care"];

  const deptDescs = {
    "Work and Pensions": "State Pension, Universal Credit, disability benefits, and employment support",
    "Health and Social Care": "NHS hospitals, GPs, mental health, prescriptions, and social care grants",
    "Education": "Schools funding, universities, apprenticeships, student loans, and early years",
    "Defence": "Armed forces personnel, equipment, nuclear deterrent, and operations"
  };

  // Show top 12 departments for readability
  const showDepts = depts.slice(0, 14);
  const yDept = d3.scaleBand().domain(showDepts.map(d => d.name)).range([0, innerH]).padding(0.25);
  const xDept = d3.scaleLinear().domain([0, d3.max(showDepts, d => d.value) * 1.15]).range([0, innerW]);

  deptGroup.selectAll(".dept-bar").data(showDepts).enter()
    .append("rect").attr("class", "dept-bar")
    .attr("x", 0).attr("y", d => yDept(d.name))
    .attr("width", d => xDept(d.value)).attr("height", yDept.bandwidth())
    .attr("fill", d => top2Names.includes(d.name) ? C.blue : C.faint)
    .attr("rx", 2)
    .on("mousemove", function(event, d) {
      const desc = deptDescs[d.name] || "";
      sobShowTooltip(`<div class="tt-label">${d.name}</div>
        <div class="tt-value">${sobFmtBnShort(d.value)} (${Math.round(d.value / totalDept * 100)}% of dept. spending)</div>
        ${desc ? '<div class="tt-value" style="margin-top:4px;color:#555555;font-size:13px;">' + desc + '</div>' : ''}`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Labels
  deptGroup.selectAll(".dept-label").data(showDepts).enter()
    .append("text").attr("class", d => top2Names.includes(d.name) ? "chart-annotation-bold" : "chart-annotation")
    .attr("x", d => xDept(d.value) + 6)
    .attr("y", d => yDept(d.name) + yDept.bandwidth() / 2 + 4.5)
    .attr("fill", d => top2Names.includes(d.name) ? C.ink : C.muted)
    .text(d => `${sobFmtBnShort(d.value)} (${Math.round(d.value / totalDept * 100)}%)`);

  // Name labels on left of bars
  deptGroup.selectAll(".dept-name").data(showDepts).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", -8).attr("y", d => yDept(d.name) + yDept.bandwidth() / 2 + 4.5)
    .attr("text-anchor", "end")
    .attr("fill", d => top2Names.includes(d.name) ? C.ink : C.muted)
    .attr("font-weight", d => top2Names.includes(d.name) ? 600 : 400)
    .text(d => {
      const maxLen = sobIsMobile() ? 14 : 24;
      return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + "\u2026" : d.name;
    });
}

function updateCompositionChart(step) {
  const svg = d3.select("#chart-composition svg");
  if (step === 0) {
    svg.select(".tax-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".dept-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".tax-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".dept-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 4: OUTLOOK (Slides 7 & 8)
   ========================================================= */
function buildOutlookChart() {
  const container = document.getElementById("chart-outlook");
  const dim = sobChartDims(container);

  // --- PROGRAMME CHANGE VIEW (step 0) ---
  // Calculate programme-level changes
  const fys = DATA.departments.fys;
  const firstFy = fys[0];
  const lastFy = fys[fys.length - 1];
  const allProgs = {};
  DATA.departments.items.forEach(item => {
    if (!item.breakdown) return;
    const firstBd = item.breakdown[firstFy] || [];
    const lastBd = item.breakdown[lastFy] || [];
    const firstMap = {}; firstBd.forEach(b => { firstMap[b.name] = b.value || 0; });
    const lastMap = {}; lastBd.forEach(b => { lastMap[b.name] = b.value || 0; });
    const names = new Set([...Object.keys(firstMap), ...Object.keys(lastMap)]);
    names.forEach(name => {
      if (!allProgs[name]) allProgs[name] = { first: 0, last: 0 };
      allProgs[name].first += firstMap[name] || 0;
      allProgs[name].last += lastMap[name] || 0;
    });
  });

  let progChanges = Object.entries(allProgs).map(([name, v]) => ({
    name, change: (v.last - v.first) / 1000 // to billions
  }));
  // Filter out COVID-specific items and very small items, keep structural
  progChanges = progChanges
    .filter(d => !d.name.startsWith("COVID") && d.name !== "BoE APF indemnity" && d.name !== "BoE APF indemnity (non-cash)" && d.name !== "COVID business loans (BBLS/CBILS)" && d.name !== "COVID support (CJRS, SEISS, EOTHO)" && d.name !== "Other (AME provisions, admin)" && d.name !== "NatWest share sales & income" && d.name !== "Business rates: s.31 relief grants" && d.name !== "Other")
    .sort((a, b) => b.change - a.change);

  // Take top 7 positive and top 5 negative by absolute change
  const positives = progChanges.filter(d => d.change > 0).slice(0, 8);
  const negatives = progChanges.filter(d => d.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);
  const showProgs = [...positives, ...negatives].sort((a, b) => b.change - a.change);

  const progContext = {
    "State Pension": "Triple lock",
    "Universal Credit": "Post-COVID caseload + inflation uprating",
    "Personal Independence Payment": "Rising claims",
    "Acute hospital services": "COVID backlog",
    "Defence Nuclear Enterprise": "Dreadnought + AUKUS",
    "Tax credits (legacy)": "Migration to Universal Credit"
  };

  const h = Math.max(580, dim.height);
  const m = { top: 30, right: 80, bottom: 20, left: 62 };
  const innerW = dim.width - m.left - m.right;
  const innerH = h - m.top - m.bottom;

  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", h)
    .attr("viewBox", `0 0 ${dim.width} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  // --- PROGRAMME DIVERGING BAR (step 0) ---
  const progGroup = g.append("g").attr("class", "prog-view");
  const yProg = d3.scaleBand().domain(showProgs.map(d => d.name)).range([0, innerH]).padding(0.22);
  const maxAbs = d3.max(showProgs, d => Math.abs(d.change));
  const xProg = d3.scaleLinear().domain([-maxAbs * 1.6, maxAbs * 1.15]).range([0, innerW]);

  // Zero line
  progGroup.append("line")
    .attr("x1", xProg(0)).attr("x2", xProg(0))
    .attr("y1", 0).attr("y2", innerH)
    .attr("stroke", "#D0D0C8").attr("stroke-width", 1);

  // Bars
  progGroup.selectAll(".prog-bar").data(showProgs).enter()
    .append("rect").attr("class", "prog-bar")
    .attr("x", d => d.change >= 0 ? xProg(0) : xProg(d.change))
    .attr("y", d => yProg(d.name))
    .attr("width", d => Math.abs(xProg(d.change) - xProg(0)))
    .attr("height", yProg.bandwidth())
    .attr("fill", d => d.change >= 0 ? C.red : C.green)
    .attr("rx", 2)
    .on("mousemove", function(event, d) {
      const ctx = progContext[d.name] || "";
      sobShowTooltip(`<div class="tt-label">${d.name}</div>
        <div class="tt-value">Change: ${d.change >= 0 ? "+" : "\u2212"}${sobFmtBnShort(Math.abs(d.change))}</div>
        <div class="tt-value">From ${firstFy} to ${lastFy}</div>
        ${ctx ? '<div class="tt-value" style="margin-top:4px;color:#555555;font-size:13px;">' + ctx + '</div>' : ''}`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Name labels always left of zero line for clean alignment
  progGroup.selectAll(".prog-name").data(showProgs).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", d => d.change < 0 ? xProg(d.change) - 8 : xProg(0) - 8)
    .attr("y", d => yProg(d.name) + yProg.bandwidth() / 2 + 4.5)
    .attr("text-anchor", "end")
    .attr("fill", C.ink)
    .attr("font-weight", d => Math.abs(d.change) > 15 ? 600 : 400)
    .text(d => {
      const maxLen = sobIsMobile() ? 18 : 28;
      return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + "\u2026" : d.name;
    });

  // Value labels at end of bar
  progGroup.selectAll(".prog-val").data(showProgs).enter()
    .append("text").attr("class", "chart-annotation-bold")
    .attr("x", d => d.change >= 0 ? xProg(d.change) + 6 : xProg(d.change) - 6)
    .attr("y", d => yProg(d.name) + yProg.bandwidth() / 2 + 4.5)
    .attr("text-anchor", d => d.change >= 0 ? "start" : "end")
    .attr("fill", d => d.change >= 0 ? C.red : C.green)
    .text(d => (d.change >= 0 ? "+" : "\u2212") + "\u00a3" + d3.format(".0f")(Math.abs(d.change)) + "bn");

  // Context annotations for top 3 — placed just below value labels
  let annotCount = 0;
  progGroup.selectAll(".prog-context").data(showProgs.filter(d => progContext[d.name] && annotCount++ < 3)).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", d => d.change >= 0 ? xProg(d.change) + 6 : xProg(d.change) - 6)
    .attr("y", d => yProg(d.name) + yProg.bandwidth() / 2 + 17)
    .attr("text-anchor", d => d.change >= 0 ? "start" : "end")
    .attr("fill", C.muted).attr("font-size", "11px")
    .text(d => progContext[d.name]);

  // Period label
  progGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xProg(0)).attr("y", -10).attr("text-anchor", "middle").attr("fill", C.muted)
    .text(`Change ${firstFy} to ${lastFy}`);

  // --- DEFICIT OUTLOOK VIEW (step 1, hidden) ---
  const outlookGroup = g.append("g").attr("class", "outlook-view").style("opacity", 0).style("pointer-events", "none");
  const pctGDP = DATA.pctGDP;
  const agg = DATA.aggregates;
  const x = d3.scaleLinear().domain([1978, 2030]).range([0, innerW]);
  const yDef = d3.scaleLinear().domain([-2, 16]).range([innerH, 0]);

  // Grid
  outlookGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yDef).ticks(8).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Zero line
  outlookGroup.append("line")
    .attr("x1", 0).attr("x2", innerW)
    .attr("y1", yDef(0)).attr("y2", yDef(0))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);

  const historic = pctGDP.filter(d => !d.forecast);
  const forecast = pctGDP.filter(d => d.forecast);
  const lastHistoric = historic[historic.length - 1];
  const forecastBridge = [lastHistoric, ...forecast];

  // Forecast highlight area
  if (forecast.length > 0) {
    const fStartX = x(forecast[0].year);
    outlookGroup.append("rect")
      .attr("x", fStartX).attr("y", 0)
      .attr("width", innerW - fStartX).attr("height", innerH)
      .attr("fill", "#F5F5F0");
    outlookGroup.append("text").attr("class", "chart-annotation")
      .attr("x", fStartX + (innerW - fStartX) / 2).attr("y", 16)
      .attr("text-anchor", "middle").attr("fill", C.muted)
      .text("OBR forecast");
  }

  // Area under deficit
  const defArea = d3.area()
    .x(d => x(d.year)).y0(yDef(0)).y1(d => yDef(d.borrowing))
    .curve(d3.curveMonotoneX);
  outlookGroup.append("path").datum(historic)
    .attr("d", defArea).attr("fill", C.redLight);
  outlookGroup.append("path").datum(forecastBridge)
    .attr("d", defArea).attr("fill", C.redLight).style("opacity", 0.5);

  // Line
  const defLine = d3.line().x(d => x(d.year)).y(d => yDef(d.borrowing)).curve(d3.curveMonotoneX);
  outlookGroup.append("path").datum(historic)
    .attr("d", defLine).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);
  outlookGroup.append("path").datum(forecastBridge)
    .attr("d", defLine).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Axes
  outlookGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 10).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  outlookGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yDef).ticks(8).tickFormat(d => d === 0 ? "0" : d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());
  outlookGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -12).attr("text-anchor", "start").attr("fill", C.muted)
    .text("Deficit, % of GDP");

  // Annotations
  const last = pctGDP[pctGDP.length - 1];
  outlookGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(last.year) + 10).attr("y", yDef(last.borrowing) + 5)
    .attr("fill", C.red).text(sobFmtPct(last.borrowing));

  // Annotation for narrowing (offset into white space with leader line)
  outlookGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2028)).attr("y", yDef(last.borrowing) - 48)
    .attr("text-anchor", "middle").attr("fill", C.red)
    .text("Narrowing to " + sobFmtPct(last.borrowing));
  outlookGroup.append("line")
    .attr("x1", x(2028)).attr("x2", x(2028))
    .attr("y1", yDef(last.borrowing) - 42).attr("y2", yDef(last.borrowing) - 4)
    .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // COVID peak (offset above with leader line)
  const covid = pctGDP.find(d => d.year === 2020);
  if (covid) {
    outlookGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(2020)).attr("y", yDef(covid.borrowing) - 32)
      .attr("text-anchor", "middle").attr("fill", C.red)
      .text("COVID: " + sobFmtPct(covid.borrowing));
    outlookGroup.append("line")
      .attr("x1", x(2020)).attr("x2", x(2020))
      .attr("y1", yDef(covid.borrowing) - 26).attr("y2", yDef(covid.borrowing) - 4)
      .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Hover
  const hoverRect = outlookGroup.append("rect")
    .attr("width", innerW).attr("height", innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = outlookGroup.append("line")
    .attr("y1", 0).attr("y2", innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = outlookGroup.append("circle").attr("r", 4).attr("fill", C.red).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(x.invert(mx));
    const d = pctGDP.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot.attr("cx", x(year)).attr("cy", yDef(d.borrowing)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}${d.forecast ? " (forecast)" : ""}</div>
      <div class="tt-value">Deficit: ${sobFmtPct(d.borrowing)} of GDP</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });
}

function updateOutlookChart(step) {
  const svg = d3.select("#chart-outlook svg");
  if (step === 0) {
    svg.select(".prog-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".outlook-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".prog-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".outlook-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "gap": updateGapChart(step); break;
    case "debt": updateDebtChart(step); break;
    case "composition": updateCompositionChart(step); break;
    case "outlook": updateOutlookChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("gap"); }

})();
