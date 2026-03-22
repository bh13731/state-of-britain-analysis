// @ts-check
/**
 * @file fertility.js — Total fertility rate, birth rates, demographic projections
 * @description Interactive D3.js scrollytelling charts for the fertility story.
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
const REPLACEMENT = 2.1;


/* =========================================================
   HELPERS
   ========================================================= */


function fmtRate(v) { return d3.format(".2f")(v); }
function fmtK(v) { return d3.format(",")(v) + "k"; }



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
/** @type {Object} API response data */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/family.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big numbers
  document.getElementById("bn-tfr").textContent = DATA.snapshot.tfr.toFixed(2);
  document.getElementById("bn-births").textContent = d3.format(",")(DATA.snapshot.liveBirths);

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-hook svg, #chart-order svg, #chart-births svg, #chart-families svg, #chart-why svg").remove();
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
  buildOrderChart();
  buildBirthsChart();
  buildFamiliesChart();
  buildWhyChart();
}

/* =========================================================
   CHART 1: THE HOOK — TFR headline + long decline
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Total fertility rate in England and Wales, 1960 to 2024, compared to the replacement rate of 2.1");
  const g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  const tfrData = DATA.tfrByOrder;

  // --- GAUGE VIEW (step 0): big TFR vs replacement ---
  const gaugeGroup = g.append("g").attr("class", "gauge-view");

  const barW = Math.min(120, dim.innerW * 0.18);
  const gap = barW * 1.2;
  const centerX = dim.innerW / 2;
  const yGauge = d3.scaleLinear().domain([0, 2.5]).range([dim.innerH, 0]);

  // Grid lines
  [0.5, 1.0, 1.5, 2.0, 2.5].forEach(v => {
    gaugeGroup.append("line")
      .attr("x1", centerX - gap - barW).attr("x2", centerX + gap + barW)
      .attr("y1", yGauge(v)).attr("y2", yGauge(v))
      .attr("stroke", C.grid).attr("stroke-width", 1);
    gaugeGroup.append("text").attr("class", "chart-annotation")
      .attr("x", centerX - gap - barW - 8).attr("y", yGauge(v) + 4)
      .attr("text-anchor", "end").text(v.toFixed(1));
  });

  // Replacement rate line
  gaugeGroup.append("line")
    .attr("x1", centerX - gap - barW - 4).attr("x2", centerX + gap + barW + 4)
    .attr("y1", yGauge(REPLACEMENT)).attr("y2", yGauge(REPLACEMENT))
    .attr("stroke", C.muted).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  gaugeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", centerX + gap + barW + 8).attr("y", yGauge(REPLACEMENT) + 5)
    .attr("fill", C.muted).text("Replacement: 2.1");

  // Current TFR bar
  gaugeGroup.append("rect")
    .attr("x", centerX - gap / 2 - barW).attr("y", yGauge(DATA.snapshot.tfr))
    .attr("width", barW).attr("height", dim.innerH - yGauge(DATA.snapshot.tfr))
    .attr("fill", C.rose).attr("rx", 4);
  gaugeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", centerX - gap / 2 - barW / 2).attr("y", yGauge(DATA.snapshot.tfr) - 12)
    .attr("text-anchor", "middle").attr("fill", C.rose).attr("font-size", "18px")
    .text(DATA.snapshot.tfr.toFixed(2));
  gaugeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", centerX - gap / 2 - barW / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.rose).text("2024 TFR");

  // Replacement bar (ghost)
  gaugeGroup.append("rect")
    .attr("x", centerX + gap / 2).attr("y", yGauge(REPLACEMENT))
    .attr("width", barW).attr("height", dim.innerH - yGauge(REPLACEMENT))
    .attr("fill", C.slateLight).attr("stroke", C.slate).attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,3").attr("rx", 4);
  gaugeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", centerX + gap / 2 + barW / 2).attr("y", yGauge(REPLACEMENT) - 12)
    .attr("text-anchor", "middle").attr("fill", C.slate).attr("font-size", "18px")
    .text("2.10");
  gaugeGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", centerX + gap / 2 + barW / 2).attr("y", dim.innerH + 28)
    .attr("text-anchor", "middle").attr("fill", C.slate).text("Replacement");

  // Gap annotation
  var gapX = centerX + gap / 2 + barW + 40;
  var gapY1 = yGauge(REPLACEMENT);
  var gapY2 = yGauge(DATA.snapshot.tfr);
  if (gapX + 80 < dim.innerW) {
    gaugeGroup.append("line").attr("x1", gapX).attr("x2", gapX)
      .attr("y1", gapY1).attr("y2", gapY2)
      .attr("stroke", C.rose).attr("stroke-width", 2);
    gaugeGroup.append("line").attr("x1", gapX - 5).attr("x2", gapX + 5)
      .attr("y1", gapY1).attr("y2", gapY1)
      .attr("stroke", C.rose).attr("stroke-width", 2);
    gaugeGroup.append("line").attr("x1", gapX - 5).attr("x2", gapX + 5)
      .attr("y1", gapY2).attr("y2", gapY2)
      .attr("stroke", C.rose).attr("stroke-width", 2);
    gaugeGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", gapX + 10).attr("y", (gapY1 + gapY2) / 2 + 5)
      .attr("fill", C.rose).text("Gap: " + (REPLACEMENT - DATA.snapshot.tfr).toFixed(2));
  }

  // --- LINE VIEW (step 1): TFR over time ---
  const lineGroup = g.append("g").attr("class", "line-view").style("opacity", 0).style("pointer-events", "none");

  const xLine = d3.scaleLinear().domain([1960, 2024]).range([0, dim.innerW]);
  const yLine = d3.scaleLinear().domain([0, 3.2]).range([dim.innerH, 0]);

  // Grid
  lineGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yLine).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Replacement rate line
  lineGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yLine(REPLACEMENT)).attr("y2", yLine(REPLACEMENT))
    .attr("stroke", C.slate).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", dim.innerW + 4).attr("y", yLine(REPLACEMENT) + 4)
    .attr("fill", C.slate).text("2.1");
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xLine(1970)).attr("y", yLine(REPLACEMENT) - 8)
    .attr("fill", C.slate).text("Replacement rate");

  // Below-replacement shading
  var belowArea = d3.area()
    .x(function(d) { return xLine(d.year); })
    .y0(yLine(REPLACEMENT))
    .y1(function(d) { return d.tfrTotal < REPLACEMENT ? yLine(d.tfrTotal) : yLine(REPLACEMENT); })
    .curve(d3.curveMonotoneX);
  lineGroup.append("path").datum(tfrData)
    .attr("d", belowArea).attr("fill", C.roseLight).attr("stroke", "none");

  // TFR line
  var tfrLine = d3.line()
    .x(function(d) { return xLine(d.year); })
    .y(function(d) { return yLine(d.tfrTotal); })
    .curve(d3.curveMonotoneX);
  lineGroup.append("path").datum(tfrData)
    .attr("d", tfrLine).attr("fill", "none").attr("stroke", C.rose).attr("stroke-width", 3);

  // Dots at key points
  var keyYears = [1965, 2010, 2024];
  tfrData.filter(function(d) { return keyYears.indexOf(d.year) >= 0; }).forEach(function(d) {
    lineGroup.append("circle")
      .attr("cx", xLine(d.year)).attr("cy", yLine(d.tfrTotal))
      .attr("r", 5).attr("fill", C.rose).attr("stroke", "#fff").attr("stroke-width", 2);
  });

  // Annotations
  var peak = tfrData.find(function(d) { return d.year === 1965; });
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(1965)).attr("y", yLine(peak.tfrTotal) - 14)
    .attr("text-anchor", "middle").attr("fill", C.rose).text("Baby boom: " + peak.tfrTotal.toFixed(2));

  var latest = tfrData[tfrData.length - 1];
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xLine(latest.year) - 4).attr("y", yLine(latest.tfrTotal) - 14)
    .attr("text-anchor", "end").attr("fill", C.rose).text(latest.year + ": " + latest.tfrTotal.toFixed(2));

  // Mini recovery annotation — anchored to actual 2010 data point
  var recoveryPt = tfrData.find(function(d) { return d.year === 2010; });
  if (recoveryPt) {
    lineGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xLine(2010)).attr("y", yLine(recoveryPt.tfrTotal) - 28)
      .attr("text-anchor", "middle").attr("fill", C.muted).text("Brief recovery");
    lineGroup.append("line")
      .attr("x1", xLine(2010)).attr("x2", xLine(2010))
      .attr("y1", yLine(recoveryPt.tfrTotal) - 22).attr("y2", yLine(recoveryPt.tfrTotal) - 4)
      .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
  }

  // Axes
  lineGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xLine).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  lineGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yLine).ticks(7).tickFormat(function(d) { return d.toFixed(1); }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Hover
  var hoverRect = lineGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLine2 = lineGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  var hoverDot = lineGroup.append("circle").attr("r", 5).attr("fill", C.rose).attr("stroke", "#fff").attr("stroke-width", 2).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(xLine.invert(mx));
    var d = tfrData.reduce(function(prev, curr) { return Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev; });
    if (!d) return;
    hoverLine2.attr("x1", xLine(d.year)).attr("x2", xLine(d.year)).style("opacity", 1);
    hoverDot.attr("cx", xLine(d.year)).attr("cy", yLine(d.tfrTotal)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div><div class="tt-value">Total fertility rate: ' + d.tfrTotal.toFixed(2) + '</div>' +
      (d.tfrTotal < REPLACEMENT ? '<div class="tt-value" style="color:' + C.rose + '">' + (REPLACEMENT - d.tfrTotal).toFixed(2) + ' below replacement</div>' : '<div class="tt-value" style="color:' + C.teal + '">' + (d.tfrTotal - REPLACEMENT).toFixed(2) + ' above replacement</div>'), event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });
}

function updateHookChart(step) {
  var svg = d3.select("#chart-hook svg");
  if (step === 0) {
    svg.select(".gauge-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".gauge-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 2: BIRTH ORDER breakdown + mean age
   ========================================================= */
