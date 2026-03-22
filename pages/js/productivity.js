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


function chartDimsBar(container) {
  const w = container.clientWidth;
  const mobile = sobIsMobile();
  const h = Math.max(mobile ? 400 : 560, Math.min(mobile ? 500 : 700, window.innerHeight * (mobile ? 0.6 : 0.75)));
  const m = { top: 24, right: mobile ? 40 : 80, bottom: 16, left: mobile ? 120 : 280 };
  return { width: w, height: h, margin: m, innerW: w - m.left - m.right, innerH: h - m.top - m.bottom };
}



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/productivity.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big number: growth from 2008 to 2024
  const idx2008 = DATA.indexSeries.find(d => d.year === 2008).index;
  const idx2024 = DATA.indexSeries.find(d => d.year === 2024).index;
  const growth = ((idx2024 - idx2008) / idx2008 * 100).toFixed(0);
  document.getElementById("bn-growth").textContent = growth + "%";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-hook svg, #chart-international svg, #chart-sectors svg, #chart-matters svg").remove();
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
  buildInternationalChart();
  buildSectorsChart();
  buildMattersChart();
}

/* =========================================================
   CHART 1: THE HOOK — Index series with counterfactual
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height);
  const g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  const series = DATA.indexSeries;
  const x = d3.scaleLinear().domain([1971, 2024]).range([0, dim.innerW]);

  // Compute counterfactual first so yMax encompasses it
  const idx1992 = series.find(d => d.year === 1992).index;
  const idx2008 = series.find(d => d.year === 2008).index;
  const annualGrowth = Math.pow(idx2008 / idx1992, 1 / 16) - 1;
  const counterfactual = [];
  for (let yr = 2008; yr <= 2024; yr++) {
    counterfactual.push({ year: yr, index: idx2008 * Math.pow(1 + annualGrowth, yr - 2008) });
  }

  const dataMin = d3.min(series, d => d.index);
  const cfMax = counterfactual[counterfactual.length - 1].index;
  const dataMax = Math.max(d3.max(series, d => d.index), cfMax);
  const yFloor = Math.max(0, Math.floor(dataMin / 10) * 10 - 10);
  const yMax = Math.ceil(dataMax / 10) * 10 + 10;
  const y = d3.scaleLinear().domain([yFloor, yMax]).range([dim.innerH, 0]).nice();

  // ---- Step 0 view: basic index line ----
  const basicGroup = g.append("g").attr("class", "basic-view");

  // Grid
  basicGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // X axis
  basicGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).tickValues([1975, 1985, 1995, 2005, 2015, 2024]).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Y axis
  basicGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickSize(0).tickFormat(function(d) { return d; }))
    .call(function(g) { g.select(".domain").remove(); });

  // Y-axis label (horizontal, above axis)
  basicGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Output per hour (index, 2023=100)");

  // Main line
  var lineGen = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.index); }).curve(d3.curveMonotoneX);
  basicGroup.append("path").datum(series)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.indigo).attr("stroke-width", 2.5);

  // 2008 marker
  var d2008 = series.find(function(d) { return d.year === 2008; });
  basicGroup.append("circle").attr("cx", x(2008)).attr("cy", y(d2008.index)).attr("r", 4)
    .attr("fill", C.indigo).attr("stroke", "#fff").attr("stroke-width", 2);
  basicGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2008)).attr("y", y(d2008.index) - 14)
    .attr("text-anchor", "middle").attr("fill", C.indigo)
    .text("2008 crisis");

  // End label — anchored left of endpoint to avoid right-edge clipping
  var last = series[series.length - 1];
  basicGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(last.year) - 8).attr("y", y(last.index) - 12)
    .attr("text-anchor", "end").attr("fill", C.indigo).text(last.index.toFixed(1));

  // Hover overlay
  var hoverRect = basicGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLine = basicGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  var hoverDot = basicGroup.append("circle").attr("r", 4).attr("fill", C.indigo).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = series.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot.attr("cx", x(year)).attr("cy", y(d.index)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div><div class="tt-value">Index: ' + d.index.toFixed(1) + '</div>', event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // ---- Step 1 view: counterfactual trend (hidden) ----
  var trendGroup = g.append("g").attr("class", "trend-view").style("opacity", 0);

  // Grid
  trendGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // X axis
  trendGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).tickValues([1975, 1985, 1995, 2005, 2015, 2024]).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Y axis
  trendGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickSize(0).tickFormat(function(d) { return d; }))
    .call(function(g) { g.select(".domain").remove(); });

  // Actual line
  trendGroup.append("path").datum(series)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.indigo).attr("stroke-width", 2.5);

  // Counterfactual dashed line
  var trendLine = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.index); }).curve(d3.curveMonotoneX);
  trendGroup.append("path").datum(counterfactual)
    .attr("d", trendLine).attr("fill", "none").attr("stroke", C.trendDash).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "8,5");

  // Shaded gap between counterfactual and actual (2008-2024)
  var gapArea = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(function(d) {
      var actual = series.find(function(s) { return s.year === d.year; });
      return actual ? y(actual.index) : y(0);
    })
    .y1(function(d) { return y(d.index); })
    .curve(d3.curveMonotoneX);
  trendGroup.append("path").datum(counterfactual)
    .attr("d", gapArea).attr("fill", "rgba(67,56,202,0.08)");

  // Labels — counterfactual ABOVE dashed line endpoint, actual BELOW solid line endpoint
  var cfLast = counterfactual[counterfactual.length - 1];
  trendGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(cfLast.year)).attr("y", y(cfLast.index) - 16)
    .attr("text-anchor", "end").attr("fill", C.trendDash).text("~" + cfLast.index.toFixed(0) + " if trend continued");

  trendGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(last.year)).attr("y", y(last.index) + 20)
    .attr("text-anchor", "end").attr("fill", C.indigo).text(last.index.toFixed(1) + " actual");

  // "The lost output" label — centered in the gap between the two lines
  var midYear = 2016;
  var cfMid = counterfactual.find(function(d) { return d.year === midYear; });
  var actMid = series.find(function(d) { return d.year === midYear; });
  if (cfMid && actMid) {
    var gapMidY0 = y(actMid.index);
    var gapMidY1 = y(cfMid.index);
    var gapMidX = x(midYear);
    trendGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", gapMidX).attr("y", (gapMidY0 + gapMidY1) / 2 + 5)
      .attr("text-anchor", "middle")
      .attr("fill", C.indigo).attr("font-size", "13px")
      .text("The lost output");
  }
}

function updateHookChart(step) {
  var container = document.getElementById("chart-hook");
  var svg = d3.select(container).select("svg");
  if (step === 0) {
    svg.select(".basic-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".trend-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".basic-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".trend-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 2: INTERNATIONAL — Time series lines + bar chart
   ========================================================= */
