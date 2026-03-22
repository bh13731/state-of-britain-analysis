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


function parseTime(t) {
  const [y, m] = t.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function monthLabel(t) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m] = t.split("-").map(Number);
  return months[m - 1] + " " + y;
}

/* =========================================================
   DERIVED DATA
   ========================================================= */
let DATA, SERIES, RATES, AGGREGATES;

// Compute year-on-year inflation rates from index data
function computeRates(series) {
  const rates = [];
  for (let i = 12; i < series.length; i++) {
    const cur = series[i];
    const prev = series[i - 12];
    const entry = {
      time: cur.time,
      label: cur.label,
      date: parseTime(cur.time)
    };
    ["CP00", "CP01", "CP04", "CP07", "CP09"].forEach(k => {
      entry[k] = ((cur[k] - prev[k]) / prev[k]) * 100;
    });
    rates.push(entry);
  }
  return rates;
}



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
sobFetchJSON("https://stateofbritain.uk/api/data/cpih.json")
  .then(d => { DATA = d; SERIES = d.series; AGGREGATES = d.aggregates; RATES = computeRates(SERIES); init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Find peak CPIH rate
  const peakEntry = RATES.reduce((max, d) => d.CP00 > max.CP00 ? d : max, RATES[0]);
  document.getElementById("bn-peak").textContent = sobFmtPct(peakEntry.CP00);

  // Cumulative price rise since Jan 2020
  const jan2020 = SERIES.find(d => d.time === "2020-01");
  const latest = SERIES[SERIES.length - 1];
  const cumPct = ((latest.CP00 - jan2020.CP00) / jan2020.CP00) * 100;
  document.getElementById("bn-cumulative").textContent = "+" + Math.round(cumPct) + "%";

  // Dynamic prose for "the damage is done" section
  var foodCum = ((latest.CP01 - jan2020.CP01) / jan2020.CP01) * 100;
  var housingCum = ((latest.CP04 - jan2020.CP04) / jan2020.CP04) * 100;
  var overallCost = d3.format(".0f")(100 + cumPct);
  var foodCost = d3.format(".0f")(100 + foodCum);

  // Dynamic prose for cumulative section
  document.getElementById("cumulative-text-overall").innerHTML =
    "When inflation falls, it means prices are rising <em>more slowly</em> \u2014 not that they are falling. " +
    "The price level is permanently higher. Everyday goods cost roughly " +
    d3.format(".0f")(cumPct) + "\u0025 more than they did at the start of 2020.";
  document.getElementById("cumulative-text-breakdown").textContent =
    "Food prices have risen by around " + d3.format(".0f")(foodCum) + "\u0025 since January 2020. " +
    "Housing and energy costs are up over " + d3.format(".0f")(housingCum) + "\u0025. " +
    "These are the essentials that lower-income households spend the largest share of their budgets on.";

  document.getElementById("now-text-damage").textContent =
    "Even if inflation returns to 2\u0025 tomorrow, the price level will not reset. " +
    "A basket of goods that cost \u00a3100 in January 2020 now costs around \u00a3" + overallCost +
    ". For food, it is closer to \u00a3" + foodCost + ". The squeeze on living standards is baked in.";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-hook svg, #chart-sectors svg, #chart-cumulative svg, #chart-now svg").remove();
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
  buildSectorsChart();
  buildCumulativeChart();
  buildNowChart();
}

/* =========================================================
   CHART 1: THE HOOK — Peak callout then full CPIH rate
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Line chart showing CPIH inflation rate over time, peaking at over 10% in late 2022");
  const g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  const cpihRates = RATES;
  const peakEntry = cpihRates.reduce((max, d) => d.CP00 > max.CP00 ? d : max, cpihRates[0]);

  // --- BIG NUMBER VIEW (step 0) ---
  const bigGroup = g.append("g").attr("class", "big-view");

  // Draw a simplified sparkline behind the big number
  const xSpark = d3.scaleTime()
    .domain(d3.extent(cpihRates, d => d.date))
    .range([0, dim.innerW]);
  const ySpark = d3.scaleLinear()
    .domain([d3.min(cpihRates, d => d.CP00) - 0.5, d3.max(cpihRates, d => d.CP00) + 1])
    .range([dim.innerH, 0]);

  // Line
  const lineGen = d3.line().x(d => xSpark(d.date)).y(d => ySpark(d.CP00)).curve(d3.curveMonotoneX);
  bigGroup.append("path").datum(cpihRates)
    .attr("d", lineGen)
    .attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);

  // Peak dot and annotation
  bigGroup.append("circle")
    .attr("cx", xSpark(peakEntry.date)).attr("cy", ySpark(peakEntry.CP00))
    .attr("r", 6).attr("fill", C.red).attr("stroke", "#fff").attr("stroke-width", 2);
  bigGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xSpark(peakEntry.date) - 8).attr("y", ySpark(peakEntry.CP00) - 16)
    .attr("text-anchor", "end").attr("fill", C.red)
    .text(sobFmtPct(peakEntry.CP00) + " — " + monthLabel(peakEntry.time));

  // 2% target line
  bigGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", ySpark(2)).attr("y2", ySpark(2))
    .attr("stroke", C.target).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  bigGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", ySpark(2) - 8)
    .attr("text-anchor", "end").attr("fill", C.target)
    .text("2% target");

  // Minimal x axis
  bigGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xSpark).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Y axis
  bigGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(ySpark).ticks(6).tickFormat(function(d) { return d + "%"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Grid
  bigGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(ySpark).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); })
    .lower();

  // --- FULL LINE VIEW (step 1) — same chart but with annotations ---
  var lineGroup = g.append("g").attr("class", "line-view").style("opacity", 0).style("pointer-events", "none");

  // Line
  lineGroup.append("path").datum(cpihRates)
    .attr("d", lineGen)
    .attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);

  // 2% target line
  lineGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", ySpark(2)).attr("y2", ySpark(2))
    .attr("stroke", C.target).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", ySpark(2) - 8)
    .attr("text-anchor", "end").attr("fill", C.target)
    .text("2% target");

  // Calm period annotation — placed well below target line to avoid data overlap
  var calmX = xSpark(new Date(2016, 0, 1));
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", calmX).attr("y", ySpark(2) + 36)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("A decade near target");

  // COVID annotation
  var covidX = xSpark(new Date(2020, 3, 1));
  lineGroup.append("text").attr("class", "chart-annotation")
    .attr("x", covidX).attr("y", ySpark(0.5) + 16)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("COVID lockdowns");

  // Energy crisis annotation
  var crisisX = xSpark(new Date(2022, 3, 1));
  var crisisEntry = cpihRates.find(function(d) { return d.time === "2022-04"; });
  if (crisisEntry) {
    lineGroup.append("text").attr("class", "chart-annotation")
      .attr("x", crisisX + 6).attr("y", ySpark(crisisEntry.CP00) + 20)
      .attr("text-anchor", "start").attr("fill", C.red)
      .text("Energy crisis");
  }

  // Peak dot
  lineGroup.append("circle")
    .attr("cx", xSpark(peakEntry.date)).attr("cy", ySpark(peakEntry.CP00))
    .attr("r", 5).attr("fill", C.red).attr("stroke", "#fff").attr("stroke-width", 2);
  lineGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xSpark(peakEntry.date) - 8).attr("y", ySpark(peakEntry.CP00) - 14)
    .attr("text-anchor", "end").attr("fill", C.red)
    .text("Peak " + sobFmtPct(peakEntry.CP00));

  // Axes
  lineGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(xSpark).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  lineGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(ySpark).ticks(6).tickFormat(function(d) { return d + "%"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  lineGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(ySpark).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); })
    .lower();

  // Hover overlay for line view
  var hoverRect = lineGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "default");
  var hoverLine = lineGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#B0B0A8").attr("stroke-width", 0.75)
    .style("opacity", 0);
  var hoverDot = lineGroup.append("circle").attr("r", 4).attr("fill", C.red).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var dateAtMouse = xSpark.invert(mx);
    var bisect = d3.bisector(function(d) { return d.date; }).left;
    var idx = bisect(cpihRates, dateAtMouse, 1);
    var d0 = cpihRates[idx - 1], d1 = cpihRates[idx];
    if (!d0) return;
    var d = (!d1 || dateAtMouse - d0.date < d1.date - dateAtMouse) ? d0 : d1;
    hoverLine.attr("x1", xSpark(d.date)).attr("x2", xSpark(d.date)).style("opacity", 1);
    hoverDot.attr("cx", xSpark(d.date)).attr("cy", ySpark(d.CP00)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + monthLabel(d.time) + '</div><div class="tt-value" style="color:' + C.red + '">CPIH: ' + sobFmtPct(d.CP00) + '</div>', event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // Also add hover to big view
  var hoverRect2 = bigGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "default");
  var hoverLine2 = bigGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#B0B0A8").attr("stroke-width", 0.75)
    .style("opacity", 0);
  var hoverDot2 = bigGroup.append("circle").attr("r", 4).attr("fill", C.red).style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var dateAtMouse = xSpark.invert(mx);
    var bisect = d3.bisector(function(d) { return d.date; }).left;
    var idx = bisect(cpihRates, dateAtMouse, 1);
    var d0 = cpihRates[idx - 1], d1 = cpihRates[idx];
    if (!d0) return;
    var d = (!d1 || dateAtMouse - d0.date < d1.date - dateAtMouse) ? d0 : d1;
    hoverLine2.attr("x1", xSpark(d.date)).attr("x2", xSpark(d.date)).style("opacity", 1);
    hoverDot2.attr("cx", xSpark(d.date)).attr("cy", ySpark(d.CP00)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + monthLabel(d.time) + '</div><div class="tt-value" style="color:' + C.red + '">CPIH: ' + sobFmtPct(d.CP00) + '</div>', event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); hoverDot2.style("opacity", 0); sobHideTooltip();
  });
}

function updateHookChart(step) {
  var svg = d3.select("#chart-hook svg");
  if (step === 0) {
    svg.select(".big-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".big-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".line-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 2: SECTOR BREAKDOWN — YoY rates by category
   ========================================================= */
function buildSectorsChart() {
  var container = document.getElementById("chart-sectors");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Multi-line chart comparing inflation rates across food, housing, transport and recreation sectors");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  var categories = [
    { id: "CP01", label: "Food & drink", color: C.food },
    { id: "CP00", label: "Overall CPIH", color: C.faint },
    { id: "CP09", label: "Recreation", color: C.recreation }
  ];

  var categories2 = [
    { id: "CP04", label: "Housing & energy", color: C.housing },
    { id: "CP07", label: "Transport", color: C.transport },
    { id: "CP00", label: "Overall CPIH", color: C.faint }
  ];

  var x = d3.scaleTime()
    .domain(d3.extent(RATES, function(d) { return d.date; }))
    .range([0, dim.innerW]);

  var allVals = [];
  RATES.forEach(function(d) {
    allVals.push(d.CP00, d.CP01, d.CP04, d.CP07, d.CP09);
  });
  var yMin = Math.floor(d3.min(allVals)) - 1;
  var yMax = Math.ceil(d3.max(allVals)) + 1;
  var y = d3.scaleLinear().domain([yMin, yMax]).range([dim.innerH, 0]);

  // --- FOOD VIEW (step 0) ---
  var foodGroup = g.append("g").attr("class", "food-view");

  // Grid
  foodGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Zero line
  foodGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);

  // 2% target
  foodGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(2)).attr("y2", y(2))
    .attr("stroke", C.target).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  foodGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", y(2) - 6)
    .attr("text-anchor", "end").attr("fill", C.target)
    .text("2% target");

  categories.forEach(function(cat) {
    var lineGen = d3.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d[cat.id]); })
      .curve(d3.curveMonotoneX);
    foodGroup.append("path").datum(RATES)
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", cat.color)
      .attr("stroke-width", cat.id === "CP00" ? 1.5 : 2.5)
      .attr("stroke-dasharray", cat.id === "CP00" ? "4,3" : "none");
  });

  // End labels with collision avoidance
  (function() {
    var lastRate = RATES[RATES.length - 1];
    var foodLabels = categories.map(function(cat) {
      return { label: cat.label, color: cat.color, val: lastRate[cat.id] };
    }).sort(function(a, b) { return a.val - b.val; });
    var spacing = 16;
    var placed = [];
    foodLabels.forEach(function(lbl) {
      var ideal = y(lbl.val);
      var final = ideal;
      placed.forEach(function(py) {
        if (Math.abs(final - py) < spacing) final = py + spacing;
      });
      placed.push(final);
      lbl.placedY = final;
    });
    foodLabels.forEach(function(lbl) {
      foodGroup.append("text").attr("class", "chart-annotation-bold")
        .attr("x", x(lastRate.date) + 6)
        .attr("y", lbl.placedY + 4)
        .attr("fill", lbl.color)
        .attr("font-size", "13px")
        .text(lbl.label);
    });
  })();

  // Peak food annotation
  var peakFood = RATES.reduce(function(max, d) { return d.CP01 > max.CP01 ? d : max; }, RATES[0]);
  foodGroup.append("circle")
    .attr("cx", x(peakFood.date)).attr("cy", y(peakFood.CP01))
    .attr("r", 5).attr("fill", C.food).attr("stroke", "#fff").attr("stroke-width", 2);
  foodGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(peakFood.date) + 8).attr("y", y(peakFood.CP01) + 4)
    .attr("fill", C.food).text(sobFmtPct(peakFood.CP01));

  // Axes
  foodGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  foodGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(8).tickFormat(function(d) { return d + "%"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Hover
  var hoverRect = foodGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "default");
  var hoverLine = foodGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#B0B0A8").attr("stroke-width", 0.75)
    .style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var dateAtMouse = x.invert(mx);
    var bisect = d3.bisector(function(d) { return d.date; }).left;
    var idx = bisect(RATES, dateAtMouse, 1);
    var d0 = RATES[idx - 1], d1 = RATES[idx];
    if (!d0) return;
    var d = (!d1 || dateAtMouse - d0.date < d1.date - dateAtMouse) ? d0 : d1;
    hoverLine.attr("x1", x(d.date)).attr("x2", x(d.date)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + monthLabel(d.time) + '</div>' +
      '<div class="tt-value" style="color:' + C.food + '">Food: ' + sobFmtPct(d.CP01) + '</div>' +
      '<div class="tt-value" style="color:' + C.recreation + '">Recreation: ' + sobFmtPct(d.CP09) + '</div>' +
      '<div class="tt-value" style="color:' + C.overall + '">Overall: ' + sobFmtPct(d.CP00) + '</div>', event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); sobHideTooltip();
  });

  // --- ENERGY VIEW (step 1) ---
  var energyGroup = g.append("g").attr("class", "energy-view").style("opacity", 0).style("pointer-events", "none");

  // Grid
  energyGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // Zero line
  energyGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);

  // 2% target
  energyGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(2)).attr("y2", y(2))
    .attr("stroke", C.target).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  energyGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW).attr("y", y(2) - 6)
    .attr("text-anchor", "end").attr("fill", C.target)
    .text("2% target");

  categories2.forEach(function(cat) {
    var lineGen = d3.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d[cat.id]); })
      .curve(d3.curveMonotoneX);
    energyGroup.append("path").datum(RATES)
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", cat.color)
      .attr("stroke-width", cat.id === "CP00" ? 1.5 : 2.5)
      .attr("stroke-dasharray", cat.id === "CP00" ? "4,3" : "none");
  });

  // End labels with collision avoidance
  (function() {
    var lastRate = RATES[RATES.length - 1];
    var energyLabels = categories2.map(function(cat) {
      return { label: cat.label, color: cat.color, val: lastRate[cat.id] };
    }).sort(function(a, b) { return a.val - b.val; });
    var spacing = 16;
    var placed = [];
    energyLabels.forEach(function(lbl) {
      var ideal = y(lbl.val);
      var final = ideal;
      placed.forEach(function(py) {
        if (Math.abs(final - py) < spacing) final = py + spacing;
      });
      placed.push(final);
      lbl.placedY = final;
    });
    energyLabels.forEach(function(lbl) {
      energyGroup.append("text").attr("class", "chart-annotation-bold")
        .attr("x", x(lastRate.date) + 6)
        .attr("y", lbl.placedY + 4)
        .attr("fill", lbl.color)
        .attr("font-size", "13px")
        .text(lbl.label);
    });
  })();

  // Peak housing annotation
  var peakHousing = RATES.reduce(function(max, d) { return d.CP04 > max.CP04 ? d : max; }, RATES[0]);
  energyGroup.append("circle")
    .attr("cx", x(peakHousing.date)).attr("cy", y(peakHousing.CP04))
    .attr("r", 5).attr("fill", C.housing).attr("stroke", "#fff").attr("stroke-width", 2);
  energyGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(peakHousing.date) + 8).attr("y", y(peakHousing.CP04) + 4)
    .attr("fill", C.housing).text(sobFmtPct(peakHousing.CP04));

  // Peak transport annotation
  var peakTransport = RATES.reduce(function(max, d) { return d.CP07 > max.CP07 ? d : max; }, RATES[0]);
  energyGroup.append("circle")
    .attr("cx", x(peakTransport.date)).attr("cy", y(peakTransport.CP07))
    .attr("r", 5).attr("fill", C.transport).attr("stroke", "#fff").attr("stroke-width", 2);
  energyGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(peakTransport.date) - 8).attr("y", y(peakTransport.CP07) - 14)
    .attr("text-anchor", "end").attr("fill", C.transport).text(sobFmtPct(peakTransport.CP07));

  // Apr 2022 price cap annotation
  var capEntry = RATES.find(function(d) { return d.time === "2022-04"; });
  if (capEntry) {
    energyGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(capEntry.date)).attr("y", y(capEntry.CP04) + 28)
      .attr("text-anchor", "middle").attr("fill", C.muted)
      .text("Price cap rises");
  }

  // Axes
  energyGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 5 : 8).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  energyGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(8).tickFormat(function(d) { return d + "%"; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Hover
  var hoverRect2 = energyGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "default");
  var hoverLine2 = energyGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#B0B0A8").attr("stroke-width", 0.75)
    .style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var dateAtMouse = x.invert(mx);
    var bisect = d3.bisector(function(d) { return d.date; }).left;
    var idx = bisect(RATES, dateAtMouse, 1);
    var d0 = RATES[idx - 1], d1 = RATES[idx];
    if (!d0) return;
    var d = (!d1 || dateAtMouse - d0.date < d1.date - dateAtMouse) ? d0 : d1;
    hoverLine2.attr("x1", x(d.date)).attr("x2", x(d.date)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + monthLabel(d.time) + '</div>' +
      '<div class="tt-value" style="color:' + C.housing + '">Housing & energy: ' + sobFmtPct(d.CP04) + '</div>' +
      '<div class="tt-value" style="color:' + C.transport + '">Transport: ' + sobFmtPct(d.CP07) + '</div>' +
      '<div class="tt-value" style="color:' + C.overall + '">Overall: ' + sobFmtPct(d.CP00) + '</div>', event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); sobHideTooltip();
  });
}