function buildOrderChart() {
  var container = document.getElementById("chart-order");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Fertility rate by birth order and mean age of mother at childbirth, 1960 to 2022");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var orderData = DATA.tfrByOrder.filter(function(d) { return d.tfr1 !== undefined; });
  var ageData = DATA.meanAgeByOrder;

  // --- STACKED AREA VIEW (step 0) ---
  var areaGroup = g.append("g").attr("class", "area-view");

  var xA = d3.scaleLinear().domain([1960, 2022]).range([0, dim.innerW]);
  var yA = d3.scaleLinear().domain([0, 3.2]).range([dim.innerH, 0]);

  // Grid
  areaGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yA).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Stacked areas
  var stack = d3.stack().keys(["tfr4", "tfr3", "tfr2", "tfr1"]).order(d3.stackOrderReverse);
  var series = stack(orderData);
  var colors = [C.order4, C.order3, C.order2, C.order1];
  var labels = ["4th+ child", "3rd child", "2nd child", "1st child"];

  var areaGen = d3.area()
    .x(function(d) { return xA(d.data.year); })
    .y0(function(d) { return yA(d[0]); })
    .y1(function(d) { return yA(d[1]); })
    .curve(d3.curveMonotoneX);

  series.forEach(function(s, i) {
    areaGroup.append("path").datum(s)
      .attr("d", areaGen)
      .attr("fill", colors[i]).attr("opacity", 0.7)
      .attr("stroke", colors[i]).attr("stroke-width", 0.5);
  });

  // Direct labels at the right edge — with collision avoidance
  var lastD = orderData[orderData.length - 1];
  var cumul = 0;
  var labelPositions = [];
  var minLabelGap = 16;
  ["tfr4", "tfr3", "tfr2", "tfr1"].forEach(function(key, i) {
    var val = lastD[key];
    var idealY = yA(cumul + val / 2) + 4;
    cumul += val;
    // Push labels apart if they overlap
    if (labelPositions.length > 0) {
      var prev = labelPositions[labelPositions.length - 1];
      if (prev - idealY < minLabelGap) {
        idealY = prev - minLabelGap;
      }
    }
    labelPositions.push(idealY);
    areaGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", dim.innerW + 4).attr("y", idealY)
      .attr("fill", colors[i]).attr("font-size", "13px")
      .text(labels[i]);
  });

  // Replacement rate line
  areaGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yA(REPLACEMENT)).attr("y2", yA(REPLACEMENT))
    .attr("stroke", "#666").attr("stroke-width", 1).attr("stroke-dasharray", "6,4");
  areaGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xA(1965)).attr("y", yA(REPLACEMENT) - 8)
    .attr("fill", "#666").text("Replacement: 2.1");

  // Axes
  areaGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xA).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  areaGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yA).ticks(7).tickFormat(function(d) { return d.toFixed(1); }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Hover
  var hoverRect = areaGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hLine = areaGroup.append("line").attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(xA.invert(mx));
    var d = orderData.reduce(function(prev, curr) { return Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev; });
    if (!d) return;
    hLine.attr("x1", xA(d.year)).attr("x2", xA(d.year)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value" style="color:' + C.order1 + '">1st child: ' + d.tfr1.toFixed(2) + '</div>' +
      '<div class="tt-value" style="color:' + C.order2 + '">2nd child: ' + d.tfr2.toFixed(2) + '</div>' +
      '<div class="tt-value" style="color:' + C.order3 + '">3rd child: ' + d.tfr3.toFixed(2) + '</div>' +
      '<div class="tt-value" style="color:' + C.order4 + '">4th+ child: ' + d.tfr4.toFixed(2) + '</div>' +
      '<div class="tt-value" style="font-weight:600">Total: ' + d.tfrTotal.toFixed(2) + '</div>', event);
  }).on("mouseleave", function() { hLine.style("opacity", 0); sobHideTooltip(); });

  // --- MEAN AGE VIEW (step 1) ---
  var ageGroup = g.append("g").attr("class", "age-view").style("opacity", 0).style("pointer-events", "none");

  var xAge = d3.scaleLinear().domain([1960, 2022]).range([0, dim.innerW]);
  var yAge = d3.scaleLinear().domain([22, 34]).range([dim.innerH, 0]);

  ageGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yAge).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  var ageKeys = [
    { key: "age1", label: "1st child", color: C.order1 },
    { key: "ageAll", label: "All births", color: C.muted },
    { key: "age2", label: "2nd child", color: C.order2 },
    { key: "age3", label: "3rd child", color: C.order3 }
  ];

  var lastA = ageData[ageData.length - 1];
  ageKeys.forEach(function(ak) {
    var lineGen = d3.line()
      .x(function(d) { return xAge(d.year); })
      .y(function(d) { return yAge(d[ak.key]); })
      .curve(d3.curveMonotoneX);
    ageGroup.append("path").datum(ageData)
      .attr("d", lineGen).attr("fill", "none")
      .attr("stroke", ak.color).attr("stroke-width", ak.key === "ageAll" ? 3 : 2)
      .attr("stroke-dasharray", ak.key === "ageAll" ? null : "6,3");
  });

  // Direct labels at end with collision avoidance
  var ageEndLabels = ageKeys.map(function(ak) {
    return { rawY: yAge(lastA[ak.key]) + 4, color: ak.color, text: ak.label + ": " + lastA[ak.key].toFixed(1) };
  });
  ageEndLabels.sort(function(a, b) { return a.rawY - b.rawY; });
  for (var ai = 1; ai < ageEndLabels.length; ai++) {
    if (ageEndLabels[ai].rawY - ageEndLabels[ai - 1].rawY < 18) {
      ageEndLabels[ai].rawY = ageEndLabels[ai - 1].rawY + 18;
    }
  }
  ageEndLabels.forEach(function(l) {
    ageGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", dim.innerW + 4).attr("y", l.rawY)
      .attr("fill", l.color).attr("font-size", "13px")
      .text(l.text);
  });

  // Highlight first-birth age shift
  var first1960 = ageData[0];
  var last2022 = ageData[ageData.length - 1];
  ageGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xAge(1963)).attr("y", yAge(first1960.age1) + 18)
    .attr("text-anchor", "start").attr("fill", C.rose)
    .text(first1960.age1.toFixed(1) + " years");
  ageGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xAge(2015)).attr("y", yAge(last2022.age1) - 14)
    .attr("text-anchor", "middle").attr("fill", C.rose)
    .text("+" + (last2022.age1 - first1960.age1).toFixed(1) + " years since 1960");

  // Axes
  ageGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xAge).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  ageGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yAge).ticks(7).tickFormat(function(d) { return d; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  ageGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Mean age of mother");

  // Hover
  var hoverRect2 = ageGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hLine2 = ageGroup.append("line").attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(xAge.invert(mx));
    var d = ageData.reduce(function(prev, curr) { return Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev; });
    if (!d) return;
    hLine2.attr("x1", xAge(d.year)).attr("x2", xAge(d.year)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value">All births: ' + d.ageAll.toFixed(1) + ' years</div>' +
      '<div class="tt-value" style="color:' + C.order1 + '">1st child: ' + d.age1.toFixed(1) + ' years</div>' +
      '<div class="tt-value" style="color:' + C.order2 + '">2nd child: ' + d.age2.toFixed(1) + ' years</div>' +
      '<div class="tt-value" style="color:' + C.order3 + '">3rd child: ' + d.age3.toFixed(1) + ' years</div>', event);
  }).on("mouseleave", function() { hLine2.style("opacity", 0); sobHideTooltip(); });
}

