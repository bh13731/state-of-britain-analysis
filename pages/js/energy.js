// @ts-check
/**
 * @file energy.js — Energy mix by fuel type, renewables growth, capacity
 * @description Interactive D3.js scrollytelling charts for the energy story.
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


/* Bind touch events the same as mouse for all hover rects */
function bindTouchTooltip(sel, moveFn, leaveFn) {
  sel.on("touchstart", function(event) { event.preventDefault(); moveFn.call(this, event); }, { passive: false })
     .on("touchmove", function(event) { event.preventDefault(); moveFn.call(this, event); }, { passive: false })
     .on("touchend", function() { if (leaveFn) leaveFn.call(this); sobHideTooltip(); });
}

/* =========================================================
   HELPERS
   ========================================================= */
function fmtTWh(v) { return d3.format(",")(Math.round(v / 1000)) + " TWh"; }
function fmtGWh(v) { return d3.format(",")(Math.round(v)) + " GWh"; }
function fmtBn(v) { return "\u00a3" + d3.format(",")(Math.round(v / 1000)) + "bn"; }
function fmtMtoe(v) { return d3.format(".1f")(v) + " Mtoe"; }



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
/** @type {Object} API response data */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/energy.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big numbers
  var elec1990 = DATA.electricity.find(d => d.year === 1990);
  var elec2024 = DATA.electricity.find(d => d.year === 2024);
  var coalPct1990 = Math.round(elec1990.convThermal / elec1990.totalNet * 100);
  document.getElementById("bn-coal-1990").textContent = coalPct1990 + "%";
  var renewPct2024 = Math.round(elec2024.renewables / elec2024.totalNet * 100);
  document.getElementById("bn-renew-2024").textContent = renewPct2024 + "%";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  document.querySelectorAll(".chart-container svg").forEach(s => s.remove());
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
  buildHookChart();
  buildCoalChart();
  buildRenewablesChart();
  buildMixChart();
  buildImportsChart();
  buildHonestChart();
}

/* =========================================================
   CHART 1: THE HOOK — Electricity bar comparison 1990 vs 2024
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img").attr("aria-label", "Stacked bar chart comparing UK electricity generation sources in 1990 versus 2024");
  const g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  const elec = DATA.electricity;
  const d1990 = elec.find(d => d.year === 1990);
  const d2024 = elec.find(d => d.year === 2024);

  // Stacked bar data for 1990 and 2024
  var sources = ["convThermal", "ccgt", "nuclear", "renewables"];
  var labels = { convThermal: "Coal & oil", ccgt: "Gas (CCGT)", nuclear: "Nuclear", renewables: "Renewables" };
  var colors = { convThermal: C.coal, ccgt: C.gas, nuclear: C.nuclear, renewables: C.green };

  function makeStack(d) {
    var y0 = 0;
    return sources.map(function(s) {
      var val = d[s] / 1000; // GWh to TWh
      var item = { key: s, label: labels[s], value: val, y0: y0, y1: y0 + val, color: colors[s] };
      y0 += val;
      return item;
    });
  }
  var stack1990 = makeStack(d1990);
  var stack2024 = makeStack(d2024);
  var maxY = Math.max(stack1990[stack1990.length-1].y1, stack2024[stack2024.length-1].y1) * 1.08;

  var xCat = d3.scaleBand().domain(["1990", "2024"]).range([0, dim.innerW]).padding(0.35);
  var y = d3.scaleLinear().domain([0, maxY]).range([dim.innerH, 0]);

  // Grid
  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(sel) { sel.select(".domain").remove(); });

  // Y axis
  g.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(function(d, i) { return i === 0 ? d + " TWh" : d; }).tickSize(0))
    .call(function(sel) { sel.select(".domain").remove(); });

  // X axis
  g.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xCat).tickSize(0))
    .call(function(sel) { sel.select(".domain").remove(); });

  // Step 0 view: 1990 bars
  var view0 = g.append("g").attr("class", "hook-view-0");
  stack1990.forEach(function(seg) {
    view0.append("rect")
      .attr("x", xCat("1990")).attr("y", y(seg.y1))
      .attr("width", xCat.bandwidth()).attr("height", y(seg.y0) - y(seg.y1))
      .attr("fill", seg.color).attr("rx", seg.key === "renewables" ? 3 : 0)
      .attr("opacity", 0.92);
  });
  // Label the big one
  var coalSeg1990 = stack1990.find(function(s) { return s.key === "convThermal"; });
  view0.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xCat("1990") + xCat.bandwidth() / 2)
    .attr("y", y(coalSeg1990.y1) + (y(coalSeg1990.y0) - y(coalSeg1990.y1)) / 2 + 5)
    .attr("text-anchor", "middle").attr("fill", "#fff")
    .text("Coal & oil: " + Math.round(coalSeg1990.value) + " TWh");

  // Step 1 view: 2024 bars (initially hidden)
  var view1 = g.append("g").attr("class", "hook-view-1").style("opacity", 0);
  stack2024.forEach(function(seg) {
    view1.append("rect")
      .attr("x", xCat("2024")).attr("y", y(seg.y1))
      .attr("width", xCat.bandwidth()).attr("height", y(seg.y0) - y(seg.y1))
      .attr("fill", seg.color).attr("rx", seg.key === "renewables" ? 3 : 0)
      .attr("opacity", 0.92);
  });
  var renewSeg2024 = stack2024.find(function(s) { return s.key === "renewables"; });
  view1.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xCat("2024") + xCat.bandwidth() / 2)
    .attr("y", y(renewSeg2024.y1) + (y(renewSeg2024.y0) - y(renewSeg2024.y1)) / 2 + 5)
    .attr("text-anchor", "middle").attr("fill", "#fff")
    .text("Renewables: " + Math.round(renewSeg2024.value) + " TWh");
  var coalSeg2024 = stack2024.find(function(s) { return s.key === "convThermal"; });
  var coalBarH2024 = y(coalSeg2024.y0) - y(coalSeg2024.y1);
  if (coalBarH2024 > 20) {
    view1.append("text").attr("class", "chart-annotation")
      .attr("x", xCat("2024") + xCat.bandwidth() / 2)
      .attr("y", y(coalSeg2024.y1) + coalBarH2024 / 2 + 5)
      .attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "12px")
      .text(Math.round(coalSeg2024.value) + " TWh");
  }

  // Legend
  var legendY = dim.margin.top - 28;
  var legendX = dim.margin.left;
  var legendItems = sources.map(function(s) { return { key: s, label: labels[s], color: colors[s] }; });
  var lgG = svg.append("g").attr("transform", "translate(" + legendX + "," + legendY + ")");
  var lx = 0;
  var lgFontSize = sobIsMobile() ? "11px" : "13px";
  var lgSpacing = sobIsMobile() ? 20 : 32;
  var lgBoxSize = sobIsMobile() ? 10 : 12;
  legendItems.forEach(function(item) {
    lgG.append("rect").attr("x", lx).attr("y", -6).attr("width", lgBoxSize).attr("height", lgBoxSize).attr("rx", 2).attr("fill", item.color);
    var txt = lgG.append("text").attr("x", lx + lgBoxSize + 4).attr("y", 4).attr("font-size", lgFontSize).attr("fill", C.muted).attr("font-family", "Inter, sans-serif").text(item.label);
    lx += txt.node().getComputedTextLength() + lgSpacing;
  });
}

function updateHookChart(step) {
  var svg = d3.select("#chart-hook svg");
  if (step === 0) {
    svg.select(".hook-view-0").transition().duration(DURATION).style("opacity", 1);
    svg.select(".hook-view-1").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".hook-view-0").transition().duration(DURATION).style("opacity", 1);
    svg.select(".hook-view-1").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 2: COAL EXIT — Coal share of primary energy
   ========================================================= */
