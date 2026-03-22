/**
 * @file immigration.js — Net migration, visa categories, asylum, demographic impact
 * @description Interactive D3.js scrollytelling charts for the immigration story.
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


// Touch support: map touchmove/touchend to mousemove/mouseleave for chart tooltips
function addTouchSupport(selection) {
  selection
    .on("touchmove", function(event) {
      event.preventDefault();
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX, clientY: touch.clientY,
        bubbles: true
      });
      this.dispatchEvent(mouseEvent);
    })
    .on("touchend", function() {
      const mouseEvent = new MouseEvent("mouseleave", { bubbles: true });
      this.dispatchEvent(mouseEvent);
    });
}

/* =========================================================
   HELPERS
   ========================================================= */
function fmtK(v) {
  const abs = Math.abs(Math.round(v));
  const s = d3.format(",")(abs);
  return (v < 0 ? "\u2212" : "") + s + "k";
}
function fmtNum(v) { return d3.format(",")(Math.round(v)); }



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/immigration.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big numbers
  document.getElementById("bn-peak").textContent = fmtK(DATA.snapshot.netMigrationPeak);

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-hook svg, #chart-brexit svg, #chart-asylum svg, #chart-demographics svg").remove();
  buildAllCharts();
  document.querySelectorAll(".step-inner.active").forEach(el => {
    const step = el.closest(".step");
    const sec = step.dataset.section;
    const idx = +step.dataset.step;
    updateChart(sec, idx);
  });
}

/* =========================================================
   BUILD ALL CHARTS
   ========================================================= */
function buildAllCharts() {
  buildHookChart();
  buildBrexitChart();
  buildAsylumChart();
  buildDemographicsChart();
}