function updateOrderChart(step) {
  var svg = d3.select("#chart-order svg");
  if (step === 0) {
    svg.select(".area-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".age-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".area-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".age-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 3: ABSOLUTE BIRTHS
   ========================================================= */
function buildBirthsChart() {
  var container = document.getElementById("chart-births");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Live births in England and Wales, 1960 to 2024");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var birthsData = DATA.birthsSeries;

  // --- BAR VIEW (step 0): big number + area chart ---
  var barGroup = g.append("g").attr("class", "births-area-view");

  var xB = d3.scaleLinear().domain([1960, 2024]).range([0, dim.innerW]);
  var yB = d3.scaleLinear().domain([0, 950]).range([dim.innerH, 0]);

  // Grid
  barGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yB).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Area
  var birthArea = d3.area()
    .x(function(d) { return xB(d.year); })
    .y0(dim.innerH)
    .y1(function(d) { return yB(d.births); })
    .curve(d3.curveMonotoneX);
  barGroup.append("path").datum(birthsData)
    .attr("d", birthArea).attr("fill", C.roseLight).attr("stroke", "none");

  // Line
  var birthLine = d3.line()
    .x(function(d) { return xB(d.year); })
    .y(function(d) { return yB(d.births); })
    .curve(d3.curveMonotoneX);
  barGroup.append("path").datum(birthsData)
    .attr("d", birthLine).attr("fill", "none").attr("stroke", C.rose).attr("stroke-width", 3);

  // Dots at peak and trough
  var peak = birthsData.reduce(function(a, b) { return a.births > b.births ? a : b; });
  var latest = birthsData[birthsData.length - 1];

  barGroup.append("circle")
    .attr("cx", xB(peak.year)).attr("cy", yB(peak.births))
    .attr("r", 5).attr("fill", C.rose).attr("stroke", "#fff").attr("stroke-width", 2);
  barGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xB(peak.year)).attr("y", yB(peak.births) - 14)
    .attr("text-anchor", "middle").attr("fill", C.rose)
    .text(peak.year + ": " + peak.births + "k");

  barGroup.append("circle")
    .attr("cx", xB(latest.year)).attr("cy", yB(latest.births))
    .attr("r", 5).attr("fill", C.rose).attr("stroke", "#fff").attr("stroke-width", 2);
  barGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xB(latest.year) - 4).attr("y", yB(latest.births) - 14)
    .attr("text-anchor", "end").attr("fill", C.rose)
    .text(latest.year + ": " + latest.births + "k");

  // Drop annotation
  var dropPct = Math.round((1 - latest.births / peak.births) * 100);
  var midYear = Math.round((peak.year + latest.year) / 2);
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xB(midYear)).attr("y", yB((peak.births + latest.births) / 2))
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("-" + dropPct + "% from peak");

  // Axes
  barGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xB).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  barGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yB).ticks(6).tickFormat(function(d) { return d + "k"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Live births (thousands)");

  // Hover
  var hoverRect = barGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hLine = barGroup.append("line").attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  var hDot = barGroup.append("circle").attr("r", 5).attr("fill", C.rose).attr("stroke", "#fff").attr("stroke-width", 2).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(xB.invert(mx));
    var d = birthsData.reduce(function(prev, curr) { return Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev; });
    if (!d) return;
    hLine.attr("x1", xB(d.year)).attr("x2", xB(d.year)).style("opacity", 1);
    hDot.attr("cx", xB(d.year)).attr("cy", yB(d.births)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value">' + d3.format(",")(d.births) + ',000 live births</div>' +
      '<div class="tt-value" style="color:' + C.rose + '">' + (d.births < peak.births ? (Math.round((1 - d.births / peak.births) * 100) + '% below ' + peak.year + ' peak') : 'Peak year') + '</div>', event);
  }).on("mouseleave", function() { hLine.style("opacity", 0); hDot.style("opacity", 0); sobHideTooltip(); });

  // --- FEEDBACK LOOP VIEW (step 1): same chart with annotation overlay ---
  var feedbackGroup = g.append("g").attr("class", "feedback-view").style("opacity", 0).style("pointer-events", "none");

  // Redraw the area in this group too
  feedbackGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yB).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  feedbackGroup.append("path").datum(birthsData)
    .attr("d", birthArea).attr("fill", C.roseLight).attr("stroke", "none");
  feedbackGroup.append("path").datum(birthsData)
    .attr("d", birthLine).attr("fill", "none").attr("stroke", C.rose).attr("stroke-width", 3);

  // Generation arrows
  var gen1Start = 1964, gen1End = 1990;
  var gen2Start = 1990, gen2End = 2016;

  // Gen 1 arrow
  feedbackGroup.append("line")
    .attr("x1", xB(gen1Start)).attr("y1", yB(peak.births) - 30)
    .attr("x2", xB(gen1End)).attr("y2", yB(peak.births) - 30)
    .attr("stroke", C.warm).attr("stroke-width", 2).attr("marker-end", "none");
  feedbackGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xB((gen1Start + gen1End) / 2)).attr("y", yB(peak.births) - 38)
    .attr("text-anchor", "middle").attr("fill", C.warm).attr("font-size", "13px")
    .text("Generation 1 reaches parenthood");

  // Gen 2 arrow
  feedbackGroup.append("line")
    .attr("x1", xB(gen2Start)).attr("y1", yB(peak.births) - 10)
    .attr("x2", xB(gen2End)).attr("y2", yB(peak.births) - 10)
    .attr("stroke", C.teal).attr("stroke-width", 2);
  feedbackGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xB((gen2Start + gen2End) / 2)).attr("y", yB(peak.births) - 18)
    .attr("text-anchor", "middle").attr("fill", C.teal).attr("font-size", "13px")
    .text("Generation 2: smaller cohort");

  // Annotation: feedback loop
  feedbackGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xB(2010)).attr("y", yB(700))
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("Fewer parents = fewer births");
  feedbackGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xB(2010)).attr("y", yB(700) + 18)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("= even fewer future parents");

  // Axes
  feedbackGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xB).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  feedbackGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yB).ticks(6).tickFormat(function(d) { return d + "k"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
}

function updateBirthsChart(step) {
  var svg = d3.select("#chart-births svg");
  if (step === 0) {
    svg.select(".births-area-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".feedback-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".births-area-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".feedback-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 4: FAMILY STRUCTURE + HOUSEHOLD SIZE
   ========================================================= */
function buildFamiliesChart() {
  var container = document.getElementById("chart-families");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Family types and average household size in the UK, 2004 to 2024");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var famData = DATA.familyTypeSeries;
  var hhData = DATA.householdSizeSeries;

  // --- STACKED FAMILY TYPE (step 0) ---
  var famGroup = g.append("g").attr("class", "fam-view");

  var xF = d3.scaleLinear().domain([2004, 2024]).range([0, dim.innerW]);
  var yF = d3.scaleLinear().domain([0, 21000]).range([dim.innerH, 0]);

  famGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yF).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Stacked areas
  var stackedData = famData.map(function(d) { return { year: d.year, married: d.married, cohabiting: d.cohabiting, loneParent: d.loneParent }; });
  var famStack = d3.stack().keys(["loneParent", "cohabiting", "married"]).order(d3.stackOrderReverse);
  var famSeries = famStack(stackedData);
  var famColors = [C.order4, C.warm, C.rose];
  var famLabels = ["Lone parent", "Cohabiting", "Married couple"];

  var famAreaGen = d3.area()
    .x(function(d) { return xF(d.data.year); })
    .y0(function(d) { return yF(d[0]); })
    .y1(function(d) { return yF(d[1]); })
    .curve(d3.curveMonotoneX);

  famSeries.forEach(function(s, i) {
    famGroup.append("path").datum(s)
      .attr("d", famAreaGen)
      .attr("fill", famColors[i]).attr("opacity", 0.65)
      .attr("stroke", famColors[i]).attr("stroke-width", 0.5);
  });

  // Direct labels — with collision avoidance
  var lastFam = stackedData[stackedData.length - 1];
  var famCumul = 0;
  var famLabelPositions = [];
  var minLabelGap = 16;
  ["loneParent", "cohabiting", "married"].forEach(function(key, i) {
    var val = lastFam[key];
    var idealY = yF(famCumul + val / 2) + 4;
    famCumul += val;
    if (famLabelPositions.length > 0) {
      var prev = famLabelPositions[famLabelPositions.length - 1];
      if (prev - idealY < minLabelGap) {
        idealY = prev - minLabelGap;
      }
    }
    famLabelPositions.push(idealY);
    famGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", dim.innerW + 4).attr("y", idealY)
      .attr("fill", famColors[i]).attr("font-size", "13px")
      .text(famLabels[i]);
  });

  // Axes
  famGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xF).ticks(6).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  famGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yF).ticks(6).tickFormat(function(d) { return d3.format(",")(d / 1000) + "m"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  famGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Families (millions)");

  // Hover
  var hoverRect = famGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hLine = famGroup.append("line").attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(xF.invert(mx));
    var d = famData.reduce(function(prev, curr) { return Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev; });
    if (!d) return;
    hLine.attr("x1", xF(d.year)).attr("x2", xF(d.year)).style("opacity", 1);
    var total = d.married + d.cohabiting + d.loneParent;
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value" style="color:' + C.rose + '">Married: ' + d3.format(",")(d.married) + 'k (' + Math.round(d.married / total * 100) + '%)</div>' +
      '<div class="tt-value" style="color:' + C.warm + '">Cohabiting: ' + d3.format(",")(d.cohabiting) + 'k (' + Math.round(d.cohabiting / total * 100) + '%)</div>' +
      '<div class="tt-value" style="color:' + C.order4 + '">Lone parent: ' + d3.format(",")(d.loneParent) + 'k (' + Math.round(d.loneParent / total * 100) + '%)</div>', event);
  }).on("mouseleave", function() { hLine.style("opacity", 0); sobHideTooltip(); });

  // --- HOUSEHOLD SIZE (step 1) ---
  var hhGroup = g.append("g").attr("class", "hh-view").style("opacity", 0).style("pointer-events", "none");

  var xH = d3.scaleLinear().domain([1961, 2024]).range([0, dim.innerW]);
  var yH = d3.scaleLinear().domain([2.0, 3.3]).range([dim.innerH, 0]);

  hhGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yH).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Line (no area fill — baseline is truncated at 2.0, area would exaggerate decline)
  var hhLine = d3.line()
    .x(function(d) { return xH(d.year); })
    .y(function(d) { return yH(d.size); })
    .curve(d3.curveMonotoneX);
  hhGroup.append("path").datum(hhData)
    .attr("d", hhLine).attr("fill", "none").attr("stroke", C.mauve).attr("stroke-width", 3);

  // Key points
  var hhFirst = hhData[0];
  var hhLast = hhData[hhData.length - 1];
  hhGroup.append("circle")
    .attr("cx", xH(hhFirst.year)).attr("cy", yH(hhFirst.size))
    .attr("r", 5).attr("fill", C.mauve).attr("stroke", "#fff").attr("stroke-width", 2);
  hhGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xH(hhFirst.year) + 10).attr("y", yH(hhFirst.size) + 5)
    .attr("fill", C.mauve).text(hhFirst.year + ": " + hhFirst.size.toFixed(2));

  hhGroup.append("circle")
    .attr("cx", xH(hhLast.year)).attr("cy", yH(hhLast.size))
    .attr("r", 5).attr("fill", C.mauve).attr("stroke", "#fff").attr("stroke-width", 2);
  hhGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xH(hhLast.year) - 10).attr("y", yH(hhLast.size) - 14)
    .attr("text-anchor", "end").attr("fill", C.mauve)
    .text(hhLast.year + ": " + hhLast.size.toFixed(2));

  // Drop annotation
  hhGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xH(1990)).attr("y", yH(2.75))
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("-" + ((1 - hhLast.size / hhFirst.size) * 100).toFixed(0) + "% since 1961");

  // Axes
  hhGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xH).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  hhGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yH).ticks(7).tickFormat(function(d) { return d.toFixed(1); }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  hhGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Average persons per household");

  // Hover
  var hoverRect2 = hhGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hLine2 = hhGroup.append("line").attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2").style("opacity", 0);
  var hDot2 = hhGroup.append("circle").attr("r", 5).attr("fill", C.mauve).attr("stroke", "#fff").attr("stroke-width", 2).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(xH.invert(mx));
    var d = hhData.reduce(function(prev, curr) { return Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev; });
    if (!d) return;
    hLine2.attr("x1", xH(d.year)).attr("x2", xH(d.year)).style("opacity", 1);
    hDot2.attr("cx", xH(d.year)).attr("cy", yH(d.size)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div>' +
      '<div class="tt-value">Average household size: ' + d.size.toFixed(2) + ' people</div>', event);
  }).on("mouseleave", function() { hLine2.style("opacity", 0); hDot2.style("opacity", 0); sobHideTooltip(); });
}