function updateSectorsChart(step) {
  var svg = d3.select("#chart-sectors svg");
  if (step === 0) {
    svg.select(".food-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".energy-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".food-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".energy-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 3: CUMULATIVE — Price index rebased to Jan 2020
   ========================================================= */
function buildCumulativeChart() {
  var container = document.getElementById("chart-cumulative");
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height)
    .attr("role", "img")
    .attr("aria-label", "Line chart showing cumulative price rises since January 2020, rebased to index of 100");
  var g = svg.append("g").attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");

  // Rebase all series to Jan 2020 = 100
  var jan2020 = SERIES.find(function(d) { return d.time === "2020-01"; });
  var rebasedAll = SERIES.map(function(d) {
    return {
      time: d.time,
      date: parseTime(d.time),
      CP00: (d.CP00 / jan2020.CP00) * 100,
      CP01: (d.CP01 / jan2020.CP01) * 100,
      CP04: (d.CP04 / jan2020.CP04) * 100,
      CP07: (d.CP07 / jan2020.CP07) * 100,
      CP09: (d.CP09 / jan2020.CP09) * 100
    };
  });

  // Filter from Jan 2020 onwards
  var rebased = rebasedAll.filter(function(d) { return d.time >= "2020-01"; });

  var x = d3.scaleTime()
    .domain(d3.extent(rebased, function(d) { return d.date; }))
    .range([0, dim.innerW]);

  var allVals = [];
  rebased.forEach(function(d) {
    allVals.push(d.CP00, d.CP01, d.CP04, d.CP07, d.CP09);
  });
  var yMax = Math.ceil(d3.max(allVals)) + 2;
  var y = d3.scaleLinear().domain([96, yMax]).range([dim.innerH, 0]);

  // --- OVERALL VIEW (step 0) ---
  var overallGroup = g.append("g").attr("class", "overall-view");

  // Grid
  overallGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // 100 baseline
  overallGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(100)).attr("y2", y(100))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);
  overallGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 4).attr("y", y(100) - 8).attr("fill", C.muted)
    .text("Jan 2020 = 100");

  // Line
  var lineGen = d3.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.CP00); })
    .curve(d3.curveMonotoneX);
  overallGroup.append("path").datum(rebased)
    .attr("d", lineGen)
    .attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);

  // End label
  var lastRebased = rebased[rebased.length - 1];
  overallGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastRebased.date) + 6).attr("y", y(lastRebased.CP00) + 4)
    .attr("fill", C.red)
    .text(d3.format(".1f")(lastRebased.CP00));
  overallGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(lastRebased.date) + 6).attr("y", y(lastRebased.CP00) + 20)
    .attr("fill", C.red)
    .text("+" + d3.format(".0f")(lastRebased.CP00 - 100) + "%");

  // Axes
  overallGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 4 : 6).tickFormat(d3.timeFormat("%b '%y")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  overallGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(8).tickFormat(function(d) { return d; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Hover
  var hoverRect = overallGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "default");
  var hoverLine = overallGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#B0B0A8").attr("stroke-width", 0.75)
    .style("opacity", 0);
  var hoverDot = overallGroup.append("circle").attr("r", 4).attr("fill", C.red).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var dateAtMouse = x.invert(mx);
    var bisect = d3.bisector(function(d) { return d.date; }).left;
    var idx = bisect(rebased, dateAtMouse, 1);
    var d0 = rebased[idx - 1], d1 = rebased[idx];
    if (!d0) return;
    var d = (!d1 || dateAtMouse - d0.date < d1.date - dateAtMouse) ? d0 : d1;
    hoverLine.attr("x1", x(d.date)).attr("x2", x(d.date)).style("opacity", 1);
    hoverDot.attr("cx", x(d.date)).attr("cy", y(d.CP00)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + monthLabel(d.time) + '</div>' +
      '<div class="tt-value" style="color:' + C.red + '">Index: ' + d3.format(".1f")(d.CP00) + ' (+' + d3.format(".1f")(d.CP00 - 100) + '%)</div>', event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });

  // --- BREAKDOWN VIEW (step 1) ---
  var breakGroup = g.append("g").attr("class", "break-view").style("opacity", 0).style("pointer-events", "none");

  // Grid
  breakGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-dim.innerW).tickFormat(""))
    .call(function(g) { g.select(".domain").remove(); });

  // 100 baseline
  breakGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(100)).attr("y2", y(100))
    .attr("stroke", "#C0C0B8").attr("stroke-width", 1);
  breakGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 4).attr("y", y(100) - 8).attr("fill", C.muted)
    .text("Jan 2020 = 100");

  var breakCats = [
    { id: "CP01", label: "Food", color: C.food },
    { id: "CP04", label: "Housing & energy", color: C.housing },
    { id: "CP07", label: "Transport", color: C.transport },
    { id: "CP00", label: "Overall", color: C.faint },
    { id: "CP09", label: "Recreation", color: C.recreation }
  ];

  // Sort end labels by final value to avoid overlap
  var lastPt = rebased[rebased.length - 1];
  var labelPositions = breakCats.map(function(cat) {
    return { id: cat.id, label: cat.label, color: cat.color, val: lastPt[cat.id] };
  }).sort(function(a, b) { return b.val - a.val; });

  breakCats.forEach(function(cat) {
    var lineGen = d3.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d[cat.id]); })
      .curve(d3.curveMonotoneX);
    breakGroup.append("path").datum(rebased)
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", cat.color)
      .attr("stroke-width", cat.id === "CP00" ? 1.5 : 2.5)
      .attr("stroke-dasharray", cat.id === "CP00" ? "4,3" : "none");
  });

  // Spread labels to avoid overlap
  var labelSpacing = 16;
  var sortedLabels = labelPositions.slice().sort(function(a, b) { return a.val - b.val; });
  var placedY = [];
  sortedLabels.forEach(function(lbl) {
    var idealY = y(lbl.val);
    var finalY = idealY;
    placedY.forEach(function(py) {
      if (Math.abs(finalY - py) < labelSpacing) {
        finalY = py + labelSpacing;
      }
    });
    placedY.push(finalY);
    lbl.placedY = finalY;
  });

  sortedLabels.forEach(function(lbl) {
    breakGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", x(lastPt.date) + 6)
      .attr("y", lbl.placedY + 4)
      .attr("fill", lbl.color)
      .attr("font-size", "13px")
      .text(lbl.label + " " + d3.format(".0f")(lbl.val));
  });

  // Axes
  breakGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", "translate(0," + dim.innerH + ")")
    .call(d3.axisBottom(x).ticks(sobIsMobile() ? 4 : 6).tickFormat(d3.timeFormat("%b '%y")).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });
  breakGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(8).tickFormat(function(d) { return d; }).tickSize(0))
    .call(function(g) { g.select(".domain").remove(); });

  // Hover
  var hoverRect2 = breakGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "default");
  var hoverLine2 = breakGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#B0B0A8").attr("stroke-width", 0.75)
    .style("opacity", 0);

  hoverRect2.on("mousemove", function(event) {
    var mx = d3.pointer(event, this)[0];
    var dateAtMouse = x.invert(mx);
    var bisect = d3.bisector(function(d) { return d.date; }).left;
    var idx = bisect(rebased, dateAtMouse, 1);
    var d0 = rebased[idx - 1], d1 = rebased[idx];
    if (!d0) return;
    var d = (!d1 || dateAtMouse - d0.date < d1.date - dateAtMouse) ? d0 : d1;
    hoverLine2.attr("x1", x(d.date)).attr("x2", x(d.date)).style("opacity", 1);
    sobShowTooltip('<div class="tt-label">' + monthLabel(d.time) + '</div>' +
      '<div class="tt-value" style="color:' + C.food + '">Food: +' + d3.format(".1f")(d.CP01 - 100) + '%</div>' +
      '<div class="tt-value" style="color:' + C.housing + '">Housing: +' + d3.format(".1f")(d.CP04 - 100) + '%</div>' +
      '<div class="tt-value" style="color:' + C.transport + '">Transport: +' + d3.format(".1f")(d.CP07 - 100) + '%</div>' +
      '<div class="tt-value" style="color:' + C.overall + '">Overall: +' + d3.format(".1f")(d.CP00 - 100) + '%</div>' +
      '<div class="tt-value" style="color:' + C.recreation + '">Recreation: +' + d3.format(".1f")(d.CP09 - 100) + '%</div>', event);
  }).on("mouseleave", function() {
    hoverLine2.style("opacity", 0); sobHideTooltip();
  });
}

