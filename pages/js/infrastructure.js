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
   HELPERS
   ========================================================= */
function fmtBn(v) { return "\u00a3" + d3.format(".1f")(v) + "bn"; }



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/infrastructure.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big numbers
  const latestPothole = DATA.roads.potholes[DATA.roads.potholes.length - 1];
  document.getElementById("bn-potholes").textContent = "\u00a3" + latestPothole.backlogBn + "bn";

  const latestRail = DATA.rail.punctuality[DATA.rail.punctuality.length - 1];
  document.getElementById("bn-rail").textContent = latestRail.ppm + "%";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-hook svg, #chart-roads svg, #chart-rail svg, #chart-broadband svg, #chart-traffic svg, #chart-investment svg").remove();
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
  buildRoadsChart();
  buildRailChart();
  buildBroadbandChart();
  buildTrafficChart();
  buildInvestmentChart();
}

/* =========================================================
   CHART 1: THE HOOK — Pothole backlog + Rail punctuality
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing pothole repair backlog and rail punctuality trends");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- POTHOLE BACKLOG VIEW (step 0) ---
  const potholeGroup = g.append("g").attr("class", "pothole-view");
  const potholes = DATA.roads.potholes;

  const xP = d3.scaleLinear().domain(d3.extent(potholes, d => d.year)).range([0, dim.innerW]);
  const yP = d3.scaleLinear().domain([0, d3.max(potholes, d => d.backlogBn) * 1.15]).range([dim.innerH, 0]);

  // Grid
  potholeGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yP).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const pArea = d3.area().x(d => xP(d.year)).y0(dim.innerH).y1(d => yP(d.backlogBn)).curve(d3.curveMonotoneX);
  potholeGroup.append("path").datum(potholes)
    .attr("d", pArea).attr("fill", C.amberLight);

  // Line
  const pLine = d3.line().x(d => xP(d.year)).y(d => yP(d.backlogBn)).curve(d3.curveMonotoneX);
  potholeGroup.append("path").datum(potholes)
    .attr("d", pLine).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5);

  // Axes
  potholeGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xP).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  potholeGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yP).ticks(6).tickFormat(d => "\u00a3" + d + "bn").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Start annotation
  const first = potholes[0];
  potholeGroup.append("circle").attr("cx", xP(first.year)).attr("cy", yP(first.backlogBn)).attr("r", 4)
    .attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
  potholeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xP(first.year) + 10).attr("y", yP(first.backlogBn) + 16).attr("fill", C.amber)
    .text("\u00a3" + first.backlogBn + "bn");
  potholeGroup.append("line")
    .attr("x1", xP(first.year) + 6).attr("x2", xP(first.year) + 10)
    .attr("y1", yP(first.backlogBn) + 4).attr("y2", yP(first.backlogBn) + 8)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // End annotation
  const last = potholes[potholes.length - 1];
  potholeGroup.append("circle").attr("cx", xP(last.year)).attr("cy", yP(last.backlogBn)).attr("r", 4)
    .attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
  potholeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xP(last.year) - 10).attr("y", yP(last.backlogBn) - 20).attr("text-anchor", "end").attr("fill", C.amber)
    .text("\u00a3" + last.backlogBn + "bn");
  potholeGroup.append("line")
    .attr("x1", xP(last.year) - 4).attr("x2", xP(last.year) - 8)
    .attr("y1", yP(last.backlogBn) - 6).attr("y2", yP(last.backlogBn) - 14)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Title
  potholeGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Road repair backlog (\u00a3 billions)");

  // Hover
  const hoverRect = potholeGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = potholeGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = potholeGroup.append("circle").attr("r", 4).attr("fill", C.amber).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xP.invert(mx));
    const d = potholes.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xP(year)).attr("x2", xP(year)).style("opacity", 1);
    hoverDot.attr("cx", xP(year)).attr("cy", yP(d.backlogBn)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value">Backlog: \u00a3${d.backlogBn}bn</div>
      <div class="tt-value">Potholes filled: ${d.filled}m</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // --- RAIL PUNCTUALITY VIEW (step 1, hidden) ---
  const railGroup = g.append("g").attr("class", "rail-hook-view").style("opacity", 0);
  const punct = DATA.rail.punctuality;

  const xR = d3.scaleLinear().domain(d3.extent(punct, d => d.year)).range([0, dim.innerW]);
  const yR = d3.scaleLinear().domain([75, 95]).range([dim.innerH, 0]);

  // Grid
  railGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yR).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const rArea = d3.area().x(d => xR(d.year)).y0(dim.innerH).y1(d => yR(d.ppm)).curve(d3.curveMonotoneX);
  railGroup.append("path").datum(punct)
    .attr("d", rArea).attr("fill", C.primaryLight);

  // Line
  const rLine = d3.line().x(d => xR(d.year)).y(d => yR(d.ppm)).curve(d3.curveMonotoneX);
  railGroup.append("path").datum(punct)
    .attr("d", rLine).attr("fill", "none").attr("stroke", C.primary).attr("stroke-width", 2.5);

  // Axes
  railGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xR).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  railGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yR).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Peak annotation
  const peak = punct.reduce((a, b) => a.ppm > b.ppm ? a : b);
  railGroup.append("circle").attr("cx", xR(peak.year)).attr("cy", yR(peak.ppm)).attr("r", 4)
    .attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 2);
  railGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xR(peak.year) - 10).attr("y", yR(peak.ppm) - 18).attr("text-anchor", "end").attr("fill", C.green)
    .text("Peak: " + peak.ppm + "%");
  railGroup.append("line")
    .attr("x1", xR(peak.year) - 4).attr("x2", xR(peak.year) - 6)
    .attr("y1", yR(peak.ppm) - 6).attr("y2", yR(peak.ppm) - 12)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // COVID spike annotation
  const covid = punct.find(d => d.year === 2020);
  if (covid) {
    railGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xR(2020)).attr("y", yR(covid.ppm) - 26).attr("text-anchor", "middle").attr("fill", C.muted)
      .text("COVID (empty trains)");
    railGroup.append("line")
      .attr("x1", xR(2020)).attr("x2", xR(2020))
      .attr("y1", yR(covid.ppm) - 20).attr("y2", yR(covid.ppm) - 6)
      .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Latest annotation
  const lastR = punct[punct.length - 1];
  railGroup.append("circle").attr("cx", xR(lastR.year)).attr("cy", yR(lastR.ppm)).attr("r", 4)
    .attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
  railGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xR(lastR.year) + 10).attr("y", yR(lastR.ppm) + 18).attr("fill", C.amber)
    .text(lastR.ppm + "%");
  railGroup.append("line")
    .attr("x1", xR(lastR.year) + 6).attr("x2", xR(lastR.year) + 10)
    .attr("y1", yR(lastR.ppm) + 4).attr("y2", yR(lastR.ppm) + 10)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Title
  railGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Rail punctuality (% trains on time, PPM)");
  // Baseline flag for truncated y-axis
  railGroup.append("text").attr("class", "baseline-flag")
    .attr("x", 0).attr("y", dim.innerH + 40)
    .text("Y-axis starts at 75%, not zero");

  // Hover
  const hoverRect2 = railGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = railGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot2 = railGroup.append("circle").attr("r", 4).attr("fill", C.primary).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xR.invert(mx));
    const d = punct.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", xR(year)).attr("x2", xR(year)).style("opacity", 1);
    hoverDot2.attr("cx", xR(year)).attr("cy", yR(d.ppm)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}</div>
      <div class="tt-value">Punctuality: ${d.ppm}%</div>
      <div class="tt-value" style="color:${C.amber}">${(100 - d.ppm).toFixed(1)}% of trains late</div>`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot2.style("opacity", 0); sobHideTooltip();
  });
}

function updateHookChart(step) {
  const svg = d3.select("#chart-hook svg");
  if (step === 0) {
    svg.select(".pothole-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".rail-hook-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".pothole-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".rail-hook-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 2: ROADS — Condition + Potholes filled vs backlog
   ========================================================= */