function updateFamiliesChart(step) {
  var svg = d3.select("#chart-families svg");
  if (step === 0) {
    svg.select(".fam-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".hh-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".fam-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".hh-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 5: WHY IT MATTERS — dependency + summary
   ========================================================= */
function buildWhyChart() {
  var container = document.getElementById("chart-why");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Fertility rate and live births on dual axes, plus summary dashboard of key demographic metrics");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  // --- DEPENDENCY VIEW (step 0): TFR + births dual axis to show compounding ---
  var depGroup = g.append("g").attr("class", "dep-view");

  var tfrData = DATA.tfrByOrder;
  var birthsData = DATA.birthsSeries;

  var xD = d3.scaleLinear().domain([1960, 2024]).range([0, dim.innerW]);
  var yLeft = d3.scaleLinear().domain([0, 3.2]).range([dim.innerH, 0]);
  var yRight = d3.scaleLinear().domain([0, 950]).range([dim.innerH, 0]);

  depGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yLeft).ticks(7).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Replacement line
  depGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yLeft(REPLACEMENT)).attr("y2", yLeft(REPLACEMENT))
    .attr("stroke", "#888").attr("stroke-width", 1).attr("stroke-dasharray", "6,4");
  depGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 4).attr("y", yLeft(REPLACEMENT) - 8)
    .attr("fill", "#888").text("Replacement rate");

  // TFR line
  var tfrLine = d3.line()
    .x(function(d) { return xD(d.year); })
    .y(function(d) { return yLeft(d.tfrTotal); })
    .curve(d3.curveMonotoneX);
  depGroup.append("path").datum(tfrData)
    .attr("d", tfrLine).attr("fill", "none").attr("stroke", C.rose).attr("stroke-width", 3);

  // Births line (right axis)
  var birthLine = d3.line()
    .x(function(d) { return xD(d.year); })
    .y(function(d) { return yRight(d.births); })
    .curve(d3.curveMonotoneX);
  depGroup.append("path").datum(birthsData)
    .attr("d", birthLine).attr("fill", "none").attr("stroke", C.warm).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "8,4");

  // Direct labels
  var lastTFR = tfrData[tfrData.length - 1];
  var lastBirths = birthsData[birthsData.length - 1];
  depGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", dim.innerW + 4).attr("y", yLeft(lastTFR.tfrTotal) + 4)
    .attr("fill", C.rose).text("TFR: " + lastTFR.tfrTotal.toFixed(2));
  depGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", dim.innerW + 4).attr("y", yRight(lastBirths.births) + 4)
    .attr("fill", C.warm).text("Births: " + lastBirths.births + "k");

  // Axes
  depGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xD).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  depGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yLeft).ticks(7).tickFormat(function(d) { return d.toFixed(1); }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); })
    .selectAll("text").attr("fill", C.rose);
  depGroup.append("g").attr("class", "axis y-axis-right")
    .attr("transform", "translate(" + dim.innerW + ",0)")
    .call(d3.axisRight(yRight).ticks(6).tickFormat(function(d) { return d + "k"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); })
    .selectAll("text").attr("fill", C.warm);

  depGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.rose)
    .text("Total fertility rate");
  depGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", -10)
    .attr("text-anchor", "end").attr("fill", C.warm)
    .text("Births (thousands)");

  // Dual-axis caveat
  depGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW / 2).attr("y", dim.innerH + 34)
    .attr("text-anchor", "middle").attr("fill", C.faint)
    .attr("font-size", "11px")
    .text("Note: two independent scales — compare trends, not magnitudes");

  // --- SUMMARY VIEW (step 1): key metrics dashboard ---
  var sumGroup = g.append("g").attr("class", "sum-view").style("opacity", 0).style("pointer-events", "none");

  var snap = DATA.snapshot;
  var metrics = [
    { label: "Total fertility rate", value: snap.tfr.toFixed(2), sub: "Lowest ever recorded", color: C.rose },
    { label: "Live births (2024)", value: d3.format(",")(snap.liveBirths), sub: "32% below 1964 peak", color: C.roseMid },
    { label: "Mean age at first birth", value: snap.meanAge1st.toFixed(1), sub: "+5.1 years since 1960", color: C.warm },
    { label: "Avg household size", value: snap.avgHouseholdSize.toFixed(2), sub: "Down from 3.09 in 1961", color: C.mauve },
    { label: "Married families", value: snap.marriedPct + "%", sub: "Of all families", color: C.slate },
    { label: "Young adults at home", value: snap.youngAdultsWithParentsPct + "%", sub: "Living with parents", color: C.teal }
  ];

  var cols = 2;
  var rows = 3;
  var cellW = dim.innerW / cols;
  var cellH = dim.innerH / rows;

  metrics.forEach(function(m, i) {
    var col = i % cols;
    var row = Math.floor(i / cols);
    var cx = col * cellW + cellW / 2;
    var cy = row * cellH + cellH / 2;

    sumGroup.append("text")
      .attr("x", cx).attr("y", cy - 18)
      .attr("text-anchor", "middle")
      .attr("font-family", "'Source Serif 4', serif")
      .attr("font-size", sobIsMobile() ? "24px" : "32px")
      .attr("font-weight", 700)
      .attr("fill", m.color)
      .text(m.value);

    sumGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", cx).attr("y", cy + 10)
      .attr("text-anchor", "middle").attr("fill", C.ink)
      .text(m.label);

    sumGroup.append("text").attr("class", "chart-annotation")
      .attr("x", cx).attr("y", cy + 28)
      .attr("text-anchor", "middle").attr("fill", C.muted)
      .text(m.sub);
  });
}

function updateWhyChart(step) {
  var svg = d3.select("#chart-why svg");
  if (step === 0) {
    svg.select(".dep-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".sum-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".dep-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".sum-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "order": updateOrderChart(step); break;
    case "births": updateBirthsChart(step); break;
    case "families": updateFamiliesChart(step); break;
    case "why": updateWhyChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); }

})();