/* =========================================================
   CHART 1: THE HOOK — Net migration big number + historical line
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing UK immigration, emigration and net migration over time");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const netMig = DATA.netMigration;

  // --- BIG NUMBER VIEW (step 0) ---
  const bigGroup = g.append("g").attr("class", "big-view");

  // Show as a bar comparison: immigration vs emigration for 2022
  const peak = netMig.find(d => d.year === 2022);
  const xBar = d3.scaleBand().domain(["Immigration", "Emigration", "Net"]).range([0, dim.innerW]).padding(0.3);
  const yBar = d3.scaleLinear().domain([0, 1400]).range([dim.innerH, 0]);

  // Grid
  bigGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yBar).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Y axis
  bigGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yBar).ticks(6).tickFormat(d => fmtK(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Bars
  bigGroup.append("rect")
    .attr("x", xBar("Immigration")).attr("y", yBar(peak.immigration))
    .attr("width", xBar.bandwidth()).attr("height", dim.innerH - yBar(peak.immigration))
    .attr("fill", C.orange).attr("rx", 3);

  bigGroup.append("rect")
    .attr("x", xBar("Emigration")).attr("y", yBar(peak.emigration))
    .attr("width", xBar.bandwidth()).attr("height", dim.innerH - yBar(peak.emigration))
    .attr("fill", C.blue).attr("rx", 3);

  bigGroup.append("rect")
    .attr("x", xBar("Net")).attr("y", yBar(peak.net))
    .attr("width", xBar.bandwidth()).attr("height", dim.innerH - yBar(peak.net))
    .attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2).attr("rx", 3);

  // Bar labels
  bigGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xBar("Immigration") + xBar.bandwidth() / 2).attr("y", yBar(peak.immigration) - 14)
    .attr("text-anchor", "middle").attr("fill", C.orange).text(fmtK(peak.immigration));
  bigGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xBar("Immigration") + xBar.bandwidth() / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.orange).attr("font-weight", 600).text("Arrivals");

  bigGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xBar("Emigration") + xBar.bandwidth() / 2).attr("y", yBar(peak.emigration) - 14)
    .attr("text-anchor", "middle").attr("fill", C.blue).text(fmtK(peak.emigration));
  bigGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xBar("Emigration") + xBar.bandwidth() / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.blue).attr("font-weight", 600).text("Departures");

  bigGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xBar("Net") + xBar.bandwidth() / 2).attr("y", yBar(peak.net) - 14)
    .attr("text-anchor", "middle").attr("fill", C.orange).text(fmtK(peak.net));
  bigGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xBar("Net") + xBar.bandwidth() / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.orange).attr("font-weight", 600).text("Net migration");

  // Year label
  bigGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW / 2).attr("y", -10).attr("text-anchor", "middle").attr("fill", C.muted)
    .text("Year ending June 2022");

  // --- LINE VIEW (step 1, hidden) ---
  const lineGroup = g.append("g").attr("class", "line-view").style("opacity", 0).style("pointer-events", "none");

  const xLine = d3.scaleLinear().domain([1991, 2024]).range([0, dim.innerW]);
  const yLine = d3.scaleLinear().domain([0, d3.max(netMig, d => d.immigration) * 1.08]).range([dim.innerH, 0]);

  // Grid
  lineGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yLine).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area between immigration and emigration
  const areaGen = d3.area()
    .x(d => xLine(d.year))
    .y0(d => yLine(d.emigration))
    .y1(d => yLine(d.immigration))
    .curve(d3.curveMonotoneX);

  lineGroup.append("path").datum(netMig)
    .attr("d", areaGen)
    .attr("fill", C.orangeLight).attr("stroke", "none");

  // Net migration area (from 0)
  const netArea = d3.area()
    .x(d => xLine(d.year))
    .y0(yLine(0))
    .y1(d => yLine(d.net))
    .curve(d3.curveMonotoneX);

  // Immigration line
  const lineGen = (field) => d3.line().x(d => xLine(d.year)).y(d => yLine(d[field])).curve(d3.curveMonotoneX);

  lineGroup.append("path").datum(netMig)
    .attr("d", lineGen("immigration")).attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2.5);

  lineGroup.append("path").datum(netMig)
    .attr("d", lineGen("emigration")).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5);

  lineGroup.append("path").datum(netMig)
    .attr("d", lineGen("net")).attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 2)
    .attr("stroke-dasharray", "6,4").attr("opacity", 0.8);

  // Axes
  lineGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  lineGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yLine).ticks(6).tickFormat(d => fmtK(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14)
    .attr("text-anchor", "start").attr("fill", C.muted).text("Migration flows (thousands)");

  // End labels -- enforce minimum 18px vertical spacing to prevent overlap
  const last = netMig[netMig.length - 1];
  const minGap = 18;
  const endLabels = [
    { y: yLine(last.immigration) + 4, text: "Immigration", fill: C.orange },
    { y: yLine(last.net) - 2, text: "Net", fill: C.ink },
    { y: yLine(last.emigration) + 4, text: "Emigration", fill: C.blue }
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < minGap) {
      endLabels[i].y = endLabels[i - 1].y + minGap;
    }
  }
  endLabels.forEach(l => {
    lineGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", xLine(last.year) + 10).attr("y", l.y)
      .attr("fill", l.fill).text(l.text);
  });

  // COVID annotation
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2020)).attr("y", yLine(304) - 36)
    .attr("text-anchor", "middle").attr("fill", C.muted).text("COVID");
  lineGroup.append("line")
    .attr("x1", xLine(2020)).attr("x2", xLine(2020))
    .attr("y1", yLine(304) - 28).attr("y2", yLine(304) - 8)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // 2022 peak annotation
  lineGroup.append("circle")
    .attr("cx", xLine(2022)).attr("cy", yLine(1218)).attr("r", 4)
    .attr("fill", C.orange).attr("stroke", "#fff").attr("stroke-width", 2);
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(2022) - 10).attr("y", yLine(1218) - 18)
    .attr("text-anchor", "end").attr("fill", C.orange).text("1,218k peak");

  // Hover overlay
  const hoverRect = lineGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = lineGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotI = lineGroup.append("circle").attr("r", 4).attr("fill", C.orange).style("opacity", 0);
  const hoverDotE = lineGroup.append("circle").attr("r", 4).attr("fill", C.blue).style("opacity", 0);
  const hoverDotN = lineGroup.append("circle").attr("r", 4).attr("fill", C.ink).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = netMig.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDotI.attr("cx", xLine(year)).attr("cy", yLine(d.immigration)).style("opacity", 1);
    hoverDotE.attr("cx", xLine(year)).attr("cy", yLine(d.emigration)).style("opacity", 1);
    hoverDotN.attr("cx", xLine(year)).attr("cy", yLine(d.net)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value" style="color:${C.orange}">Immigration: ${fmtK(d.immigration)}</div>
      <div class="tt-value" style="color:${C.blue}">Emigration: ${fmtK(d.emigration)}</div>
      <div class="tt-value" style="color:${C.ink};font-weight:600">Net: ${fmtK(d.net)}</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDotI.style("opacity", 0);
    hoverDotE.style("opacity", 0); hoverDotN.style("opacity", 0);
    sobHideTooltip();
  });
  addTouchSupport(hoverRect);
}

function updateHookChart(step) {
  const svg = d3.select("#chart-hook svg");
  if (step === 0) {
    svg.select(".big-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".big-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".line-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 2: POST-BREXIT — Immigration/emigration + visa breakdown
   ========================================================= */