function buildRoadsChart() {
  const container = document.getElementById("chart-roads");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing road condition and pothole repair data");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- ROAD CONDITION VIEW (step 0) ---
  const condGroup = g.append("g").attr("class", "condition-view");
  const cond = DATA.roads.condition;

  const xC = d3.scaleLinear().domain(d3.extent(cond, d => d.year)).range([0, dim.innerW]);
  const yC = d3.scaleLinear().domain([0, 22]).range([dim.innerH, 0]);

  // Grid
  condGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yC).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Lines for each road type
  const lineGen = (field) => d3.line().x(d => xC(d.year)).y(d => yC(d[field])).curve(d3.curveMonotoneX);

  const roadTypes = [
    { field: "unclassifiedPoor", label: "Unclassified", color: C.amber },
    { field: "bAndcPoor", label: "B & C roads", color: C.secondary },
    { field: "aRoadsPoor", label: "A roads", color: C.primary }
  ];

  // Draw lines first, then labels with collision avoidance
  roadTypes.forEach(rt => {
    condGroup.append("path").datum(cond)
      .attr("d", lineGen(rt.field)).attr("fill", "none").attr("stroke", rt.color).attr("stroke-width", 2.5);
  });

  // Collect end-label positions and offset to avoid overlap
  const endLabels = roadTypes.map(rt => {
    const lastVal = cond[cond.length - 1][rt.field];
    return { ...rt, lastVal, yPos: yC(lastVal) };
  });
  // Sort by y position (top to bottom)
  endLabels.sort((a, b) => a.yPos - b.yPos);
  // Ensure minimum 18px vertical gap between labels
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].yPos - endLabels[i - 1].yPos < 18) {
      endLabels[i].yPos = endLabels[i - 1].yPos + 18;
    }
  }

  endLabels.forEach(rt => {
    const lastYear = cond[cond.length - 1].year;
    const dataY = yC(rt.lastVal);

    // Dot at end
    condGroup.append("circle")
      .attr("cx", xC(lastYear)).attr("cy", dataY).attr("r", 4)
      .attr("fill", rt.color).attr("stroke", "#fff").attr("stroke-width", 2);

    // Leader line from dot to label if offset
    if (Math.abs(rt.yPos - dataY) > 4) {
      condGroup.append("line")
        .attr("x1", xC(lastYear) + 6).attr("x2", xC(lastYear) + 10)
        .attr("y1", dataY).attr("y2", rt.yPos)
        .attr("stroke", rt.color).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
    }

    // End label with 10px horizontal padding from dot
    condGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", xC(lastYear) + 10)
      .attr("y", rt.yPos + 4)
      .attr("fill", rt.color)
      .text(rt.label + " " + rt.lastVal + "%");
  });

  // Axes
  condGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xC).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  condGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yC).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  condGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Roads in poor condition (% requiring maintenance)");

  // Hover
  const hoverRect = condGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = condGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xC.invert(mx));
    const d = cond.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xC(year)).attr("x2", xC(year)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value" style="color:${C.amber}">Unclassified: ${d.unclassifiedPoor}% poor</div>
      <div class="tt-value" style="color:${C.secondary}">B & C roads: ${d.bAndcPoor}% poor</div>
      <div class="tt-value" style="color:${C.primary}">A roads: ${d.aRoadsPoor}% poor</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); sobHideTooltip();
  });

  // --- POTHOLE FILLED VS BACKLOG VIEW (step 1, hidden) ---
  const potGroup = g.append("g").attr("class", "pothole-detail-view").style("opacity", 0);
  const potholes = DATA.roads.potholes;

  const xPot = d3.scaleBand().domain(potholes.map(d => d.year)).range([0, dim.innerW]).padding(0.2);
  const yPotL = d3.scaleLinear().domain([0, d3.max(potholes, d => d.backlogBn) * 1.15]).range([dim.innerH, 0]);
  const yPotR = d3.scaleLinear().domain([0, d3.max(potholes, d => d.filled) * 1.15]).range([dim.innerH, 0]);

  // Grid
  potGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yPotL).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Bars for potholes filled
  potGroup.selectAll(".pot-bar").data(potholes).enter()
    .append("rect").attr("class", "pot-bar")
    .attr("x", d => xPot(d.year)).attr("y", d => yPotR(d.filled))
    .attr("width", xPot.bandwidth()).attr("height", d => dim.innerH - yPotR(d.filled))
    .attr("fill", C.primary).attr("rx", 2).attr("opacity", 0.85);

  // Line for backlog
  const backlogLine = d3.line()
    .x(d => xPot(d.year) + xPot.bandwidth() / 2)
    .y(d => yPotL(d.backlogBn))
    .curve(d3.curveMonotoneX);
  potGroup.append("path").datum(potholes)
    .attr("d", backlogLine).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5);

  // Dots on backlog line
  potGroup.selectAll(".backlog-dot").data(potholes).enter()
    .append("circle").attr("class", "backlog-dot")
    .attr("cx", d => xPot(d.year) + xPot.bandwidth() / 2)
    .attr("cy", d => yPotL(d.backlogBn))
    .attr("r", 3).attr("fill", C.amber);

  // Axes
  potGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xPot).tickFormat(d => "'" + String(d).slice(2)).tickSize(0))
    .call(g => g.select(".domain").remove());
  potGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yPotL).ticks(6).tickFormat(d => "\u00a3" + d + "bn").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Right axis for filled
  potGroup.append("g").attr("class", "axis y-axis-right")
    .attr("transform", `translate(${dim.innerW},0)`)
    .call(d3.axisRight(yPotR).ticks(5).tickFormat(d => d + "m").tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", C.primary);

  // Legend
  potGroup.append("line").attr("x1", dim.innerW - 160).attr("x2", dim.innerW - 130)
    .attr("y1", -10).attr("y2", -10).attr("stroke", C.amber).attr("stroke-width", 2.5);
  potGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW - 126).attr("y", -6).attr("fill", C.amber).text("Backlog (\u00a3bn)");

  potGroup.append("rect").attr("x", dim.innerW - 310).attr("y", -16).attr("width", 12).attr("height", 12)
    .attr("fill", C.primary).attr("rx", 2).attr("opacity", 0.85);
  potGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW - 294).attr("y", -6).attr("fill", C.primary).text("Potholes filled (millions)");

  // Dual-axis warning
  potGroup.append("text").attr("class", "baseline-flag")
    .attr("x", 0).attr("y", dim.innerH + 40)
    .text("Caution: left and right axes use independent scales");

  // Hover
  potGroup.selectAll(".pot-bar")
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value" style="color:${C.primary}">Potholes filled: ${d.filled}m</div>
        <div class="tt-value" style="color:${C.amber}">Repair backlog: \u00a3${d.backlogBn}bn</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);
}