function buildCoalChart() {
  var container = document.getElementById("chart-coal");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img").attr("aria-label", "Line chart showing coal share of UK primary energy falling from 31% in 1990 to 1.5% in 2024");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var mix = DATA.energyMix;
  var x = d3.scaleLinear().domain([1990, 2024]).range([0, dim.innerW]);
  var y = d3.scaleLinear().domain([0, 35]).range([dim.innerH, 0]);

  // Grid
  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(function(s) { s.select(".domain").remove(); });

  // Area
  var area = d3.area().x(function(d) { return x(d.year); }).y0(dim.innerH).y1(function(d) { return y(d.coal); }).curve(d3.curveMonotoneX);
  g.append("path").datum(mix).attr("d", area).attr("fill", C.greyLight);

  // Line
  var line = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.coal); }).curve(d3.curveMonotoneX);
  g.append("path").datum(mix).attr("d", line).attr("fill", "none").attr("stroke", C.coal).attr("stroke-width", 2.5);

  // Axes
  g.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });
  g.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(7).tickFormat(function(d, i) { return i === 0 ? d + "% of primary energy" : d + "%"; }).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });

  // Start annotation
  var d1990 = mix[0];
  g.append("circle").attr("cx", x(1990)).attr("cy", y(d1990.coal)).attr("r", 4).attr("fill", C.coal).attr("stroke", "#fff").attr("stroke-width", 2);
  g.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(1990) + 10).attr("y", y(d1990.coal) + 4).attr("fill", C.coal)
    .text(sobFmtPct(d1990.coal));

  // End annotation
  var d2024 = mix[mix.length - 1];
  g.append("circle").attr("cx", x(2024)).attr("cy", y(d2024.coal)).attr("r", 4).attr("fill", C.coal).attr("stroke", "#fff").attr("stroke-width", 2);
  g.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2024) + 10).attr("y", y(d2024.coal) + 4).attr("fill", C.coal)
    .text(sobFmtPct(d2024.coal));

  // Carbon price annotation (step 1 reveals)
  var annotGroup = g.append("g").attr("class", "coal-annot").style("opacity", 0);

  // 2016 cliff annotation
  annotGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2016)).attr("y", y(18) - 36).attr("text-anchor", "middle").attr("fill", C.coal)
    .text("Carbon price floor");
  annotGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2016)).attr("y", y(18) - 20).attr("text-anchor", "middle").attr("fill", C.coal)
    .text("bites (2013\u20132016)");
  annotGroup.append("line")
    .attr("x1", x(2016)).attr("x2", x(2016))
    .attr("y1", y(18) - 14).attr("y2", y(mix.find(function(d) { return d.year === 2016; }).coal) + 4)
    .attr("stroke", C.coal).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Last station annotation
  annotGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2024)).attr("y", y(10)).attr("text-anchor", "end").attr("fill", C.green)
    .text("Ratcliffe-on-Soar closes");
  annotGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2024)).attr("y", y(10) + 16).attr("text-anchor", "end").attr("fill", C.green)
    .text("30 Sept 2024");
  annotGroup.append("line")
    .attr("x1", x(2024)).attr("x2", x(2024))
    .attr("y1", y(10) + 22).attr("y2", y(d2024.coal) - 6)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Hover
  var hoverRect = g.append("rect").attr("width", dim.innerW).attr("height", dim.innerH).attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLine = g.append("line").attr("y1", 0).attr("y2", dim.innerH).attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  var hoverDot = g.append("circle").attr("r", 4).attr("fill", C.coal).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = mix.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot.attr("cx", x(year)).attr("cy", y(d.coal)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div><div class="tt-value">Coal: ' + sobFmtPct(d.coal) + ' of primary energy</div>', event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });
}