function buildBrexitChart() {
  const container = document.getElementById("chart-brexit");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing post-Brexit net migration trends and visa breakdown by route");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const netMig = DATA.netMigration;

  // --- NET MIGRATION FOCUSED VIEW (step 0) ---
  const netGroup = g.append("g").attr("class", "net-view");
  const xLine = d3.scaleLinear().domain([1991, 2024]).range([0, dim.innerW]);
  const yLine = d3.scaleLinear().domain([-50, 750]).range([dim.innerH, 0]);

  // Grid
  netGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yLine).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Zero line
  netGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yLine(0)).attr("y2", yLine(0))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);

  // Brexit referendum line
  netGroup.append("line")
    .attr("x1", xLine(2016)).attr("x2", xLine(2016))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.faint).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  netGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(2016) + 6).attr("y", 16).attr("fill", C.muted)
    .text("Brexit vote");

  // Shaded net area
  const netArea = d3.area()
    .x(d => xLine(d.year))
    .y0(yLine(0))
    .y1(d => yLine(d.net))
    .curve(d3.curveMonotoneX);

  netGroup.append("path").datum(netMig)
    .attr("d", netArea)
    .attr("fill", C.orangeLight);

  // Net migration line
  const netLine = d3.line().x(d => xLine(d.year)).y(d => yLine(d.net)).curve(d3.curveMonotoneX);
  netGroup.append("path").datum(netMig)
    .attr("d", netLine).attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2.5);

  // Axes
  netGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xLine).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  netGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yLine).ticks(8).tickFormat(d => fmtK(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  netGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14)
    .attr("text-anchor", "start").attr("fill", C.muted).text("Net migration (thousands)");

  // Peak dot
  netGroup.append("circle")
    .attr("cx", xLine(2022)).attr("cy", yLine(710)).attr("r", 5)
    .attr("fill", C.orange).attr("stroke", "#fff").attr("stroke-width", 2);
  netGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(2022) - 10).attr("y", yLine(710) - 18)
    .attr("text-anchor", "end").attr("fill", C.orange).text("710k peak");

  // 1990s average annotation
  netGroup.append("line")
    .attr("x1", xLine(1991)).attr("x2", xLine(1997))
    .attr("y1", yLine(50)).attr("y2", yLine(50))
    .attr("stroke", C.blue).attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");
  netGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(1994)).attr("y", yLine(50) - 14)
    .attr("text-anchor", "middle").attr("fill", C.blue).text("~50k in 1990s");

  // End label
  const last = netMig[netMig.length - 1];
  netGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(last.year) + 10).attr("y", yLine(last.net) - 10)
    .attr("fill", C.orange).text(fmtK(last.net));

  // Hover
  const hoverRect = netGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = netGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = netGroup.append("circle").attr("r", 4).attr("fill", C.orange).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xLine.invert(mx));
    const d = netMig.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xLine(year)).attr("x2", xLine(year)).style("opacity", 1);
    hoverDot.attr("cx", xLine(year)).attr("cy", yLine(d.net)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value" style="color:${C.orange}">Net migration: ${fmtK(d.net)}</div>
      <div class="tt-value">Immigration: ${fmtK(d.immigration)}</div>
      <div class="tt-value">Emigration: ${fmtK(d.emigration)}</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });
  addTouchSupport(hoverRect);

  // --- VISA BREAKDOWN VIEW (step 1, hidden) ---
  const visaGroup = g.append("g").attr("class", "visa-view").style("opacity", 0).style("pointer-events", "none");
  const visas = DATA.visaBreakdown;
  const totalVisas = d3.sum(visas, d => d.value);

  const visaColors = {
    "Study": C.orange,
    "Work": "#0E7490",
    "Family": C.blue,
    "Humanitarian": "#7C3AED",
    "Other": C.faint
  };

  const yVisa = d3.scaleBand().domain(visas.map(d => d.type)).range([dim.innerH * 0.1, dim.innerH * 0.85]).padding(0.3);
  const xVisa = d3.scaleLinear().domain([0, d3.max(visas, d => d.value) * 1.25]).range([0, dim.innerW]);

  // Vertical grid lines for horizontal bar chart
  visaGroup.append("g").attr("class", "grid")
    .attr("transform", `translate(0,${dim.innerH * 0.85})`)
    .call(d3.axisBottom(xVisa).ticks(5).tickSize(-(dim.innerH * 0.75)).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Value axis labels along bottom
  visaGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH * 0.87})`)
    .call(d3.axisBottom(xVisa).ticks(5).tickFormat(d => fmtK(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Bars
  visaGroup.selectAll(".visa-bar").data(visas).enter()
    .append("rect").attr("class", "visa-bar")
    .attr("x", 0).attr("y", d => yVisa(d.type))
    .attr("width", d => xVisa(d.value)).attr("height", yVisa.bandwidth())
    .attr("fill", d => visaColors[d.type] || C.faint).attr("rx", 3)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.type} visas</div>
        <div class="tt-value">${fmtK(d.value)} (${Math.round(d.value / totalVisas * 100)}% of total)</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Labels — type name inside bar (white on colour) or suppressed if bar too short (value label handles it)
  visaGroup.selectAll(".visa-name").data(visas).enter()
    .append("text").attr("class", "chart-annotation-bold")
    .attr("x", 10)
    .attr("y", d => yVisa(d.type) + yVisa.bandwidth() / 2 + 5)
    .attr("fill", "#fff")
    .style("display", d => xVisa(d.value) > 80 ? null : "none")
    .text(d => d.type);

  // Value labels at end of bar
  visaGroup.selectAll(".visa-val").data(visas).enter()
    .append("text").attr("class", "chart-annotation-bold")
    .attr("x", d => xVisa(d.value) + 8)
    .attr("y", d => yVisa(d.type) + yVisa.bandwidth() / 2 + 5)
    .attr("fill", d => visaColors[d.type] || C.muted)
    .text(d => (xVisa(d.value) <= 80 ? d.type + ": " : "") + fmtK(d.value) + " (" + Math.round(d.value / totalVisas * 100) + "%)");

  // Title
  visaGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", dim.innerH * 0.04).attr("fill", C.muted)
    .text("Visa grants by route, latest year");
}

function updateBrexitChart(step) {
  const svg = d3.select("#chart-brexit svg");
  if (step === 0) {
    svg.select(".net-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
    svg.select(".visa-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".net-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".visa-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 3: ASYLUM
   ========================================================= */
function buildAsylumChart() {
  const container = document.getElementById("chart-asylum");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing UK asylum applications and grants over time");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const asylum = DATA.asylum;

  // --- APPLICATIONS VIEW (step 0) ---
  const appGroup = g.append("g").attr("class", "app-view");
  const x = d3.scaleLinear().domain([2001, 2024]).range([0, dim.innerW]);
  const yApp = d3.scaleLinear().domain([0, 85]).range([dim.innerH, 0]);

  // Grid
  appGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yApp).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const appArea = d3.area()
    .x(d => x(d.year)).y0(dim.innerH).y1(d => yApp(d.applications))
    .curve(d3.curveMonotoneX);
  appGroup.append("path").datum(asylum)
    .attr("d", appArea).attr("fill", C.orangeLight);

  // Line
  const appLine = d3.line().x(d => x(d.year)).y(d => yApp(d.applications)).curve(d3.curveMonotoneX);
  appGroup.append("path").datum(asylum)
    .attr("d", appLine).attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2.5);

  // Axes
  appGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  appGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yApp).ticks(6).tickFormat(d => d + "k").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  appGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14)
    .attr("text-anchor", "start").attr("fill", C.muted).text("Asylum applications (thousands)");

  // 2001 peak annotation
  appGroup.append("circle")
    .attr("cx", x(2001)).attr("cy", yApp(71)).attr("r", 4)
    .attr("fill", C.orange).attr("stroke", "#fff").attr("stroke-width", 2);
  appGroup.append("line")
    .attr("x1", x(2001)).attr("x2", x(2001) + 10)
    .attr("y1", yApp(71) - 8).attr("y2", yApp(71) - 22)
    .attr("stroke", C.orange).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  appGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2001) + 12).attr("y", yApp(71) - 24)
    .attr("fill", C.orange).text("71k (2001)");

  // 2022 peak annotation
  appGroup.append("circle")
    .attr("cx", x(2022)).attr("cy", yApp(74.8)).attr("r", 4)
    .attr("fill", C.orange).attr("stroke", "#fff").attr("stroke-width", 2);
  appGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2022) - 10).attr("y", yApp(74.8) - 18)
    .attr("text-anchor", "end").attr("fill", C.orange).text("74.8k (2022)");

  // End label
  const lastA = asylum[asylum.length - 1];
  appGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastA.year) + 10).attr("y", yApp(lastA.applications) - 10)
    .attr("fill", C.orange).text(d3.format(".1f")(lastA.applications) + "k");

  // Hover
  const hoverRect = appGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = appGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotA = appGroup.append("circle").attr("r", 4).attr("fill", C.orange).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(x.invert(mx));
    const d = asylum.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDotA.attr("cx", x(year)).attr("cy", yApp(d.applications)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value" style="color:${C.orange}">Applications: ${d3.format(".1f")(d.applications)}k</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDotA.style("opacity", 0); sobHideTooltip();
  });
  addTouchSupport(hoverRect);

  // --- APPLICATIONS vs GRANTS VIEW (step 1, hidden) ---
  const grantGroup = g.append("g").attr("class", "grant-view").style("opacity", 0).style("pointer-events", "none");
  const yGrant = d3.scaleLinear().domain([0, 85]).range([dim.innerH, 0]);

  // Grid
  grantGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yGrant).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Gap area between applications and grants
  const gapArea = d3.area()
    .x(d => x(d.year))
    .y0(d => yGrant(d.grants))
    .y1(d => yGrant(d.applications))
    .curve(d3.curveMonotoneX);
  grantGroup.append("path").datum(asylum)
    .attr("d", gapArea).attr("fill", C.orangeLight).attr("opacity", 0.5);

  // Grants area
  const grantsArea = d3.area()
    .x(d => x(d.year)).y0(dim.innerH).y1(d => yGrant(d.grants))
    .curve(d3.curveMonotoneX);
  grantGroup.append("path").datum(asylum)
    .attr("d", grantsArea).attr("fill", C.blueLight);

  // Applications line
  const appLine2 = d3.line().x(d => x(d.year)).y(d => yGrant(d.applications)).curve(d3.curveMonotoneX);
  grantGroup.append("path").datum(asylum)
    .attr("d", appLine2).attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2.5);

  // Grants line
  const grantLine = d3.line().x(d => x(d.year)).y(d => yGrant(d.grants)).curve(d3.curveMonotoneX);
  grantGroup.append("path").datum(asylum)
    .attr("d", grantLine).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5);

  // Axes
  grantGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  grantGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yGrant).ticks(6).tickFormat(d => d + "k").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  grantGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14)
    .attr("text-anchor", "start").attr("fill", C.muted).text("Asylum applications and grants (thousands)");

  // End labels
  const lastAs = asylum[asylum.length - 1];
  grantGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastAs.year) + 10).attr("y", yGrant(lastAs.applications) - 10)
    .attr("fill", C.orange).text("Applications");
  grantGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastAs.year) + 10).attr("y", yGrant(lastAs.grants) + 16)
    .attr("fill", C.blue).text("Grants");

  // Gap annotation
  const midYear = 2022;
  const midD = asylum.find(d => d.year === midYear);
  if (midD) {
    const gapMid = (yGrant(midD.grants) + yGrant(midD.applications)) / 2;
    // Place label in white space to the left, with a leader line pointing into the gap
    grantGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(midYear) - 50).attr("y", gapMid - 24)
      .attr("text-anchor", "end").attr("fill", C.muted).attr("font-style", "italic")
      .text("Backlog");
    grantGroup.append("line")
      .attr("x1", x(midYear) - 48).attr("x2", x(midYear) - 12)
      .attr("y1", gapMid - 20).attr("y2", gapMid)
      .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Hover
  const hoverRect2 = grantGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = grantGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotApp = grantGroup.append("circle").attr("r", 4).attr("fill", C.orange).style("opacity", 0);
  const hoverDotGrant = grantGroup.append("circle").attr("r", 4).attr("fill", C.blue).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(x.invert(mx));
    const d = asylum.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDotApp.attr("cx", x(year)).attr("cy", yGrant(d.applications)).style("opacity", 1);
    hoverDotGrant.attr("cx", x(year)).attr("cy", yGrant(d.grants)).style("opacity", 1);
    const gap = d.applications - d.grants;
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value" style="color:${C.orange}">Applications: ${d3.format(".1f")(d.applications)}k</div>
      <div class="tt-value" style="color:${C.blue}">Grants: ${d3.format(".1f")(d.grants)}k</div>
      <div class="tt-value">Gap: ${d3.format(".1f")(gap)}k</div>`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDotApp.style("opacity", 0); hoverDotGrant.style("opacity", 0);
    sobHideTooltip();
  });
  addTouchSupport(hoverRect2);
}