function updateRoadsChart(step) {
  const svg = d3.select("#chart-roads svg");
  if (step === 0) {
    svg.select(".condition-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".pothole-detail-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".condition-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".pothole-detail-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 3: RAIL — Punctuality line + Journeys
   ========================================================= */
function buildRailChart() {
  const container = document.getElementById("chart-rail");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing rail punctuality and passenger journey trends");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- PUNCTUALITY VIEW (step 0) ---
  const punctGroup = g.append("g").attr("class", "punct-view");
  const punct = DATA.rail.punctuality;

  const xP = d3.scaleLinear().domain(d3.extent(punct, d => d.year)).range([0, dim.innerW]);
  const yP = d3.scaleLinear().domain([75, 95]).range([dim.innerH, 0]);

  // Grid
  punctGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yP).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Shaded area below the "good" threshold at 90%
  punctGroup.append("rect")
    .attr("x", 0).attr("y", yP(90)).attr("width", dim.innerW).attr("height", dim.innerH - yP(90))
    .attr("fill", C.amberLight).attr("opacity", 0.4);
  punctGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW - 4).attr("y", yP(90) - 8).attr("text-anchor", "end").attr("fill", C.amber)
    .text("90% target");

  // Line
  const pLine = d3.line().x(d => xP(d.year)).y(d => yP(d.ppm)).curve(d3.curveMonotoneX);
  punctGroup.append("path").datum(punct)
    .attr("d", pLine).attr("fill", "none").attr("stroke", C.primary).attr("stroke-width", 2.5);

  // Peak annotation
  const peak = punct.reduce((a, b) => (a.ppm > b.ppm && a.year !== 2020) ? a : b);
  const realPeak = punct.filter(d => d.year !== 2020).reduce((a, b) => a.ppm > b.ppm ? a : b);
  punctGroup.append("circle").attr("cx", xP(realPeak.year)).attr("cy", yP(realPeak.ppm)).attr("r", 4)
    .attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 2);
  punctGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xP(realPeak.year)).attr("y", yP(realPeak.ppm) - 22).attr("text-anchor", "middle").attr("fill", C.green)
    .text(realPeak.ppm + "% (" + realPeak.fy + ")");
  punctGroup.append("line")
    .attr("x1", xP(realPeak.year)).attr("x2", xP(realPeak.year))
    .attr("y1", yP(realPeak.ppm) - 16).attr("y2", yP(realPeak.ppm) - 6)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // COVID annotation
  const covid = punct.find(d => d.year === 2020);
  if (covid) {
    punctGroup.append("circle").attr("cx", xP(2020)).attr("cy", yP(covid.ppm)).attr("r", 3)
      .attr("fill", C.muted).attr("stroke", "#fff").attr("stroke-width", 2);
    punctGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xP(2020) + 10).attr("y", yP(covid.ppm) - 18).attr("fill", C.muted)
      .text("COVID");
    punctGroup.append("line")
      .attr("x1", xP(2020) + 4).attr("x2", xP(2020) + 6)
      .attr("y1", yP(covid.ppm) - 4).attr("y2", yP(covid.ppm) - 12)
      .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Hatfield rail crash low
  const hatfield = punct.find(d => d.year === 2001);
  if (hatfield) {
    punctGroup.append("circle").attr("cx", xP(hatfield.year)).attr("cy", yP(hatfield.ppm)).attr("r", 3)
      .attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
    punctGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xP(hatfield.year)).attr("y", yP(hatfield.ppm) + 28).attr("text-anchor", "middle").attr("fill", C.amber)
      .text("Post-Hatfield");
    punctGroup.append("line")
      .attr("x1", xP(hatfield.year)).attr("x2", xP(hatfield.year))
      .attr("y1", yP(hatfield.ppm) + 6).attr("y2", yP(hatfield.ppm) + 20)
      .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Latest
  const lastP = punct[punct.length - 1];
  punctGroup.append("circle").attr("cx", xP(lastP.year)).attr("cy", yP(lastP.ppm)).attr("r", 4)
    .attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
  punctGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xP(lastP.year) + 10).attr("y", yP(lastP.ppm) + 18).attr("fill", C.amber)
    .text(lastP.ppm + "%");
  punctGroup.append("line")
    .attr("x1", xP(lastP.year) + 6).attr("x2", xP(lastP.year) + 10)
    .attr("y1", yP(lastP.ppm) + 4).attr("y2", yP(lastP.ppm) + 10)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Axes
  punctGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xP).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  punctGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yP).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  punctGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Public Performance Measure (% on time)");
  // Baseline flag for truncated y-axis
  punctGroup.append("text").attr("class", "baseline-flag")
    .attr("x", 0).attr("y", dim.innerH + 40)
    .text("Y-axis starts at 75%, not zero");

  // Hover
  const hoverRect = punctGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = punctGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = punctGroup.append("circle").attr("r", 4).attr("fill", C.primary).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xP.invert(mx));
    const d = punct.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xP(year)).attr("x2", xP(year)).style("opacity", 1);
    hoverDot.attr("cx", xP(year)).attr("cy", yP(d.ppm)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}</div>
      <div class="tt-value">On time: ${d.ppm}%</div>
      <div class="tt-value" style="color:${C.amber}">Late: ${(100 - d.ppm).toFixed(1)}%</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // --- JOURNEYS VIEW (step 1, hidden) ---
  const journeyGroup = g.append("g").attr("class", "journey-view").style("opacity", 0);
  const journeys = DATA.rail.journeys;

  const xJ = d3.scaleLinear().domain(d3.extent(journeys, d => d.year)).range([0, dim.innerW]);
  const yJ = d3.scaleLinear().domain([0, d3.max(journeys, d => d.journeysMn) * 1.1]).range([dim.innerH, 0]);

  // Grid
  journeyGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yJ).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const jArea = d3.area().x(d => xJ(d.year)).y0(dim.innerH).y1(d => yJ(d.journeysMn)).curve(d3.curveMonotoneX);
  journeyGroup.append("path").datum(journeys)
    .attr("d", jArea).attr("fill", C.primaryLight);

  // Line
  const jLine = d3.line().x(d => xJ(d.year)).y(d => yJ(d.journeysMn)).curve(d3.curveMonotoneX);
  journeyGroup.append("path").datum(journeys)
    .attr("d", jLine).attr("fill", "none").attr("stroke", C.primary).attr("stroke-width", 2.5);

  // COVID dip annotation
  const covidJ = journeys.find(d => d.year === 2020);
  if (covidJ) {
    journeyGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xJ(2020)).attr("y", yJ(covidJ.journeysMn) - 28).attr("text-anchor", "middle").attr("fill", C.muted)
      .text("COVID: " + Math.round(covidJ.journeysMn) + "m");
    journeyGroup.append("line")
      .attr("x1", xJ(2020)).attr("x2", xJ(2020))
      .attr("y1", yJ(covidJ.journeysMn) - 22).attr("y2", yJ(covidJ.journeysMn) - 6)
      .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Pre-COVID peak
  const preCovid = journeys.filter(d => d.year < 2020).reduce((a, b) => a.journeysMn > b.journeysMn ? a : b);
  journeyGroup.append("circle").attr("cx", xJ(preCovid.year)).attr("cy", yJ(preCovid.journeysMn)).attr("r", 4)
    .attr("fill", C.primary).attr("stroke", "#fff").attr("stroke-width", 2);
  journeyGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xJ(preCovid.year) - 10).attr("y", yJ(preCovid.journeysMn) - 22).attr("text-anchor", "end").attr("fill", C.primary)
    .text("Peak: " + d3.format(",")(Math.round(preCovid.journeysMn)) + "m");
  journeyGroup.append("line")
    .attr("x1", xJ(preCovid.year) - 4).attr("x2", xJ(preCovid.year) - 6)
    .attr("y1", yJ(preCovid.journeysMn) - 6).attr("y2", yJ(preCovid.journeysMn) - 14)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Latest
  const lastJ = journeys[journeys.length - 1];
  journeyGroup.append("circle").attr("cx", xJ(lastJ.year)).attr("cy", yJ(lastJ.journeysMn)).attr("r", 4)
    .attr("fill", C.primary).attr("stroke", "#fff").attr("stroke-width", 2);
  journeyGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xJ(lastJ.year) + 10).attr("y", yJ(lastJ.journeysMn) + 18).attr("fill", C.primary)
    .text(d3.format(",")(Math.round(lastJ.journeysMn)) + "m");
  journeyGroup.append("line")
    .attr("x1", xJ(lastJ.year) + 6).attr("x2", xJ(lastJ.year) + 10)
    .attr("y1", yJ(lastJ.journeysMn) + 4).attr("y2", yJ(lastJ.journeysMn) + 10)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Axes
  journeyGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xJ).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  journeyGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yJ).ticks(6).tickFormat(d => d3.format(",")(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  journeyGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Rail journeys per year (millions)");

  // Hover
  const hoverRect2 = journeyGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = journeyGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot2 = journeyGroup.append("circle").attr("r", 4).attr("fill", C.primary).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xJ.invert(mx));
    const d = journeys.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", xJ(year)).attr("x2", xJ(year)).style("opacity", 1);
    hoverDot2.attr("cx", xJ(year)).attr("cy", yJ(d.journeysMn)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.fy}</div>
      <div class="tt-value">Journeys: ${d3.format(",")(Math.round(d.journeysMn))} million</div>`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot2.style("opacity", 0); sobHideTooltip();
  });
}

function updateRailChart(step) {
  const svg = d3.select("#chart-rail svg");
  if (step === 0) {
    svg.select(".punct-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".journey-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".punct-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".journey-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 4: BROADBAND — FTTP + Speeds
   ========================================================= */
function buildBroadbandChart() {
  const container = document.getElementById("chart-broadband");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing broadband coverage and speed trends");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- FTTP + GIGABIT VIEW (step 0) ---
  const fibreGroup = g.append("g").attr("class", "fibre-view");
  const fttp = DATA.broadband.fttp;
  const gigabit = DATA.broadband.gigabit;

  const xF = d3.scaleLinear().domain([2018, 2025]).range([0, dim.innerW]);
  const yF = d3.scaleLinear().domain([0, 100]).range([dim.innerH, 0]);

  // Grid
  fibreGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yF).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // FTTP area
  const fttpArea = d3.area().x(d => xF(d.year)).y0(dim.innerH).y1(d => yF(d.pct)).curve(d3.curveMonotoneX);
  fibreGroup.append("path").datum(fttp)
    .attr("d", fttpArea).attr("fill", C.greenLight);

  // FTTP line
  const fttpLine = d3.line().x(d => xF(d.year)).y(d => yF(d.pct)).curve(d3.curveMonotoneX);
  fibreGroup.append("path").datum(fttp)
    .attr("d", fttpLine).attr("fill", "none").attr("stroke", C.green).attr("stroke-width", 2.5);

  // Gigabit line
  const gigLine = d3.line().x(d => xF(d.year)).y(d => yF(d.pct)).curve(d3.curveMonotoneX);
  fibreGroup.append("path").datum(gigabit)
    .attr("d", gigLine).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // FTTP end labels
  const lastFTTP = fttp[fttp.length - 1];
  fibreGroup.append("circle").attr("cx", xF(lastFTTP.year)).attr("cy", yF(lastFTTP.pct)).attr("r", 4)
    .attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 2);
  fibreGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xF(lastFTTP.year) + 10).attr("y", yF(lastFTTP.pct) + 18).attr("fill", C.green)
    .text("FTTP: " + lastFTTP.pct + "%");
  fibreGroup.append("line")
    .attr("x1", xF(lastFTTP.year) + 6).attr("x2", xF(lastFTTP.year) + 10)
    .attr("y1", yF(lastFTTP.pct) + 4).attr("y2", yF(lastFTTP.pct) + 10)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Gigabit end labels
  const lastGig = gigabit[gigabit.length - 1];
  fibreGroup.append("circle").attr("cx", xF(lastGig.year)).attr("cy", yF(lastGig.pct)).attr("r", 4)
    .attr("fill", C.blue).attr("stroke", "#fff").attr("stroke-width", 2);
  fibreGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xF(lastGig.year) + 10).attr("y", yF(lastGig.pct) - 10).attr("fill", C.blue)
    .text("Gigabit: " + lastGig.pct + "%");
  fibreGroup.append("line")
    .attr("x1", xF(lastGig.year) + 6).attr("x2", xF(lastGig.year) + 10)
    .attr("y1", yF(lastGig.pct) - 4).attr("y2", yF(lastGig.pct) - 6)
    .attr("stroke", C.blue).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Start labels
  const firstFTTP = fttp[0];
  fibreGroup.append("circle").attr("cx", xF(firstFTTP.year)).attr("cy", yF(firstFTTP.pct)).attr("r", 4)
    .attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 2);
  fibreGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xF(firstFTTP.year) + 10).attr("y", yF(firstFTTP.pct) + 22).attr("fill", C.green)
    .text(firstFTTP.pct + "%");
  fibreGroup.append("line")
    .attr("x1", xF(firstFTTP.year) + 6).attr("x2", xF(firstFTTP.year) + 10)
    .attr("y1", yF(firstFTTP.pct) + 6).attr("y2", yF(firstFTTP.pct) + 14)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Axes
  fibreGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xF).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  fibreGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yF).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  fibreGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("UK premises coverage (%)");

  // Hover
  const hoverRect = fibreGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = fibreGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotF = fibreGroup.append("circle").attr("r", 4).attr("fill", C.green).style("opacity", 0);
  const hoverDotG = fibreGroup.append("circle").attr("r", 4).attr("fill", C.blue).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xF.invert(mx));
    const df = fttp.find(a => a.year === year);
    const dg = gigabit.find(a => a.year === year);
    if (!df && !dg) return;
    hoverLine.attr("x1", xF(year)).attr("x2", xF(year)).style("opacity", 1);
    if (df) { hoverDotF.attr("cx", xF(year)).attr("cy", yF(df.pct)).style("opacity", 1); }
    if (dg) { hoverDotG.attr("cx", xF(year)).attr("cy", yF(dg.pct)).style("opacity", 1); }
    let html = `<div class="tt-label">${year}</div>`;
    if (df) html += `<div class="tt-value" style="color:${C.green}">FTTP: ${df.pct}% (${df.premises}m premises)</div>`;
    if (dg) html += `<div class="tt-value" style="color:${C.blue}">Gigabit: ${dg.pct}%</div>`;
    sobShowTooltip(html, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDotF.style("opacity", 0); hoverDotG.style("opacity", 0); sobHideTooltip();
  });

  // --- SPEEDS VIEW (step 1, hidden) ---
  const speedGroup = g.append("g").attr("class", "speed-view").style("opacity", 0);
  const speeds = DATA.broadband.speeds;

  const xS = d3.scaleLinear().domain(d3.extent(speeds, d => d.year)).range([0, dim.innerW]);
  const yS = d3.scaleLinear().domain([0, d3.max(speeds, d => d.medianDown) * 1.2]).range([dim.innerH, 0]);

  // Grid
  speedGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yS).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Download area
  const dlArea = d3.area().x(d => xS(d.year)).y0(dim.innerH).y1(d => yS(d.medianDown)).curve(d3.curveMonotoneX);
  speedGroup.append("path").datum(speeds)
    .attr("d", dlArea).attr("fill", C.primaryLight);

  // Download line
  const dlLine = d3.line().x(d => xS(d.year)).y(d => yS(d.medianDown)).curve(d3.curveMonotoneX);
  speedGroup.append("path").datum(speeds)
    .attr("d", dlLine).attr("fill", "none").attr("stroke", C.primary).attr("stroke-width", 2.5);

  // Upload line
  const ulLine = d3.line().x(d => xS(d.year)).y(d => yS(d.medianUp)).curve(d3.curveMonotoneX);
  speedGroup.append("path").datum(speeds)
    .attr("d", ulLine).attr("fill", "none").attr("stroke", C.secondary).attr("stroke-width", 2)
    .attr("stroke-dasharray", "6,4");

  // End labels
  const lastSpeed = speeds[speeds.length - 1];
  speedGroup.append("circle").attr("cx", xS(lastSpeed.year)).attr("cy", yS(lastSpeed.medianDown)).attr("r", 4)
    .attr("fill", C.primary).attr("stroke", "#fff").attr("stroke-width", 2);
  speedGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xS(lastSpeed.year) + 10).attr("y", yS(lastSpeed.medianDown) - 10).attr("fill", C.primary)
    .text("Download: " + lastSpeed.medianDown + " Mbps");
  speedGroup.append("line")
    .attr("x1", xS(lastSpeed.year) + 6).attr("x2", xS(lastSpeed.year) + 10)
    .attr("y1", yS(lastSpeed.medianDown) - 4).attr("y2", yS(lastSpeed.medianDown) - 6)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  speedGroup.append("circle").attr("cx", xS(lastSpeed.year)).attr("cy", yS(lastSpeed.medianUp)).attr("r", 4)
    .attr("fill", C.secondary).attr("stroke", "#fff").attr("stroke-width", 2);
  speedGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xS(lastSpeed.year) + 10).attr("y", yS(lastSpeed.medianUp) + 18).attr("fill", C.secondary)
    .text("Upload: " + lastSpeed.medianUp + " Mbps");
  speedGroup.append("line")
    .attr("x1", xS(lastSpeed.year) + 6).attr("x2", xS(lastSpeed.year) + 10)
    .attr("y1", yS(lastSpeed.medianUp) + 4).attr("y2", yS(lastSpeed.medianUp) + 10)
    .attr("stroke", C.secondary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Start labels
  const firstSpeed = speeds[0];
  speedGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xS(firstSpeed.year) - 10).attr("y", yS(firstSpeed.medianDown) - 12).attr("text-anchor", "end").attr("fill", C.primary)
    .text(firstSpeed.medianDown + " Mbps");
  speedGroup.append("line")
    .attr("x1", xS(firstSpeed.year) - 4).attr("x2", xS(firstSpeed.year) - 6)
    .attr("y1", yS(firstSpeed.medianDown) - 4).attr("y2", yS(firstSpeed.medianDown) - 8)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  speedGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xS(firstSpeed.year) - 10).attr("y", yS(firstSpeed.medianUp) + 18).attr("text-anchor", "end").attr("fill", C.secondary)
    .text(firstSpeed.medianUp + " Mbps");
  speedGroup.append("line")
    .attr("x1", xS(firstSpeed.year) - 4).attr("x2", xS(firstSpeed.year) - 6)
    .attr("y1", yS(firstSpeed.medianUp) + 6).attr("y2", yS(firstSpeed.medianUp) + 10)
    .attr("stroke", C.secondary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Axes
  speedGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xS).ticks(6).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  speedGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yS).ticks(6).tickFormat(d => d3.format(",")(d) + " Mbps").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  speedGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Median broadband speeds (Mbps)");

  // Hover
  const hoverRect2 = speedGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = speedGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDotD = speedGroup.append("circle").attr("r", 4).attr("fill", C.primary).style("opacity", 0);
  const hoverDotU = speedGroup.append("circle").attr("r", 4).attr("fill", C.secondary).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xS.invert(mx));
    const d = speeds.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", xS(year)).attr("x2", xS(year)).style("opacity", 1);
    hoverDotD.attr("cx", xS(year)).attr("cy", yS(d.medianDown)).style("opacity", 1);
    hoverDotU.attr("cx", xS(year)).attr("cy", yS(d.medianUp)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${year}</div>
      <div class="tt-value" style="color:${C.primary}">Download: ${d.medianDown} Mbps</div>
      <div class="tt-value" style="color:${C.secondary}">Upload: ${d.medianUp} Mbps</div>`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDotD.style("opacity", 0); hoverDotU.style("opacity", 0); sobHideTooltip();
  });
}