function updateCoalChart(step) {
  var svg = d3.select("#chart-coal svg");
  if (step === 1) {
    svg.select(".coal-annot").transition().duration(DURATION).style("opacity", 1);
  } else {
    svg.select(".coal-annot").transition().duration(DURATION).style("opacity", 0);
  }
}

/* =========================================================
   CHART 3: RENEWABLES — Electricity generation by source
   ========================================================= */
function buildRenewablesChart() {
  var container = document.getElementById("chart-renewables");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img").attr("aria-label", "Line chart showing UK renewable electricity generation rising from 5 TWh to 103 TWh, overtaking gas generation in 2020");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var elec = DATA.electricity;
  var x = d3.scaleLinear().domain([1990, 2024]).range([0, dim.innerW]);
  var y = d3.scaleLinear().domain([0, 300]).range([dim.innerH, 0]);

  // Grid
  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(s) { s.select(".domain").remove(); });

  // Axes
  g.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });
  g.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(function(d, i) { return i === 0 ? d + " TWh" : d; }).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });

  // Step 0: Just renewables line with area
  var view0 = g.append("g").attr("class", "renew-view-0");
  var renewArea = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(dim.innerH)
    .y1(function(d) { return y(d.renewables / 1000); })
    .curve(d3.curveMonotoneX);
  view0.append("path").datum(elec).attr("d", renewArea).attr("fill", C.greenLight);
  var renewLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.renewables / 1000); }).curve(d3.curveMonotoneX);
  view0.append("path").datum(elec).attr("d", renewLine).attr("fill", "none").attr("stroke", C.green).attr("stroke-width", 2.5);

  // Direct label
  var last = elec[elec.length - 1];
  view0.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2024) + 8).attr("y", y(last.renewables / 1000) + 4).attr("fill", C.green)
    .text(Math.round(last.renewables / 1000) + " TWh");

  // Start label
  view0.append("circle").attr("cx", x(1990)).attr("cy", y(elec[0].renewables / 1000)).attr("r", 3.5).attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 1.5);
  view0.append("text").attr("class", "chart-annotation")
    .attr("x", x(1990) + 10).attr("y", y(elec[0].renewables / 1000) - 8).attr("fill", C.green)
    .text(Math.round(elec[0].renewables / 1000) + " TWh (1990)");

  // Step 1: All sources comparison (layered on top)
  var view1 = g.append("g").attr("class", "renew-view-1").style("opacity", 0);

  // Fossil (conv + ccgt combined)
  var fossilLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y((d.convThermal + d.ccgt) / 1000); }).curve(d3.curveMonotoneX);
  view1.append("path").datum(elec).attr("d", fossilLine).attr("fill", "none").attr("stroke", C.grey).attr("stroke-width", 2).attr("stroke-dasharray", "6,3");

  // Nuclear
  var nucLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.nuclear / 1000); }).curve(d3.curveMonotoneX);
  view1.append("path").datum(elec).attr("d", nucLine).attr("fill", "none").attr("stroke", C.nuclear).attr("stroke-width", 2).attr("stroke-dasharray", "6,3");

  // Direct labels at end with collision avoidance
  var elecEndLabels = [
    { rawY: y((last.convThermal + last.ccgt) / 1000) + 4, color: C.grey, text: "Fossil " + Math.round((last.convThermal + last.ccgt) / 1000) + " TWh" },
    { rawY: y(last.nuclear / 1000) + 4, color: C.nuclear, text: "Nuclear " + Math.round(last.nuclear / 1000) + " TWh" }
  ];
  elecEndLabels.sort(function(a, b) { return a.rawY - b.rawY; });
  for (var eli = 1; eli < elecEndLabels.length; eli++) {
    if (elecEndLabels[eli].rawY - elecEndLabels[eli - 1].rawY < 18) {
      elecEndLabels[eli].rawY = elecEndLabels[eli - 1].rawY + 18;
    }
  }
  elecEndLabels.forEach(function(l) {
    view1.append("text").attr("class", "chart-annotation-bold")
      .attr("x", x(2024) + 8).attr("y", l.rawY).attr("fill", l.color)
      .text(l.text);
  });

  // Crossover annotation
  var crossYear = 2020;
  var crossD = elec.find(function(d) { return d.year === crossYear; });
  var crossY = y(crossD.renewables / 1000);
  view1.append("text").attr("class", "chart-annotation")
    .attr("x", x(crossYear)).attr("y", crossY - 30).attr("text-anchor", "middle").attr("fill", C.green)
    .text("Renewables overtake");
  view1.append("text").attr("class", "chart-annotation")
    .attr("x", x(crossYear)).attr("y", crossY - 14).attr("text-anchor", "middle").attr("fill", C.green)
    .text("gas generation (2020)");
  view1.append("line")
    .attr("x1", x(crossYear)).attr("x2", x(crossYear))
    .attr("y1", crossY - 8).attr("y2", crossY + 4)
    .attr("stroke", C.green).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Hover
  var hoverRect = g.append("rect").attr("width", dim.innerW).attr("height", dim.innerH).attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLineEl = g.append("line").attr("y1", 0).attr("y2", dim.innerH).attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  var dotR = g.append("circle").attr("r", 4).attr("fill", C.green).style("opacity", 0);
  var dotF = g.append("circle").attr("r", 4).attr("fill", C.grey).style("opacity", 0);
  var dotN = g.append("circle").attr("r", 4).attr("fill", C.nuclear).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = elec.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLineEl.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    dotR.attr("cx", x(year)).attr("cy", y(d.renewables / 1000)).style("opacity", 1);
    dotF.attr("cx", x(year)).attr("cy", y((d.convThermal + d.ccgt) / 1000)).style("opacity", 1);
    dotN.attr("cx", x(year)).attr("cy", y(d.nuclear / 1000)).style("opacity", 1);
    var total = d.totalNet / 1000;
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value" style="color:' + C.green + '">Renewables: ' + Math.round(d.renewables / 1000) + ' TWh (' + Math.round(d.renewables / d.totalNet * 100) + '%)</div>' +
      '<div class="tt-value" style="color:' + C.grey + '">Fossil: ' + Math.round((d.convThermal + d.ccgt) / 1000) + ' TWh (' + Math.round((d.convThermal + d.ccgt) / d.totalNet * 100) + '%)</div>' +
      '<div class="tt-value" style="color:' + C.nuclear + '">Nuclear: ' + Math.round(d.nuclear / 1000) + ' TWh (' + Math.round(d.nuclear / d.totalNet * 100) + '%)</div>', event);
  }).on("mouseleave", function() {
    hoverLineEl.style("opacity", 0); dotR.style("opacity", 0); dotF.style("opacity", 0); dotN.style("opacity", 0);
    sobHideTooltip();
  });
}