function buildInternationalChart() {
  var container = document.getElementById("chart-international");
  var dim = sobChartDims(container);
  var dimBar = chartDimsBar(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height);
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var ts = DATA.timeSeries;
  var countries = [
    { key: "USA", label: "United States", color: C.usa },
    { key: "DEU", label: "Germany", color: C.germany },
    { key: "FRA", label: "France", color: C.france },
    { key: "GBR", label: "United Kingdom", color: C.gbr },
    { key: "OECD", label: "OECD Average", color: C.oecd }
  ];

  var x = d3.scaleLinear().domain([2000, 2023]).range([0, dim.innerW]);
  var yMax = d3.max(ts, function(d) { return Math.max(d.USA || 0, d.DEU || 0, d.FRA || 0, d.GBR || 0); }) * 1.1;
  var y = d3.scaleLinear().domain([0, yMax]).range([dim.innerH, 0]);

  // ---- Step 0: Time series lines ----
  var lineGroup = g.append("g").attr("class", "intl-line-view");

  // Grid
  lineGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // X axis
  lineGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Y axis
  lineGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickSize(0).tickFormat(function(d) { return "$" + d; }))
    .call(function(g) { g.select(".domain").remove(); });

  // Y label (horizontal, above axis)
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("GDP per hour (USD, PPP)");

  // Lines
  var intlEndLabels = [];
  countries.forEach(function(c) {
    var lineData = ts.filter(function(d) { return d[c.key] !== null; });
    var lineGen = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d[c.key]); })
      .curve(d3.curveMonotoneX);
    lineGroup.append("path").datum(lineData)
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", c.color)
      .attr("stroke-width", c.key === "GBR" ? 3 : 2)
      .attr("stroke-dasharray", c.key === "OECD" ? "6,4" : "none")
      .attr("opacity", c.key === "OECD" ? 0.7 : 1);

    // Collect end label
    var lastVal = lineData[lineData.length - 1];
    if (lastVal) {
      intlEndLabels.push({
        rawY: y(lastVal[c.key]) + 4,
        xPos: x(lastVal.year) + 6,
        color: c.color,
        text: c.label === "United States" ? "US" : c.label === "United Kingdom" ? "UK" : c.label === "OECD Average" ? "OECD" : c.key
      });
    }
  });

  // Collision avoidance for end labels — nudge apart from center with 16px minimum gap
  intlEndLabels.sort(function(a, b) { return a.rawY - b.rawY; });
  var minGap = 16;
  // Iteratively nudge overlapping labels apart from their shared center
  for (var pass = 0; pass < 5; pass++) {
    for (var ili = 1; ili < intlEndLabels.length; ili++) {
      var gap = intlEndLabels[ili].rawY - intlEndLabels[ili - 1].rawY;
      if (gap < minGap) {
        var nudge = (minGap - gap) / 2;
        intlEndLabels[ili - 1].rawY -= nudge;
        intlEndLabels[ili].rawY += nudge;
      }
    }
  }
  intlEndLabels.forEach(function(l) {
    lineGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", l.xPos).attr("y", l.rawY)
      .attr("fill", l.color)
      .attr("font-size", "13px")
      .text(l.text);
  });

  // Hover
  var hoverRect = lineGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLine = lineGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);

  var hoverDots = {};
  countries.forEach(function(c) {
    hoverDots[c.key] = lineGroup.append("circle").attr("r", 4).attr("fill", c.color).style("opacity", 0);
  });

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = ts.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    var ttHtml = '<div class="tt-label">' + year + '</div>';
    countries.forEach(function(c) {
      if (d[c.key] !== null) {
        hoverDots[c.key].attr("cx", x(year)).attr("cy", y(d[c.key])).style("opacity", 1);
        ttHtml += '<div class="tt-value" style="color:' + c.color + '">' + (c.label === "United Kingdom" ? "UK" : c.label === "United States" ? "US" : c.key) + ': $' + d[c.key].toFixed(2) + '</div>';
      }
    });
    sobShowTooltip(ttHtml, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0);
    countries.forEach(function(c) { hoverDots[c.key].style("opacity", 0); });
    sobHideTooltip();
  });

  // ---- Step 1: Bar chart of 2023 levels (hidden) ----
  // Use a separate transform to accommodate wider left margin for country labels
  var barGroup = g.append("g").attr("class", "intl-bar-view")
    .attr("transform", "translate(" + (dimBar.margin.left - dim.margin.left) + ",0)")
    .style("opacity", 0).style("pointer-events", "none");

  // Filter to key countries for the bar
  var barCountries = DATA.international.filter(function(d) {
    return ["USA", "DEU", "FRA", "GBR", "ITA", "CAN", "JPN", "OECD"].indexOf(d.countryCode) >= 0;
  }).sort(function(a, b) { return b.usdPPP - a.usdPPP; });

  var barInnerW = dim.width - dimBar.margin.left - dimBar.margin.right;
  var xBar = d3.scaleLinear().domain([0, d3.max(barCountries, function(d) { return d.usdPPP; }) * 1.12]).range([0, barInnerW]);
  var yBar = d3.scaleBand().domain(barCountries.map(function(d) { return d.country; })).range([0, dim.innerH]).padding(0.25);

  // Grid
  barGroup.append("g").attr("class", "grid")
    .attr("transform", "translate(0,0)")
    .call(d3.axisTop(xBar).ticks(5).tickSize(-dim.innerH).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // X axis
  barGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xBar).ticks(5).tickFormat(function(d) { return "$" + d; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Bars
  barGroup.selectAll(".bar-intl")
    .data(barCountries)
    .enter().append("rect")
    .attr("class", "bar-intl")
    .attr("x", 0)
    .attr("y", function(d) { return yBar(d.country); })
    .attr("width", function(d) { return xBar(d.usdPPP); })
    .attr("height", yBar.bandwidth())
    .attr("fill", function(d) { return d.countryCode === "GBR" ? C.indigo : d.countryCode === "OECD" ? C.oecd : "#A8B5CF"; })
    .attr("rx", 3)
    .on("mousemove", function(event, d) {
      sobShowTooltip('<div class="tt-label">' + d.country + '</div><div class="tt-value">$' + d.usdPPP.toFixed(1) + ' per hour (PPP)</div>', event);
    })
    .on("mouseleave", sobHideTooltip);

  // Country labels
  barGroup.selectAll(".bar-label")
    .data(barCountries)
    .enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", -8)
    .attr("y", function(d) { return yBar(d.country) + yBar.bandwidth() / 2 + 5; })
    .attr("text-anchor", "end")
    .attr("fill", function(d) { return d.countryCode === "GBR" ? C.indigo : C.ink; })
    .attr("font-size", "13px")
    .text(function(d) { return d.country; });

  // Value labels
  barGroup.selectAll(".bar-val")
    .data(barCountries)
    .enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", function(d) { return xBar(d.usdPPP) + 6; })
    .attr("y", function(d) { return yBar(d.country) + yBar.bandwidth() / 2 + 5; })
    .attr("fill", function(d) { return d.countryCode === "GBR" ? C.indigo : C.muted; })
    .attr("font-size", "13px")
    .text(function(d) { return "$" + d.usdPPP.toFixed(1); });
}

function updateInternationalChart(step) {
  var container = document.getElementById("chart-international");
  var svg = d3.select(container).select("svg");
  if (step === 0) {
    svg.select(".intl-line-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".intl-bar-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".intl-line-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".intl-bar-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 3: SECTOR BREAKDOWN — Horizontal bar chart
   ========================================================= */
function buildSectorsChart() {
  var container = document.getElementById("chart-sectors");
  var dim = chartDimsBar(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height);
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var sectors = DATA.sectorBreakdown.slice().sort(function(a, b) { return a.gbpPerHour - b.gbpPerHour; });

  // Shorten long sector names
  function shortName(s) {
    var map = {
      "Electricity, gas, steam and air conditioning supply": "Electricity & gas",
      "Mining and quarrying": "Mining & quarrying",
      "Financial and insurance activities": "Finance & insurance",
      "Real estate activities excluding imputed rental": "Real estate",
      "Water supply; sewerage, waste management and remediation activities": "Water & waste",
      "Information and communication": "Info & comms",
      "Public administration and defence; compulsory social security": "Public admin & defence",
      "Professional, scientific and technical activities": "Professional services",
      "Human health and social activities": "Health & social care",
      "Transportation and storage": "Transport & storage",
      "Administrative and support service activities": "Admin & support",
      "Arts, entertainment and recreation": "Arts & recreation",
      "Other service activities including households as employers": "Other services",
      "Agriculture forestry and fishing": "Agriculture",
      "Accommodation and food service activities": "Hospitality"
    };
    return map[s] || s;
  }

  var x = d3.scaleLinear().domain([0, 270]).range([0, dim.innerW]);
  var yBand = d3.scaleBand().domain(sectors.map(function(d) { return shortName(d.sector); })).range([dim.innerH, 0]).padding(0.2);

  // UK average line
  var avgVal = DATA.levelSeries.find(function(d) { return d.year === 2024; }).gbpPerHour;

  // ---- Step 0: all bars ----
  var allGroup = g.append("g").attr("class", "sectors-all-view");

  // Grid
  allGroup.append("g").attr("class", "grid")
    .call(d3.axisTop(x).ticks(5).tickSize(-dim.innerH).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Average line
  allGroup.append("line")
    .attr("x1", x(avgVal)).attr("x2", x(avgVal))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.indigo).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  allGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(avgVal) + 4).attr("y", -6)
    .attr("fill", C.indigo).attr("font-size", "13px")
    .text("UK avg \u00a3" + avgVal.toFixed(0) + "/hr");

  // Bars
  allGroup.selectAll(".bar-sector")
    .data(sectors)
    .enter().append("rect")
    .attr("class", "bar-sector")
    .attr("x", 0)
    .attr("y", function(d) { return yBand(shortName(d.sector)); })
    .attr("width", function(d) { return x(d.gbpPerHour); })
    .attr("height", yBand.bandwidth())
    .attr("fill", function(d) { return d.gbpPerHour >= avgVal ? C.indigo : "#A8B5CF"; })
    .attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip('<div class="tt-label">' + d.sector + '</div><div class="tt-value">\u00a3' + d.gbpPerHour.toFixed(2) + ' per hour</div>', event);
    })
    .on("mouseleave", sobHideTooltip);

  // Sector labels
  allGroup.selectAll(".sector-label")
    .data(sectors)
    .enter().append("text")
    .attr("class", "chart-annotation")
    .attr("x", -8)
    .attr("y", function(d) { return yBand(shortName(d.sector)) + yBand.bandwidth() / 2 + 4; })
    .attr("text-anchor", "end")
    .attr("fill", C.ink)
    .attr("font-size", "13px")
    .text(function(d) { return shortName(d.sector); });

  // Value labels
  allGroup.selectAll(".sector-val")
    .data(sectors)
    .enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", function(d) { return x(d.gbpPerHour) + 4; })
    .attr("y", function(d) { return yBand(shortName(d.sector)) + yBand.bandwidth() / 2 + 4; })
    .attr("fill", function(d) { return d.gbpPerHour >= avgVal ? C.indigo : C.muted; })
    .attr("font-size", "13px")
    .text(function(d) { return "\u00a3" + d.gbpPerHour.toFixed(0); });

  // ---- Step 1: highlight bottom half ----
  var highlightGroup = g.append("g").attr("class", "sectors-highlight-view").style("opacity", 0).style("pointer-events", "none");

  // Grid
  highlightGroup.append("g").attr("class", "grid")
    .call(d3.axisTop(x).ticks(5).tickSize(-dim.innerH).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Average line
  highlightGroup.append("line")
    .attr("x1", x(avgVal)).attr("x2", x(avgVal))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.indigo).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  highlightGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(avgVal) + 4).attr("y", -6)
    .attr("fill", C.indigo).attr("font-size", "13px")
    .text("UK avg \u00a3" + avgVal.toFixed(0) + "/hr");

  var median = sectors[Math.floor(sectors.length / 2)].gbpPerHour;

  // Bars - dim the top half
  highlightGroup.selectAll(".bar-sector-hl")
    .data(sectors)
    .enter().append("rect")
    .attr("class", "bar-sector-hl")
    .attr("x", 0)
    .attr("y", function(d) { return yBand(shortName(d.sector)); })
    .attr("width", function(d) { return x(d.gbpPerHour); })
    .attr("height", yBand.bandwidth())
    .attr("fill", function(d) { return d.gbpPerHour < median ? C.red : "#E0E0DB"; })
    .attr("opacity", function(d) { return d.gbpPerHour < median ? 1 : 0.4; })
    .attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip('<div class="tt-label">' + d.sector + '</div><div class="tt-value">\u00a3' + d.gbpPerHour.toFixed(2) + ' per hour</div>', event);
    })
    .on("mouseleave", sobHideTooltip);

  // Sector labels
  highlightGroup.selectAll(".sector-label-hl")
    .data(sectors)
    .enter().append("text")
    .attr("class", "chart-annotation")
    .attr("x", -8)
    .attr("y", function(d) { return yBand(shortName(d.sector)) + yBand.bandwidth() / 2 + 4; })
    .attr("text-anchor", "end")
    .attr("fill", function(d) { return d.gbpPerHour < median ? C.ink : C.faint; })
    .attr("font-size", "13px")
    .text(function(d) { return shortName(d.sector); });

  // Value labels
  highlightGroup.selectAll(".sector-val-hl")
    .data(sectors)
    .enter().append("text")
    .attr("class", "chart-annotation-bold")
    .attr("x", function(d) { return x(d.gbpPerHour) + 4; })
    .attr("y", function(d) { return yBand(shortName(d.sector)) + yBand.bandwidth() / 2 + 4; })
    .attr("fill", function(d) { return d.gbpPerHour < median ? C.red : C.faint; })
    .attr("font-size", "13px")
    .text(function(d) { return "\u00a3" + d.gbpPerHour.toFixed(0); });
}