function updateBroadbandChart(step) {
  const svg = d3.select("#chart-broadband svg");
  if (step === 0) {
    svg.select(".fibre-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".speed-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".fibre-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".speed-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 5: TRAFFIC — Total traffic + Road length
   ========================================================= */
function buildTrafficChart() {
  const container = document.getElementById("chart-traffic");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing road traffic volume and road network length");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- TRAFFIC VOLUME VIEW (step 0) ---
  const trafficGroup = g.append("g").attr("class", "traffic-view");
  const traffic = DATA.roads.traffic;

  const xT = d3.scaleLinear().domain(d3.extent(traffic, d => d.year)).range([0, dim.innerW]);
  const yT = d3.scaleLinear().domain([0, d3.max(traffic, d => d.totalBnMiles) * 1.1]).range([dim.innerH, 0]);

  // Grid
  trafficGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yT).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Stacked area for vehicle types
  const stack = d3.stack().keys(["cars", "lcvs", "hgvs", "buses"]);
  const stackedData = stack(traffic);
  const stackColors = [C.primary, C.secondary, C.amber, C.faint];
  const stackLabels = ["Cars", "Light vans", "HGVs", "Buses & coaches"];

  const areaGen = d3.area()
    .x(d => xT(d.data.year))
    .y0(d => yT(d[0]))
    .y1(d => yT(d[1]))
    .curve(d3.curveMonotoneX);

  stackedData.forEach((layer, i) => {
    trafficGroup.append("path").datum(layer)
      .attr("d", areaGen).attr("fill", stackColors[i]).attr("opacity", 0.82);
  });

  // Total line on top
  const totalLine = d3.line().x(d => xT(d.year)).y(d => yT(d.totalBnMiles)).curve(d3.curveMonotoneX);
  trafficGroup.append("path").datum(traffic)
    .attr("d", totalLine).attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 2);

  // COVID annotation
  const covidT = traffic.find(d => d.year === 2020);
  trafficGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xT(2020)).attr("y", yT(covidT.totalBnMiles) - 28).attr("text-anchor", "middle").attr("fill", C.muted)
    .text("COVID");
  trafficGroup.append("line")
    .attr("x1", xT(2020)).attr("x2", xT(2020))
    .attr("y1", yT(covidT.totalBnMiles) - 22).attr("y2", yT(covidT.totalBnMiles) - 6)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Latest total
  const lastT = traffic[traffic.length - 1];
  trafficGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xT(lastT.year) + 10).attr("y", yT(lastT.totalBnMiles) - 12).attr("fill", C.ink)
    .text(d3.format(".1f")(lastT.totalBnMiles) + "bn miles");
  trafficGroup.append("line")
    .attr("x1", xT(lastT.year) + 4).attr("x2", xT(lastT.year) + 8)
    .attr("y1", yT(lastT.totalBnMiles) - 4).attr("y2", yT(lastT.totalBnMiles) - 8)
    .attr("stroke", C.ink).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Legend
  stackLabels.forEach((label, i) => {
    const lx = sobIsMobile() ? (i % 2) * 140 : i * 110;
    const ly = sobIsMobile() ? Math.floor(i / 2) * 18 : 0;
    trafficGroup.append("rect").attr("x", lx).attr("y", dim.innerH + 22 + ly).attr("width", 12).attr("height", 12)
      .attr("fill", stackColors[i]).attr("opacity", 0.82).attr("rx", 2);
    trafficGroup.append("text").attr("class", "chart-annotation")
      .attr("x", lx + 16).attr("y", dim.innerH + 32 + ly).attr("fill", C.muted).text(label);
  });

  // Axes
  trafficGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xT).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  trafficGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yT).ticks(6).tickFormat(d3.format(",")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  trafficGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Road traffic (billion vehicle miles)");

  // Hover
  const hoverRect = trafficGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = trafficGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xT.invert(mx));
    const d = traffic.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xT(year)).attr("x2", xT(year)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value"><strong>Total: ${d3.format(".1f")(d.totalBnMiles)}bn miles</strong></div>
      <div class="tt-value" style="color:${C.primary}">Cars: ${d3.format(".1f")(d.cars)}bn</div>
      <div class="tt-value" style="color:${C.secondary}">Vans: ${d3.format(".1f")(d.lcvs)}bn</div>
      <div class="tt-value" style="color:${C.amber}">HGVs: ${d3.format(".1f")(d.hgvs)}bn</div>
      <div class="tt-value" style="color:${C.faint}">Buses: ${d3.format(".1f")(d.buses)}bn</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); sobHideTooltip();
  });

  // --- ROAD LENGTH VIEW (step 1, hidden) ---
  const lengthGroup = g.append("g").attr("class", "length-view").style("opacity", 0);
  const roads = DATA.roads.length;
  // Filter to 2000+ to match traffic data
  const roadsFrom2000 = roads.filter(d => d.year >= 2000);

  const xL = d3.scaleLinear().domain([2000, 2025]).range([0, dim.innerW]);
  const yL = d3.scaleLinear().domain([49000, 52500]).range([dim.innerH, 0]);

  // Separate traffic index line (normalised to 2000)
  const traffic2000 = traffic.find(d => d.year === 2000);
  const trafficFrom2000 = traffic.filter(d => d.year >= 2000);
  const yIdx = d3.scaleLinear().domain([70, 120]).range([dim.innerH, 0]);

  // Grid
  lengthGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yL).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Road length line
  const roadLenLine = d3.line().x(d => xL(d.year)).y(d => yL(d.allMajorKm)).curve(d3.curveMonotoneX);
  lengthGroup.append("path").datum(roadsFrom2000)
    .attr("d", roadLenLine).attr("fill", "none").attr("stroke", C.primary).attr("stroke-width", 2.5);

  // Traffic index line
  const trafficIdxLine = d3.line()
    .x(d => xL(d.year))
    .y(d => yIdx(d.totalBnMiles / traffic2000.totalBnMiles * 100))
    .curve(d3.curveMonotoneX);
  lengthGroup.append("path").datum(trafficFrom2000)
    .attr("d", trafficIdxLine).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // End labels
  const lastRoad = roadsFrom2000[roadsFrom2000.length - 1];
  lengthGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xL(lastRoad.year) + 10).attr("y", yL(lastRoad.allMajorKm) + 18).attr("fill", C.primary)
    .text(d3.format(",")(lastRoad.allMajorKm) + " km");
  lengthGroup.append("line")
    .attr("x1", xL(lastRoad.year) + 6).attr("x2", xL(lastRoad.year) + 10)
    .attr("y1", yL(lastRoad.allMajorKm) + 4).attr("y2", yL(lastRoad.allMajorKm) + 10)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  const lastTraffic2 = trafficFrom2000[trafficFrom2000.length - 1];
  const lastIdx = (lastTraffic2.totalBnMiles / traffic2000.totalBnMiles * 100);
  lengthGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xL(lastTraffic2.year) + 10)
    .attr("y", yIdx(lastIdx) - 10).attr("fill", C.amber)
    .text("Traffic +" + Math.round(lastIdx - 100) + "%");
  lengthGroup.append("line")
    .attr("x1", xL(lastTraffic2.year) + 6).attr("x2", xL(lastTraffic2.year) + 10)
    .attr("y1", yIdx(lastIdx) - 4).attr("y2", yIdx(lastIdx) - 6)
    .attr("stroke", C.amber).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Start labels
  const firstRoad = roadsFrom2000[0];
  lengthGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xL(firstRoad.year) - 10).attr("y", yL(firstRoad.allMajorKm) - 12).attr("text-anchor", "end").attr("fill", C.primary)
    .text(d3.format(",")(firstRoad.allMajorKm) + " km");
  lengthGroup.append("line")
    .attr("x1", xL(firstRoad.year) - 4).attr("x2", xL(firstRoad.year) - 6)
    .attr("y1", yL(firstRoad.allMajorKm) - 4).attr("y2", yL(firstRoad.allMajorKm) - 8)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Title
  lengthGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -26).attr("fill", C.ink)
    .text("Major road network (km) vs traffic index");
  // Baseline flag for truncated y-axis
  lengthGroup.append("text").attr("class", "baseline-flag")
    .attr("x", 0).attr("y", dim.innerH + 40)
    .text("Y-axis starts at 49,000 km, not zero");

  // Legend
  lengthGroup.append("line").attr("x1", 0).attr("x2", 30).attr("y1", -10).attr("y2", -10)
    .attr("stroke", C.primary).attr("stroke-width", 2.5);
  lengthGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 34).attr("y", -6).attr("fill", C.primary).text("Major road network (km)");

  lengthGroup.append("line").attr("x1", sobIsMobile() ? 0 : 220).attr("x2", sobIsMobile() ? 30 : 250)
    .attr("y1", sobIsMobile() ? 4 : -10).attr("y2", sobIsMobile() ? 4 : -10)
    .attr("stroke", C.amber).attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
  lengthGroup.append("text").attr("class", "chart-annotation")
    .attr("x", sobIsMobile() ? 34 : 254).attr("y", sobIsMobile() ? 8 : -6).attr("fill", C.amber).text("Traffic index (2000 = 100)");

  // Axes
  lengthGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xL).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  lengthGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yL).ticks(6).tickFormat(d => d3.format(",")(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Hover
  const hoverRect2 = lengthGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = lengthGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xL.invert(mx));
    const dr = roadsFrom2000.find(a => a.year === year);
    const dt = trafficFrom2000.find(a => a.year === year);
    if (!dr && !dt) return;
    hoverLine2.attr("x1", xL(year)).attr("x2", xL(year)).style("opacity", 1);
    let html = `<div class="tt-label">${year}</div>`;
    if (dr) html += `<div class="tt-value" style="color:${C.primary}">Major roads: ${d3.format(",")(dr.allMajorKm)} km</div>
      <div class="tt-value" style="color:${C.primary}">Motorways: ${d3.format(",")(dr.motorwaysKm)} km</div>`;
    if (dt) html += `<div class="tt-value" style="color:${C.amber}">Traffic: ${d3.format(".1f")(dt.totalBnMiles)}bn miles</div>`;
    sobShowTooltip(html, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); sobHideTooltip();
  });
}