function updateRenewablesChart(step) {
  var svg = d3.select("#chart-renewables svg");
  if (step === 1) {
    svg.select(".renew-view-1").transition().duration(DURATION).style("opacity", 1);
  } else {
    svg.select(".renew-view-1").transition().duration(DURATION).style("opacity", 0);
  }
}

/* =========================================================
   CHART 4: FULL ENERGY MIX — Stacked area
   ========================================================= */
function buildMixChart() {
  var container = document.getElementById("chart-mix");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img").attr("aria-label", "Stacked area chart showing UK primary energy mix from 1990 to 2024, fossil fuels still dominating at 74%");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var mix = DATA.energyMix;
  var x = d3.scaleLinear().domain([1990, 2024]).range([0, dim.innerW]);
  var y = d3.scaleLinear().domain([0, 100]).range([dim.innerH, 0]);

  var keys = ["coal", "petroleum", "gas", "nuclear", "bioenergy", "renewables"];
  var labels = { coal: "Coal", petroleum: "Petroleum", gas: "Gas", nuclear: "Nuclear", bioenergy: "Bioenergy", renewables: "Renewables" };
  var colors = { coal: "#475569", petroleum: "#64748B", gas: "#94A3B8", nuclear: "#7C3AED", bioenergy: "#2DD4BF", renewables: "#059669" };

  var stack = d3.stack().keys(keys).order(d3.stackOrderNone).offset(d3.stackOffsetNone);
  var series = stack(mix);

  var area = d3.area()
    .x(function(d) { return x(d.data.year); })
    .y0(function(d) { return y(d[0]); })
    .y1(function(d) { return y(d[1]); })
    .curve(d3.curveMonotoneX);

  // Step 0: All sources stacked
  var view0 = g.append("g").attr("class", "mix-view-0");
  series.forEach(function(s) {
    view0.append("path").datum(s).attr("d", area).attr("fill", colors[s.key]).attr("opacity", 0.8);
  });

  // Axes
  g.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });
  g.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(function(d) { return d + "%"; }).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });

  // Direct labels on the right side for 2024
  var latest = mix[mix.length - 1];
  var cumul = 0;
  keys.forEach(function(key) {
    var val = latest[key];
    var mid = cumul + val / 2;
    cumul += val;
    if (val > 3) {
      view0.append("text").attr("class", "chart-annotation-bold")
        .attr("x", x(2024) + 8).attr("y", y(mid) + 4)
        .attr("fill", colors[key])
        .style("font-size", val > 8 ? "13px" : "11px")
        .text(labels[key] + " " + sobFmtPct(val));
    }
  });

  // Step 1: Highlight fossil vs clean
  var view1 = g.append("g").attr("class", "mix-view-1").style("opacity", 0);

  // Fossil bracket
  var fossilPct = latest.coal + latest.petroleum + latest.gas;
  var fossilMid = y(fossilPct / 2);
  var bracketX = dim.innerW + 4;
  view1.append("line").attr("x1", bracketX).attr("x2", bracketX).attr("y1", y(fossilPct)).attr("y2", y(0)).attr("stroke", C.grey).attr("stroke-width", 2);
  view1.append("line").attr("x1", bracketX - 6).attr("x2", bracketX + 6).attr("y1", y(fossilPct)).attr("y2", y(fossilPct)).attr("stroke", C.grey).attr("stroke-width", 2);
  view1.append("line").attr("x1", bracketX - 6).attr("x2", bracketX + 6).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", C.grey).attr("stroke-width", 2);
  view1.append("text").attr("class", "chart-annotation-bold")
    .attr("x", bracketX + 10).attr("y", fossilMid - 6).attr("fill", C.grey)
    .text("Fossil fuels");
  view1.append("text").attr("class", "chart-annotation-bold")
    .attr("x", bracketX + 10).attr("y", fossilMid + 12).attr("fill", C.grey)
    .text(sobFmtPct(fossilPct));

  // Clean bracket
  var cleanPct = latest.renewables + latest.bioenergy;
  var cleanBase = fossilPct + latest.nuclear;
  var cleanMidY = y(cleanBase + cleanPct / 2);
  view1.append("line").attr("x1", bracketX).attr("x2", bracketX).attr("y1", y(cleanBase + cleanPct)).attr("y2", y(cleanBase)).attr("stroke", C.green).attr("stroke-width", 2);
  view1.append("line").attr("x1", bracketX - 6).attr("x2", bracketX + 6).attr("y1", y(cleanBase + cleanPct)).attr("y2", y(cleanBase + cleanPct)).attr("stroke", C.green).attr("stroke-width", 2);
  view1.append("line").attr("x1", bracketX - 6).attr("x2", bracketX + 6).attr("y1", y(cleanBase)).attr("y2", y(cleanBase)).attr("stroke", C.green).attr("stroke-width", 2);
  view1.append("text").attr("class", "chart-annotation-bold")
    .attr("x", bracketX + 10).attr("y", cleanMidY - 6).attr("fill", C.green)
    .text("Renewables + bio");
  view1.append("text").attr("class", "chart-annotation-bold")
    .attr("x", bracketX + 10).attr("y", cleanMidY + 12).attr("fill", C.green)
    .text(sobFmtPct(cleanPct));

  // Hover
  var hoverRect = g.append("rect").attr("width", dim.innerW).attr("height", dim.innerH).attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLineEl = g.append("line").attr("y1", 0).attr("y2", dim.innerH).attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = mix.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLineEl.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value" style="color:' + colors.petroleum + '">Petroleum: ' + sobFmtPct(d.petroleum) + '</div>' +
      '<div class="tt-value" style="color:' + colors.gas + '">Gas: ' + sobFmtPct(d.gas) + '</div>' +
      '<div class="tt-value" style="color:#334155">Coal: ' + sobFmtPct(d.coal) + '</div>' +
      '<div class="tt-value" style="color:' + colors.nuclear + '">Nuclear: ' + sobFmtPct(d.nuclear) + '</div>' +
      '<div class="tt-value" style="color:' + colors.bioenergy + '">Bioenergy: ' + sobFmtPct(d.bioenergy) + '</div>' +
      '<div class="tt-value" style="color:' + colors.renewables + '">Renewables: ' + sobFmtPct(d.renewables) + '</div>', event);
  }).on("mouseleave", function() {
    hoverLineEl.style("opacity", 0); sobHideTooltip();
  });
}