function updateAsylumChart(step) {
  const svg = d3.select("#chart-asylum svg");
  if (step === 0) {
    svg.select(".app-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
    svg.select(".grant-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".app-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".grant-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 4: DEMOGRAPHICS
   ========================================================= */
function buildDemographicsChart() {
  const container = document.getElementById("chart-demographics");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing UK population growth components and foreign-born share");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const popComp = DATA.popComponents;

  // --- POPULATION COMPONENTS VIEW (step 0) ---
  const popGroup = g.append("g").attr("class", "pop-view");
  const x = d3.scaleLinear().domain([2001, 2023]).range([0, dim.innerW]);
  const yPop = d3.scaleLinear().domain([-100, 750]).range([dim.innerH, 0]);

  // Grid
  popGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yPop).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Zero line
  popGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yPop(0)).attr("y2", yPop(0))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);

  // Net migration bars
  const barWidth = dim.innerW / popComp.length * 0.42;
  popGroup.selectAll(".bar-mig").data(popComp).enter()
    .append("rect").attr("class", "bar-mig")
    .attr("x", d => x(d.year) - barWidth)
    .attr("y", d => yPop(Math.max(0, d.netMigration)))
    .attr("width", barWidth)
    .attr("height", d => Math.abs(yPop(0) - yPop(d.netMigration)))
    .attr("fill", C.orange).attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value" style="color:${C.orange}">Net migration: ${fmtK(d.netMigration)}</div>
        <div class="tt-value" style="color:${d.naturalChange >= 0 ? C.blue : C.red}">Natural change: ${d.naturalChange >= 0 ? "+" : ""}${fmtK(d.naturalChange)}</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Natural change bars
  popGroup.selectAll(".bar-nat").data(popComp).enter()
    .append("rect").attr("class", "bar-nat")
    .attr("x", d => x(d.year))
    .attr("y", d => d.naturalChange >= 0 ? yPop(d.naturalChange) : yPop(0))
    .attr("width", barWidth)
    .attr("height", d => Math.abs(yPop(0) - yPop(d.naturalChange)))
    .attr("fill", d => d.naturalChange >= 0 ? C.blue : C.red).attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value" style="color:${C.orange}">Net migration: ${fmtK(d.netMigration)}</div>
        <div class="tt-value" style="color:${d.naturalChange >= 0 ? C.blue : C.red}">Natural change: ${d.naturalChange >= 0 ? "+" : ""}${fmtK(d.naturalChange)}</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Axes
  popGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  popGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yPop).ticks(8).tickFormat(d => (d >= 0 ? "+" : "") + fmtK(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  popGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14)
    .attr("text-anchor", "start").attr("fill", C.muted).text("Thousands per year");

  // Legend
  const legendY = 8;
  popGroup.append("rect").attr("x", dim.innerW - 200).attr("y", legendY).attr("width", 14).attr("height", 14).attr("fill", C.orange).attr("rx", 2);
  popGroup.append("text").attr("class", "chart-annotation").attr("x", dim.innerW - 180).attr("y", legendY + 12).attr("fill", C.ink).text("Net migration");
  popGroup.append("rect").attr("x", dim.innerW - 200).attr("y", legendY + 22).attr("width", 14).attr("height", 14).attr("fill", C.blue).attr("rx", 2);
  popGroup.append("text").attr("class", "chart-annotation").attr("x", dim.innerW - 180).attr("y", legendY + 34).attr("fill", C.ink).text("Natural change");

  // Annotation: natural change goes negative
  const negYear = popComp.find(d => d.naturalChange < 0);
  if (negYear) {
    // Place annotation below bar with leader line to avoid overlapping data
    popGroup.append("line")
      .attr("x1", x(negYear.year)).attr("x2", x(negYear.year))
      .attr("y1", yPop(negYear.naturalChange) + 10).attr("y2", yPop(negYear.naturalChange) + 28)
      .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
    popGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(negYear.year)).attr("y", yPop(negYear.naturalChange) + 42)
      .attr("text-anchor", "middle").attr("fill", C.red).attr("font-size", "13px")
      .text("Deaths > births (" + negYear.year + ")");
  }

  // --- FOREIGN BORN + DEPENDENCY VIEW (step 1, hidden) ---
  const fbGroup = g.append("g").attr("class", "fb-view").style("opacity", 0).style("pointer-events", "none");
  const foreignBorn = DATA.foreignBorn;
  const depRatio = DATA.dependencyRatio;

  const xFB = d3.scaleLinear().domain([2004, 2024]).range([0, dim.innerW]);
  const yFB = d3.scaleLinear().domain([0, 20]).range([dim.innerH, 0]);
  const yDep = d3.scaleLinear().domain([48, 60]).range([dim.innerH, 0]);

  // Grid
  fbGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yFB).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Foreign born area
  const fbArea = d3.area()
    .x(d => xFB(d.year)).y0(dim.innerH).y1(d => yFB(d.pct))
    .curve(d3.curveMonotoneX);
  fbGroup.append("path").datum(foreignBorn)
    .attr("d", fbArea).attr("fill", C.orangeLight);

  // Foreign born line
  const fbLine = d3.line().x(d => xFB(d.year)).y(d => yFB(d.pct)).curve(d3.curveMonotoneX);
  fbGroup.append("path").datum(foreignBorn)
    .attr("d", fbLine).attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2.5);

  // Dependency ratio line (on right axis)
  const depLine = d3.line()
    .x(d => xFB(d.year)).y(d => yDep(d.ratio))
    .curve(d3.curveMonotoneX);
  // Filter dependency data to match x domain
  const depFiltered = depRatio.filter(d => d.year >= 2004);
  fbGroup.append("path").datum(depFiltered)
    .attr("d", depLine).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Axes
  fbGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xFB).ticks(6).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Left axis — foreign born %
  fbGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yFB).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", C.orange);

  // Right axis — dependency ratio (truncated baseline, clearly labelled)
  fbGroup.append("g").attr("class", "axis y-axis-right")
    .attr("transform", `translate(${dim.innerW},0)`)
    .call(d3.axisRight(yDep).ticks(6).tickFormat(d => d).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", C.blue).attr("font-size", "13px").attr("font-family", "'Inter', sans-serif");

  // Right axis label with truncation warning
  fbGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", -14)
    .attr("text-anchor", "end").attr("fill", C.blue)
    .text("Dependency ratio (axis starts at 48)");

  // Left axis label
  fbGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -14)
    .attr("text-anchor", "start").attr("fill", C.orange)
    .text("Foreign-born share (%)");

  // End labels
  const lastFB = foreignBorn[foreignBorn.length - 1];
  const lastDep = depFiltered[depFiltered.length - 1];
  fbGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xFB(lastFB.year) + 10).attr("y", yFB(lastFB.pct) - 12)
    .attr("fill", C.orange).text(sobFmtPct(lastFB.pct) + " foreign-born");
  fbGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xFB(lastDep.year) + 10).attr("y", yDep(lastDep.ratio) + 22)
    .attr("fill", C.blue).text(d3.format(".1f")(lastDep.ratio) + " dep. ratio");

  // Start labels
  const firstFB = foreignBorn[0];
  fbGroup.append("circle")
    .attr("cx", xFB(firstFB.year)).attr("cy", yFB(firstFB.pct)).attr("r", 4)
    .attr("fill", C.orange).attr("stroke", "#fff").attr("stroke-width", 2);
  fbGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xFB(firstFB.year) + 10).attr("y", yFB(firstFB.pct) - 10)
    .attr("fill", C.orange).text(sobFmtPct(firstFB.pct) + " (2004)");

  // Hover
  const hoverRect3 = fbGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine3 = fbGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotFB = fbGroup.append("circle").attr("r", 4).attr("fill", C.orange).style("opacity", 0);
  const hoverDotDep = fbGroup.append("circle").attr("r", 4).attr("fill", C.blue).style("opacity", 0);

  hoverRect3.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xFB.invert(mx));
    const fb = foreignBorn.find(a => a.year === year);
    const dep = depFiltered.find(a => a.year === year);
    if (!fb && !dep) return;
    hoverLine3.attr("x1", xFB(year)).attr("x2", xFB(year)).style("opacity", 1);
    if (fb) {
      hoverDotFB.attr("cx", xFB(year)).attr("cy", yFB(fb.pct)).style("opacity", 1);
    }
    if (dep) {
      hoverDotDep.attr("cx", xFB(year)).attr("cy", yDep(dep.ratio)).style("opacity", 1);
    }
    let html = `<div class="tt-label">${year}</div>`;
    if (fb) html += `<div class="tt-value" style="color:${C.orange}">Foreign-born: ${sobFmtPct(fb.pct)}</div>`;
    if (dep) html += `<div class="tt-value" style="color:${C.blue}">Dependency ratio: ${d3.format(".1f")(dep.ratio)}</div>
      <div class="tt-value" style="font-size:13px;color:${C.muted}">Old-age: ${d3.format(".1f")(dep.old)} | Young: ${d3.format(".1f")(dep.young)}</div>`;
    sobShowTooltip(html, event);
  }).on("mouseleave", function() {
    hoverLine3.style("opacity", 0); hoverDotFB.style("opacity", 0); hoverDotDep.style("opacity", 0);
    sobHideTooltip();
  });
  addTouchSupport(hoverRect3);
}

function updateDemographicsChart(step) {
  const svg = d3.select("#chart-demographics svg");
  if (step === 0) {
    svg.select(".pop-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
    svg.select(".fb-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".pop-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".fb-view").style("pointer-events", "all").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "brexit": updateBrexitChart(step); break;
    case "asylum": updateAsylumChart(step); break;
    case "demographics": updateDemographicsChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); }

})();