function updateSectorsChart(step) {
  var container = document.getElementById("chart-sectors");
  var svg = d3.select(container).select("svg");
  if (step === 0) {
    svg.select(".sectors-all-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".sectors-highlight-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".sectors-all-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".sectors-highlight-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 4: WHY IT MATTERS — Output per hour (GBP) over time
   ========================================================= */
function buildMattersChart() {
  var container = document.getElementById("chart-matters");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height);
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var series = DATA.levelSeries;
  var x = d3.scaleLinear().domain([1971, 2024]).range([0, dim.innerW]);
  var yMax = d3.max(series, function(d) { return d.gbpPerHour; }) * 1.1;
  var y = d3.scaleLinear().domain([0, yMax]).range([dim.innerH, 0]);

  // ---- Step 0: nominal GBP/hour line showing stagnation post-2008 ----
  var nomGroup = g.append("g").attr("class", "matters-nom-view");

  // Grid
  nomGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // X axis
  nomGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).tickValues([1975, 1985, 1995, 2005, 2015, 2024]).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Y axis
  nomGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickSize(0).tickFormat(function(d) { return "\u00a3" + d; }))
    .call(function(g) { g.select(".domain").remove(); });

  // Y label (horizontal, above axis)
  nomGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Output per hour (\u00a3)");

  // Line
  var lineGen = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.gbpPerHour); }).curve(d3.curveMonotoneX);
  nomGroup.append("path").datum(series)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.indigo).attr("stroke-width", 2.5);

  // Annotations: pre-2008 steep growth, post-2008 slow
  var d2008 = series.find(function(d) { return d.year === 2008; });
  nomGroup.append("circle").attr("cx", x(2008)).attr("cy", y(d2008.gbpPerHour)).attr("r", 4)
    .attr("fill", C.indigo).attr("stroke", "#fff").attr("stroke-width", 2);

  // Growth rates as annotations — positioned in clear space away from line
  var d1990 = series.find(function(d) { return d.year === 1990; });
  var annPre = (Math.pow(d2008.gbpPerHour / d1990.gbpPerHour, 1 / 18) - 1) * 100;
  var midPreVal = (d1990.gbpPerHour + d2008.gbpPerHour) / 2;
  // "Rapid growth" in clear white space BELOW the pre-2008 line
  // Line is at ~£8-30 in this region; place annotations near bottom of chart
  nomGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(1982)).attr("y", dim.innerH - 30)
    .attr("text-anchor", "start").attr("fill", C.indigo)
    .text("Rapid growth");
  nomGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(1982)).attr("y", dim.innerH - 14)
    .attr("text-anchor", "start").attr("fill", C.indigo)
    .text("+" + annPre.toFixed(1) + "% per year");

  var d2024 = series.find(function(d) { return d.year === 2024; });
  var annPost = (Math.pow(d2024.gbpPerHour / d2008.gbpPerHour, 1 / 16) - 1) * 100;
  var midPostVal = (d2008.gbpPerHour + d2024.gbpPerHour) / 2;
  // "Stagnation" in clear white space ABOVE the post-2008 line
  // Line is at ~£30-47; place annotations near top of chart
  nomGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(2012)).attr("y", 20)
    .attr("text-anchor", "start").attr("fill", C.red)
    .text("Stagnation");
  nomGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2012)).attr("y", 36)
    .attr("text-anchor", "start").attr("fill", C.red)
    .text("+" + annPost.toFixed(1) + "% per year");

  // End label
  var last = series[series.length - 1];
  nomGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(last.year)).attr("y", y(last.gbpPerHour) - 14)
    .attr("text-anchor", "middle").attr("fill", C.indigo).text("\u00a3" + last.gbpPerHour.toFixed(0));

  // Hover
  var hoverRect = nomGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  var hoverLine = nomGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  var hoverDot = nomGroup.append("circle").attr("r", 4).attr("fill", C.indigo).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var year = Math.round(x.invert(mx));
    var d = series.find(function(a) { return a.year === year; });
    if (!d) return;
    hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);
    hoverDot.attr("cx", x(year)).attr("cy", y(d.gbpPerHour)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + d.year + '</div><div class="tt-value">\u00a3' + d.gbpPerHour.toFixed(2) + ' per hour</div>', event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // ---- Step 1: Same chart with "fiscal squeeze" annotation overlay ----
  var fiscalGroup = g.append("g").attr("class", "matters-fiscal-view").style("opacity", 0).style("pointer-events", "none");

  // Replicate the base chart
  fiscalGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  fiscalGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).tickValues([1975, 1985, 1995, 2005, 2015, 2024]).tickFormat(d3.format("d")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  fiscalGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickSize(0).tickFormat(function(d) { return "\u00a3" + d; }))
    .call(function(g) { g.select(".domain").remove(); });

  // Dimmed line (no area fill -- let the data speak)
  fiscalGroup.append("path").datum(series)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.indigo).attr("stroke-width", 2.5).attr("opacity", 0.3);

  // Highlight the post-2008 flatline
  var postSeries = series.filter(function(d) { return d.year >= 2008; });
  fiscalGroup.append("path").datum(postSeries)
    .attr("d", lineGen).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 3);

  var postArea = d3.area()
    .x(function(d) { return x(d.year); })
    .y0(dim.innerH)
    .y1(function(d) { return y(d.gbpPerHour); })
    .curve(d3.curveMonotoneX);
  fiscalGroup.append("path").datum(postSeries)
    .attr("d", postArea).attr("fill", "rgba(197,48,48,0.08)");

  // Big annotation box — positioned in top-left clear space to avoid overlapping data
  var boxX = 20;
  var boxY = 30;
  fiscalGroup.append("rect")
    .attr("x", boxX).attr("y", boxY)
    .attr("width", 280).attr("height", 80)
    .attr("fill", "#fff").attr("stroke", "#E0E0DB").attr("rx", 8)
    .attr("opacity", 0.95);
  fiscalGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", boxX + 14).attr("y", boxY + 24)
    .attr("fill", C.red).attr("font-size", "13px")
    .text("Low productivity = low growth");
  fiscalGroup.append("text").attr("class", "chart-annotation")
    .attr("x", boxX + 14).attr("y", boxY + 44)
    .attr("fill", C.secondary).attr("font-size", "13px")
    .text("Low growth = less tax revenue");
  fiscalGroup.append("text").attr("class", "chart-annotation")
    .attr("x", boxX + 14).attr("y", boxY + 62)
    .attr("fill", C.secondary).attr("font-size", "13px")
    .text("Less revenue = underfunded services");
}

function updateMattersChart(step) {
  var container = document.getElementById("chart-matters");
  var svg = d3.select(container).select("svg");
  if (step === 0) {
    svg.select(".matters-nom-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".matters-fiscal-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".matters-nom-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".matters-fiscal-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   SCROLL OBSERVER
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); }

function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "international": updateInternationalChart(step); break;
    case "sectors": updateSectorsChart(step); break;
    case "matters": updateMattersChart(step); break;
  }
}

})();