function updateMixChart(step) {
  var svg = d3.select("#chart-mix svg");
  if (step === 1) {
    svg.select(".mix-view-1").transition().duration(DURATION).style("opacity", 1);
  } else {
    svg.select(".mix-view-1").transition().duration(DURATION).style("opacity", 0);
  }
}

/* =========================================================
   CHART 5: IMPORT DEPENDENCY
   ========================================================= */
function buildImportsChart() {
  var container = document.getElementById("chart-imports");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img").attr("aria-label", "Line chart showing UK net energy import dependency rising from negative (net exporter) in the late 1990s to 42% by 2024");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var impDep = DATA.importDependency;
  var x = d3.scaleLinear().domain([1990, 2024]).range([0, dim.innerW]);
  var y = d3.scaleLinear().domain([-35, 50]).range([dim.innerH, 0]);

  // Grid
  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(function(s) { s.select(".domain").remove(); });

  // Zero line
  g.append("line").attr("x1", 0).attr("x2", dim.innerW).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", C.ink).attr("stroke-width", 1).attr("opacity", 0.3);

  // Shaded area: positive = import dependent (red tint), negative = exporter (green tint)
  var areaPos = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(y(0))
    .y1(function(d) { return y(Math.max(0, d.importDependency)); })
    .curve(d3.curveMonotoneX);
  var areaNeg = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(y(0))
    .y1(function(d) { return y(Math.min(0, d.importDependency)); })
    .curve(d3.curveMonotoneX);

  g.append("path").datum(impDep).attr("d", areaPos).attr("fill", C.amberLight);
  g.append("path").datum(impDep).attr("d", areaNeg).attr("fill", C.greenLight);

  // Line
  var line = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.importDependency); }).curve(d3.curveMonotoneX);
  g.append("path").datum(impDep).attr("d", line).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2.5);

  // Axes
  g.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });
  g.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(8).tickFormat(function(d) { return d + "%"; }).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });

  // Zone labels
  g.append("text").attr("class", "chart-annotation")
    .attr("x", 6).attr("y", y(5) + 4).attr("fill", C.amber)
    .text("Net importer \u2191");
  g.append("text").attr("class", "chart-annotation")
    .attr("x", 6).attr("y", y(-5) + 4).attr("fill", C.green)
    .text("Net exporter \u2193");

  // Peak North Sea annotation
  var peakD = impDep.find(function(d) { return d.year === 1999; });
  g.append("circle").attr("cx", x(1999)).attr("cy", y(peakD.importDependency)).attr("r", 4).attr("fill", C.green).attr("stroke", "#fff").attr("stroke-width", 2);
  g.append("text").attr("class", "chart-annotation")
    .attr("x", x(1999)).attr("y", y(peakD.importDependency) - 14).attr("text-anchor", "middle").attr("fill", C.green)
    .text("Peak North Sea");

  // 2024 level
  var d2024 = impDep[impDep.length - 1];
  g.append("circle").attr("cx", x(2024)).attr("cy", y(d2024.importDependency)).attr("r", 4).attr("fill", C.amber).attr("stroke", "#fff").attr("stroke-width", 2);
  g.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2024) + 10).attr("y", y(d2024.importDependency) + 4).attr("fill", C.amber)
    .text(sobFmtPct(d2024.importDependency));

  // Step 1: Gas storage comparison (bar chart overlay)
  var view1 = g.append("g").attr("class", "imports-view-1").style("opacity", 0);

  var gasIntl = DATA.energySecurity.gasStorageIntl;
  var barW = Math.min(dim.innerW / gasIntl.length - 6, 50);
  var xBar = d3.scaleBand().domain(gasIntl.map(function(d) { return d.country; })).range([0, dim.innerW]).padding(0.15);
  var yBar = d3.scaleLinear().domain([0, 130]).range([dim.innerH, 0]);

  // White background to cover the line chart
  view1.append("rect").attr("x", -dim.margin.left).attr("y", -dim.margin.top).attr("width", dim.width).attr("height", dim.height).attr("fill", C.bg);

  // Grid
  view1.append("g").attr("class", "grid")
    .call(d3.axisLeft(yBar).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(s) { s.select(".domain").remove(); });

  // Y axis
  view1.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yBar).ticks(6).tickFormat(function(d, i) { return i === 0 ? d + " days" : d; }).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });

  // X axis
  view1.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xBar).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); })
    .selectAll("text").style("font-size", "12px");

  // Bars
  gasIntl.forEach(function(d) {
    var isUK = d.country === "UK";
    view1.append("rect")
      .attr("x", xBar(d.country)).attr("y", yBar(d.daysOfDemand))
      .attr("width", xBar.bandwidth()).attr("height", dim.innerH - yBar(d.daysOfDemand))
      .attr("fill", isUK ? C.amber : C.gas).attr("rx", 3).attr("opacity", isUK ? 1 : 0.6);
    view1.append("text").attr("class", isUK ? "chart-annotation-bold" : "chart-annotation")
      .attr("x", xBar(d.country) + xBar.bandwidth() / 2).attr("y", yBar(d.daysOfDemand) - 8)
      .attr("text-anchor", "middle").attr("fill", isUK ? C.amber : C.muted)
      .text(d.daysOfDemand);
  });

  // Title for bar view
  view1.append("text").attr("class", "chart-annotation-bold")
    .attr("x", 0).attr("y", -10).attr("fill", C.ink)
    .text("Gas storage: days of demand (Winter 2024/25)");

  // Hover on main chart
  var hoverRect = g.append("rect").attr("width", dim.innerW).attr("height", dim.innerH).attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLineEl = g.append("line").attr("y1", 0).attr("y2", dim.innerH).attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  var hoverDot = g.append("circle").attr("r", 4).attr("fill", C.amber).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = impDep.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLineEl.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot.attr("cx", x(year)).attr("cy", y(d.importDependency)).style("opacity", 1);
    var status = d.importDependency < 0 ? "Net exporter" : "Net importer";
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value">' + status + ': ' + sobFmtPct(Math.abs(d.importDependency)) + '</div>' +
      '<div class="tt-value" style="color:' + C.muted + '">Production: ' + d3.format(",")(d.production) + ' ktoe (thousand tonnes of oil equivalent)</div>' +
      '<div class="tt-value" style="color:' + C.muted + '">Consumption: ' + d3.format(",")(d.consumption) + ' ktoe</div>', event);
  }).on("mouseleave", function() {
    hoverLineEl.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });
}