function updateTrafficChart(step) {
  const svg = d3.select("#chart-traffic svg");
  if (step === 0) {
    svg.select(".traffic-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".length-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".traffic-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".length-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 6: INVESTMENT — Rail electrification + Route km
   ========================================================= */
function buildInvestmentChart() {
  const container = document.getElementById("chart-investment");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Chart showing rail electrification and network size trends");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- ELECTRIFICATION VIEW (step 0) ---
  const electGroup = g.append("g").attr("class", "elect-view");
  const infra = DATA.rail.infrastructure;

  const xE = d3.scaleLinear().domain(d3.extent(infra, d => d.year)).range([0, dim.innerW]);

  // Electrified % of total
  const electPct = infra.map(d => ({ year: d.year, pct: d.electRouteKm / d.routeKm * 100, electKm: d.electRouteKm, routeKm: d.routeKm }));
  const yE = d3.scaleLinear().domain([0, 58]).range([dim.innerH, 0]);

  // Grid
  electGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yE).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const eArea = d3.area().x(d => xE(d.year)).y0(dim.innerH).y1(d => yE(d.pct)).curve(d3.curveMonotoneX);
  electGroup.append("path").datum(electPct)
    .attr("d", eArea).attr("fill", C.greenLight);

  // Line
  const eLine = d3.line().x(d => xE(d.year)).y(d => yE(d.pct)).curve(d3.curveMonotoneX);
  electGroup.append("path").datum(electPct)
    .attr("d", eLine).attr("fill", "none").attr("stroke", C.green).attr("stroke-width", 2.5);

  // Annotations
  const lastE = electPct[electPct.length - 1];
  electGroup.append("circle").attr("cx", xE(lastE.year)).attr("cy", yE(lastE.pct)).attr("r", 4)
    .attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 2);
  electGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xE(lastE.year) + 10).attr("y", yE(lastE.pct) + 18).attr("fill", C.green)
    .text(d3.format(".1f")(lastE.pct) + "% electrified");
  electGroup.append("line")
    .attr("x1", xE(lastE.year) + 6).attr("x2", xE(lastE.year) + 10)
    .attr("y1", yE(lastE.pct) + 4).attr("y2", yE(lastE.pct) + 10)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Big burst annotation in 2019
  const burst = electPct.find(d => d.year === 2019);
  if (burst) {
    electGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xE(2019)).attr("y", yE(burst.pct) - 28).attr("text-anchor", "middle").attr("fill", C.green)
      .text("GWR electrification");
    electGroup.append("line")
      .attr("x1", xE(2019)).attr("x2", xE(2019))
      .attr("y1", yE(burst.pct) - 22).attr("y2", yE(burst.pct) - 6)
      .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Reference line for Europe
  electGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yE(50)).attr("y2", yE(50))
    .attr("stroke", C.faint).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  electGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW - 4).attr("y", yE(50) - 6).attr("text-anchor", "end").attr("fill", C.faint)
    .text("EU average \u2248 50%");

  // Axes
  electGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xE).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  electGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yE).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  electGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Rail electrification (% of route-km)");

  // Hover
  const hoverRect = electGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = electGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = electGroup.append("circle").attr("r", 4).attr("fill", C.green).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xE.invert(mx));
    const d = electPct.find(a => a.year === year);
    if (!d) return;
    hoverLine.attr("x1", xE(year)).attr("x2", xE(year)).style("opacity", 1);
    hoverDot.attr("cx", xE(year)).attr("cy", yE(d.pct)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value" style="color:${C.green}">Electrified: ${d3.format(".1f")(d.pct)}%</div>
      <div class="tt-value">${d3.format(",")(d.electKm)} of ${d3.format(",")(d.routeKm)} km</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // --- ROUTE KM + 4G VIEW (step 1, hidden) ---
  const routeGroup = g.append("g").attr("class", "route-view").style("opacity", 0);

  const xR = d3.scaleLinear().domain(d3.extent(infra, d => d.year)).range([0, dim.innerW]);
  const yR = d3.scaleLinear().domain([15000, 17000]).range([dim.innerH, 0]);

  // Grid
  routeGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yR).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const rArea = d3.area().x(d => xR(d.year)).y0(dim.innerH).y1(d => yR(d.routeKm)).curve(d3.curveMonotoneX);
  routeGroup.append("path").datum(infra)
    .attr("d", rArea).attr("fill", C.primaryLight);

  // Line
  const rLine = d3.line().x(d => xR(d.year)).y(d => yR(d.routeKm)).curve(d3.curveMonotoneX);
  routeGroup.append("path").datum(infra)
    .attr("d", rLine).attr("fill", "none").attr("stroke", C.primary).attr("stroke-width", 2.5);

  // Annotations
  const firstR = infra[0];
  routeGroup.append("circle").attr("cx", xR(firstR.year)).attr("cy", yR(firstR.routeKm)).attr("r", 4)
    .attr("fill", C.primary).attr("stroke", "#fff").attr("stroke-width", 2);
  routeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xR(firstR.year) + 10).attr("y", yR(firstR.routeKm) - 18).attr("fill", C.primary)
    .text(d3.format(",")(firstR.routeKm) + " km");
  routeGroup.append("line")
    .attr("x1", xR(firstR.year) + 6).attr("x2", xR(firstR.year) + 10)
    .attr("y1", yR(firstR.routeKm) - 6).attr("y2", yR(firstR.routeKm) - 12)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  const lastR = infra[infra.length - 1];
  routeGroup.append("circle").attr("cx", xR(lastR.year)).attr("cy", yR(lastR.routeKm)).attr("r", 4)
    .attr("fill", C.primary).attr("stroke", "#fff").attr("stroke-width", 2);
  routeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xR(lastR.year) + 10).attr("y", yR(lastR.routeKm) + 18).attr("fill", C.primary)
    .text(d3.format(",")(lastR.routeKm) + " km");
  routeGroup.append("line")
    .attr("x1", xR(lastR.year) + 6).attr("x2", xR(lastR.year) + 10)
    .attr("y1", yR(lastR.routeKm) + 4).attr("y2", yR(lastR.routeKm) + 10)
    .attr("stroke", C.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Net loss annotation — placed in white space below the data line
  const lostKm = firstR.routeKm - lastR.routeKm;
  routeGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xR(2008)).attr("y", yR(15400)).attr("text-anchor", "middle").attr("fill", C.amber)
    .text("-" + d3.format(",")(lostKm) + " km since 1990");

  // 4G coverage inset (small line in corner)
  const mobile = DATA.broadband.mobile4g;
  if (mobile && mobile.length > 0) {
    const m4gGroup = routeGroup.append("g")
      .attr("transform", `translate(${dim.innerW - 180}, 20)`);

    m4gGroup.append("rect").attr("x", -10).attr("y", -10)
      .attr("width", 190).attr("height", 100)
      .attr("fill", "#fff").attr("stroke", "#E0E0DB").attr("rx", 6).attr("opacity", 0.9);

    m4gGroup.append("text").attr("class", "chart-annotation")
      .attr("x", 0).attr("y", 8).attr("fill", C.muted).text("4G landmass coverage");

    const xM = d3.scaleLinear().domain(d3.extent(mobile, d => d.year)).range([0, 160]);
    const yM = d3.scaleLinear().domain([88, 100]).range([70, 15]);

    const mLine = d3.line().x(d => xM(d.year)).y(d => yM(d.landmassPct)).curve(d3.curveMonotoneX);
    m4gGroup.append("path").datum(mobile)
      .attr("d", mLine).attr("fill", "none").attr("stroke", C.secondary).attr("stroke-width", 2);

    const lastM = mobile[mobile.length - 1];
    m4gGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", xM(lastM.year) + 10).attr("y", yM(lastM.landmassPct) + 14).attr("fill", C.secondary)
      .text(lastM.landmassPct + "%");
  }

  // Axes
  routeGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xR).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  routeGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yR).ticks(6).tickFormat(d => d3.format(",")(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  routeGroup.append("text").attr("class", "chart-title")
    .attr("x", 0).attr("y", -14).attr("fill", C.ink)
    .text("Rail network (total route-km)");
  // Baseline flag for truncated y-axis
  routeGroup.append("text").attr("class", "baseline-flag")
    .attr("x", 0).attr("y", dim.innerH + 40)
    .text("Y-axis starts at 15,000 km, not zero");

  // Hover
  const hoverRect2 = routeGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine2 = routeGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot2 = routeGroup.append("circle").attr("r", 4).attr("fill", C.primary).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const year = Math.round(xR.invert(mx));
    const d = infra.find(a => a.year === year);
    if (!d) return;
    hoverLine2.attr("x1", xR(year)).attr("x2", xR(year)).style("opacity", 1);
    hoverDot2.attr("cx", xR(year)).attr("cy", yR(d.routeKm)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.year}</div>
      <div class="tt-value">Total route: ${d3.format(",")(d.routeKm)} km</div>
      <div class="tt-value">Electrified: ${d3.format(",")(d.electRouteKm)} km</div>
      ${d.newElectKm !== null ? '<div class="tt-value" style="color:' + C.green + '">New electrification: ' + d3.format(".1f")(d.newElectKm) + ' km</div>' : ''}`, event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot2.style("opacity", 0); sobHideTooltip();
  });
}

function updateInvestmentChart(step) {
  const svg = d3.select("#chart-investment svg");
  if (step === 0) {
    svg.select(".elect-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".route-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".elect-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".route-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "roads": updateRoadsChart(step); break;
    case "rail": updateRailChart(step); break;
    case "broadband": updateBroadbandChart(step); break;
    case "traffic": updateTrafficChart(step); break;
    case "investment": updateInvestmentChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); }

})();