function updateCumulativeChart(step) {
  var svg = d3.select("#chart-cumulative svg");
  if (step === 0) {
    svg.select(".overall-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".break-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".overall-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".break-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 4: WHERE WE ARE NOW — Latest rates bar + cumulative summary
   ========================================================= */
function buildNowChart() {
  var container = document.getElementById("chart-now");
  var dim = sobChartDims(container);
  var h = Math.max(520, dim.height);
  var m = { top: 30, right: 80, bottom: 40, left: 54 };
  var innerW = dim.width - m.left - m.right;
  var innerH = h - m.top - m.bottom;

  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", h)
    .attr("viewBox", "0 0 " + dim.width + " " + h)
    .attr("role", "img")
    .attr("aria-label", "Bar chart showing latest inflation rates and cumulative price rises by category");
  var g = svg.append("g").attr("transform", "translate(" + m.left + "," + m.top + ")");

  var latestRate = RATES[RATES.length - 1];

  // --- CURRENT RATES VIEW (step 0) ---
  var ratesGroup = g.append("g").attr("class", "rates-view");

  var catData = [
    { label: "Food & drink", id: "CP01", color: C.food },
    { label: "Housing & energy", id: "CP04", color: C.housing },
    { label: "Overall CPIH", id: "CP00", color: C.overall },
    { label: "Transport", id: "CP07", color: C.transport },
    { label: "Recreation", id: "CP09", color: C.recreation }
  ].map(function(cat) {
    cat.value = latestRate[cat.id];
    return cat;
  }).sort(function(a, b) { return b.value - a.value; });

  var yBand = d3.scaleBand().domain(catData.map(function(d) { return d.label; })).range([0, innerH * 0.7]).padding(0.3);
  var xBarMin = Math.min(0, d3.min(catData, function(d) { return d.value; }) - 0.5);
  var xBar = d3.scaleLinear().domain([xBarMin, d3.max(catData, function(d) { return d.value; }) + 1]).range([0, innerW]);

  // 2% target line
  ratesGroup.append("line")
    .attr("x1", xBar(2)).attr("x2", xBar(2))
    .attr("y1", -10).attr("y2", innerH * 0.7 + 10)
    .attr("stroke", C.target).attr("stroke-width", 2).attr("stroke-dasharray", "6,4");
  ratesGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xBar(2)).attr("y", -16)
    .attr("text-anchor", "middle").attr("fill", C.target)
    .text("2% target");

  // Bars
  ratesGroup.selectAll(".rate-bar").data(catData).enter()
    .append("rect").attr("class", "rate-bar")
    .attr("x", function(d) { return d.value >= 0 ? xBar(0) : xBar(d.value); })
    .attr("y", function(d) { return yBand(d.label); })
    .attr("width", function(d) { return Math.abs(xBar(d.value) - xBar(0)); })
    .attr("height", yBand.bandwidth())
    .attr("fill", function(d) { return d.color; })
    .attr("rx", 3)
    .attr("opacity", 0.9);

  // Name labels
  ratesGroup.selectAll(".rate-name").data(catData).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", function(d) { return xBar(Math.max(0, d.value)) + 8; })
    .attr("y", function(d) { return yBand(d.label) + yBand.bandwidth() / 2 - 6; })
    .attr("fill", function(d) { return d.color; })
    .attr("font-weight", 600)
    .text(function(d) { return d.label; });

  // Value labels
  ratesGroup.selectAll(".rate-val").data(catData).enter()
    .append("text").attr("class", "chart-annotation-bold")
    .attr("x", function(d) { return xBar(Math.max(0, d.value)) + 8; })
    .attr("y", function(d) { return yBand(d.label) + yBand.bandwidth() / 2 + 12; })
    .attr("fill", function(d) { return d.color; })
    .text(function(d) { return sobFmtPct(d.value); });

  // Title
  ratesGroup.append("text")
    .attr("x", 0).attr("y", innerH * 0.7 + 40)
    .attr("fill", C.ink)
    .attr("font-family", "'Inter', sans-serif")
    .attr("font-size", "15px")
    .attr("font-weight", 600)
    .text("Year-on-year rate, " + monthLabel(latestRate.time));

  // Hover
  ratesGroup.selectAll(".rate-bar")
    .on("mousemove", function(event, d) {
      var aboveTarget = d.value > 2;
      sobShowTooltip('<div class="tt-label">' + d.label + '</div>' +
        '<div class="tt-value" style="color:' + d.color + '">' + sobFmtPct(d.value) + ' year-on-year</div>' +
        '<div class="tt-value">' + (aboveTarget ? "Above" : "At or below") + ' the 2% target</div>', event);
    })
    .on("mouseleave", hideTooltip);

  // --- CUMULATIVE SUMMARY BAR (step 1) ---
  var summaryGroup = g.append("g").attr("class", "summary-view").style("opacity", 0).style("pointer-events", "none");

  var jan2020 = SERIES.find(function(d) { return d.time === "2020-01"; });
  var latestIndex = SERIES[SERIES.length - 1];

  var cumData = [
    { label: "Food & drink", color: C.food, pct: ((latestIndex.CP01 / jan2020.CP01) - 1) * 100 },
    { label: "Housing & energy", color: C.housing, pct: ((latestIndex.CP04 / jan2020.CP04) - 1) * 100 },
    { label: "Overall CPIH", color: C.overall, pct: ((latestIndex.CP00 / jan2020.CP00) - 1) * 100 },
    { label: "Transport", color: C.transport, pct: ((latestIndex.CP07 / jan2020.CP07) - 1) * 100 },
    { label: "Recreation", color: C.recreation, pct: ((latestIndex.CP09 / jan2020.CP09) - 1) * 100 }
  ].sort(function(a, b) { return b.pct - a.pct; });

  var yCum = d3.scaleBand().domain(cumData.map(function(d) { return d.label; })).range([0, innerH * 0.7]).padding(0.3);
  var xCum = d3.scaleLinear().domain([0, d3.max(cumData, function(d) { return d.pct; }) * 1.15]).range([0, innerW]);

  // Bars
  summaryGroup.selectAll(".cum-bar").data(cumData).enter()
    .append("rect").attr("class", "cum-bar")
    .attr("x", 0)
    .attr("y", function(d) { return yCum(d.label); })
    .attr("width", function(d) { return xCum(d.pct); })
    .attr("height", yCum.bandwidth())
    .attr("fill", function(d) { return d.color; })
    .attr("rx", 3)
    .attr("opacity", 0.9);

  // Name labels
  summaryGroup.selectAll(".cum-name").data(cumData).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", function(d) { return xCum(d.pct) + 8; })
    .attr("y", function(d) { return yCum(d.label) + yCum.bandwidth() / 2 - 6; })
    .attr("fill", function(d) { return d.color; })
    .attr("font-weight", 600)
    .text(function(d) { return d.label; });

  // Value labels
  summaryGroup.selectAll(".cum-val").data(cumData).enter()
    .append("text").attr("class", "chart-annotation-bold")
    .attr("x", function(d) { return xCum(d.pct) + 8; })
    .attr("y", function(d) { return yCum(d.label) + yCum.bandwidth() / 2 + 12; })
    .attr("fill", function(d) { return d.color; })
    .text(function(d) { return "+" + d3.format(".1f")(d.pct) + "%"; });

  // Title
  summaryGroup.append("text")
    .attr("x", 0).attr("y", innerH * 0.7 + 40)
    .attr("fill", C.ink)
    .attr("font-family", "'Inter', sans-serif")
    .attr("font-size", "15px")
    .attr("font-weight", 600)
    .text("Cumulative price rise since Jan 2020");

  // Equiv cost
  summaryGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", innerH * 0.7 + 60)
    .attr("fill", C.muted)
    .text("A \u00a3100 basket in Jan 2020 now costs \u00a3" + d3.format(".0f")(100 + cumData.find(function(d) { return d.label === "Overall CPIH"; }).pct));

  // Hover
  summaryGroup.selectAll(".cum-bar")
    .on("mousemove", function(event, d) {
      var equiv = 100 + d.pct;
      sobShowTooltip('<div class="tt-label">' + d.label + '</div>' +
        '<div class="tt-value" style="color:' + d.color + '">+' + d3.format(".1f")(d.pct) + '% since Jan 2020</div>' +
        '<div class="tt-value">\u00a3100 then = \u00a3' + d3.format(".0f")(equiv) + ' now</div>', event);
    })
    .on("mouseleave", hideTooltip);
}

function updateNowChart(step) {
  var svg = d3.select("#chart-now svg");
  if (step === 0) {
    svg.select(".rates-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".summary-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".rates-view").transition().duration(DURATION).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".summary-view").transition().duration(DURATION).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "sectors": updateSectorsChart(step); break;
    case "cumulative": updateCumulativeChart(step); break;
    case "now": updateNowChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); })();