function updateImportsChart(step) {
  var svg = d3.select("#chart-imports svg");
  if (step === 1) {
    svg.select(".imports-view-1").transition().duration(DURATION).style("opacity", 1).on("start", function() { d3.select(this).style("pointer-events", "all"); });
  } else {
    svg.select(".imports-view-1").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  }
}

/* =========================================================
   CHART 6: HONEST PICTURE — Household bills + summary
   ========================================================= */
function buildHonestChart() {
  var container = document.getElementById("chart-honest");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img").attr("aria-label", "Line chart showing UK household energy expenditure rising from 12 billion pounds in 1990 to 51 billion in 2024, with a spike during the 2022 energy crisis");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var exp = DATA.expenditure;
  var x = d3.scaleLinear().domain([1990, 2024]).range([0, dim.innerW]);
  var y = d3.scaleLinear().domain([0, 65]).range([dim.innerH, 0]);

  // Grid
  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(s) { s.select(".domain").remove(); });

  // Axes
  g.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });
  g.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(function(d, i) { return i === 0 ? "\u00a3" + d + "bn (nominal)" : "\u00a3" + d; }).tickSize(0))
    .call(function(s) { s.select(".domain").remove(); });

  // Step 0: Household bills
  var view0 = g.append("g").attr("class", "honest-view-0");

  // Gas area
  var gasArea = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(dim.innerH)
    .y1(function(d) { return y(d.domesticGas / 1000); })
    .curve(d3.curveMonotoneX);
  view0.append("path").datum(exp).attr("d", gasArea).attr("fill", "rgba(148,163,184,0.15)");

  // Total area
  var totalArea = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(function(d) { return y(d.domesticGas / 1000); })
    .y1(function(d) { return y(d.domesticTotal / 1000); })
    .curve(d3.curveMonotoneX);
  view0.append("path").datum(exp).attr("d", totalArea).attr("fill", "rgba(5,150,105,0.10)");

  // Total line
  var totalLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.domesticTotal / 1000); }).curve(d3.curveMonotoneX);
  view0.append("path").datum(exp).attr("d", totalLine).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);

  // Gas line
  var gasLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.domesticGas / 1000); }).curve(d3.curveMonotoneX);
  view0.append("path").datum(exp).attr("d", gasLine).attr("fill", "none").attr("stroke", C.gas).attr("stroke-width", 2);

  // Electricity line
  var elecLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.domesticElectricity / 1000); }).curve(d3.curveMonotoneX);
  view0.append("path").datum(exp).attr("d", elecLine).attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2);

  // Direct labels with collision avoidance
  var last = exp[exp.length - 1];
  var expLabels = [
    { rawY: y(last.domesticTotal / 1000) + 4, color: C.red, text: "Total \u00a3" + Math.round(last.domesticTotal / 1000) + "bn" },
    { rawY: y(last.domesticElectricity / 1000) + 4, color: C.amber, text: "Electricity \u00a3" + Math.round(last.domesticElectricity / 1000) + "bn" },
    { rawY: y(last.domesticGas / 1000) + 4, color: C.gas, text: "Gas \u00a3" + Math.round(last.domesticGas / 1000) + "bn" }
  ];
  expLabels.sort(function(a, b) { return a.rawY - b.rawY; });
  for (var ei = 1; ei < expLabels.length; ei++) {
    if (expLabels[ei].rawY - expLabels[ei - 1].rawY < 18) {
      expLabels[ei].rawY = expLabels[ei - 1].rawY + 18;
    }
  }
  expLabels.forEach(function(l) {
    view0.append("text").attr("class", "chart-annotation-bold")
      .attr("x", x(2024) + 8).attr("y", l.rawY).attr("fill", l.color)
      .text(l.text);
  });

  // 2022 crisis annotation
  var d2022 = exp.find(function(d) { return d.year === 2022; });
  view0.append("text").attr("class", "chart-annotation")
    .attr("x", x(2022)).attr("y", y(d2022.domesticTotal / 1000) - 26).attr("text-anchor", "middle").attr("fill", C.red)
    .text("Energy crisis");
  view0.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2022)).attr("y", y(d2022.domesticTotal / 1000) - 10).attr("text-anchor", "middle").attr("fill", C.red)
    .text("\u00a3" + Math.round(d2022.domesticTotal / 1000) + "bn");
  view0.append("line")
    .attr("x1", x(2022)).attr("x2", x(2022))
    .attr("y1", y(d2022.domesticTotal / 1000) - 4).attr("y2", y(d2022.domesticTotal / 1000) + 4)
    .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

  // Step 1: Summary scorecard
  var view1 = g.append("g").attr("class", "honest-view-1").style("opacity", 0);

  // White background
  view1.append("rect").attr("x", -dim.margin.left).attr("y", -dim.margin.top).attr("width", dim.width).attr("height", dim.height).attr("fill", C.bg);

  var scorecard = [
    { label: "Electricity grid", verdict: "Transformed", color: C.green, detail: "Coal gone. Renewables 38%. A genuine success." },
    { label: "Overall energy mix", verdict: "Slow progress", color: C.amber, detail: "Still 74% fossil fuels. Gas and petroleum dominate." },
    { label: "Transport", verdict: "Barely started", color: C.red, detail: "Petroleum still powers almost all vehicles." },
    { label: "Energy bills", verdict: "Rising", color: C.red, detail: "Household bills quadrupled since 1990." },
    { label: "Energy security", verdict: "Vulnerable", color: C.amber, detail: "42% import dependent. 9 days gas storage." }
  ];

  var cardH = Math.min(80, dim.innerH / scorecard.length - 10);
  var cardW = Math.min(dim.innerW, 460);
  var startY = (dim.innerH - scorecard.length * (cardH + 12)) / 2;

  scorecard.forEach(function(item, i) {
    var cy = startY + i * (cardH + 12);
    // Card background
    view1.append("rect")
      .attr("x", (dim.innerW - cardW) / 2).attr("y", cy)
      .attr("width", cardW).attr("height", cardH)
      .attr("rx", 8).attr("fill", "#fff").attr("stroke", "#E0E0DB").attr("stroke-width", 1);
    // Colour indicator
    view1.append("rect")
      .attr("x", (dim.innerW - cardW) / 2).attr("y", cy)
      .attr("width", 5).attr("height", cardH)
      .attr("rx", 2).attr("fill", item.color);
    // Label
    view1.append("text")
      .attr("x", (dim.innerW - cardW) / 2 + 16).attr("y", cy + 24)
      .attr("font-size", "15px").attr("font-weight", 600).attr("fill", C.ink).attr("font-family", "Inter, sans-serif")
      .text(item.label);
    // Verdict
    view1.append("text")
      .attr("x", (dim.innerW - cardW) / 2 + cardW - 16).attr("y", cy + 24)
      .attr("text-anchor", "end").attr("font-size", "14px").attr("font-weight", 600).attr("fill", item.color).attr("font-family", "Inter, sans-serif")
      .text(item.verdict);
    // Detail
    view1.append("text")
      .attr("x", (dim.innerW - cardW) / 2 + 16).attr("y", cy + 48)
      .attr("font-size", "13px").attr("fill", C.muted).attr("font-family", "Inter, sans-serif")
      .text(item.detail);
  });

  // Hover on step 0
  var hoverRect = g.append("rect").attr("width", dim.innerW).attr("height", dim.innerH).attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLineEl = g.append("line").attr("y1", 0).attr("y2", dim.innerH).attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = exp.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLineEl.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value" style="color:' + C.red + '">Household total: \u00a3' + d3.format(",")(d.domesticTotal) + 'm</div>' +
      '<div class="tt-value" style="color:' + C.amber + '">Electricity: \u00a3' + d3.format(",")(d.domesticElectricity) + 'm</div>' +
      '<div class="tt-value" style="color:' + C.gas + '">Gas: \u00a3' + d3.format(",")(d.domesticGas) + 'm</div>', event);
  }).on("mouseleave", function() {
    hoverLineEl.style("opacity", 0); sobHideTooltip();
  });
}

function updateHonestChart(step) {
  var svg = d3.select("#chart-honest svg");
  if (step === 1) {
    svg.select(".honest-view-1").transition().duration(DURATION).style("opacity", 1).on("start", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".honest-view-0").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".honest-view-1").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".honest-view-0").transition().duration(DURATION).style("opacity", 1).on("start", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   SCROLL OBSERVER & CHART DISPATCH
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); }

function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "coal": updateCoalChart(step); break;
    case "renewables": updateRenewablesChart(step); break;
    case "mix": updateMixChart(step); break;
    case "imports": updateImportsChart(step); break;
    case "honest": updateHonestChart(step); break;
  }
}

})();
