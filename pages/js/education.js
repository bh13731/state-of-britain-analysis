(function() {
"use strict";

sobInstallErrorHandler();
if (!sobCheckD3()) return;

/* =========================================================
   COLOURS & CONSTANTS
   ========================================================= */
const C = SOB_COLORS;
const DURATION = SOB_DURATION;
const CROSSFADE = 900; // Longer duration for view-swapping transitions
const MOBILE = SOB_MOBILE;


/* =========================================================
   HELPERS
   ========================================================= */
function fmtGBP(v) { return "\u00a3" + d3.format(",")(Math.round(v)); }

function parseAcademicYear(s) {
  return parseInt(s.split("-")[0], 10);
}



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/education.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  // Set big number
  const snap = DATA.snapshot;
  document.getElementById("bn-spending-cut").textContent = snap.perPupilChange + "%";

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-spending svg, #chart-intl svg, #chart-gcse svg, #chart-teachers svg, #chart-he svg").remove();
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
  buildSpendingChart();
  buildIntlChart();
  buildGcseChart();
  buildTeachersChart();
  buildHeChart();
}

/* =========================================================
   CHART 1: PER-PUPIL SPENDING
   ========================================================= */
function buildSpendingChart() {
  const container = document.getElementById("chart-spending");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img")
    .attr("aria-label", "Line chart showing per-pupil spending in England from 2003 to 2024 in real terms, peaking at \u00a36,720 in 2009-10 and not yet fully recovered.");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const raw = DATA.perPupilSpending;
  const data = raw.map(d => ({ year: parseAcademicYear(d.year), label: d.year, value: d.value }));

  const peakIdx = data.findIndex(d => d.value === 6720);
  const troughIdx = data.findIndex(d => d.value === 5690);

  const x = d3.scaleLinear().domain([d3.min(data, d => d.year), d3.max(data, d => d.year)]).range([0, dim.innerW]);
  const y = d3.scaleLinear().domain([5200, 7000]).range([dim.innerH, 0]);

  // --- FULL LINE VIEW (step 0: emphasize decline, step 1: emphasize recovery) ---
  const mainGroup = g.append("g").attr("class", "spending-main");

  // Grid
  mainGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Line
  const line = d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX);
  mainGroup.append("path").datum(data)
    .attr("d", line).attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // Dots at peak and trough
  mainGroup.append("circle").attr("cx", x(data[peakIdx].year)).attr("cy", y(data[peakIdx].value))
    .attr("r", 5).attr("fill", C.teal).attr("stroke", "#fff").attr("stroke-width", 2);
  mainGroup.append("circle").attr("cx", x(data[troughIdx].year)).attr("cy", y(data[troughIdx].value))
    .attr("r", 5).attr("fill", C.red).attr("stroke", "#fff").attr("stroke-width", 2);

  // Latest dot
  const last = data[data.length - 1];
  mainGroup.append("circle").attr("cx", x(last.year)).attr("cy", y(last.value))
    .attr("r", 5).attr("fill", C.teal).attr("stroke", "#fff").attr("stroke-width", 2);

  // Peak annotation
  mainGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(data[peakIdx].year)).attr("y", y(data[peakIdx].value) - 16)
    .attr("text-anchor", "middle").attr("fill", C.teal)
    .text(fmtGBP(data[peakIdx].value));
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(data[peakIdx].year)).attr("y", y(data[peakIdx].value) - 32)
    .attr("text-anchor", "middle").attr("fill", C.teal)
    .text("Peak 2009\u201310");

  // Trough annotation
  mainGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(data[troughIdx].year) + 4).attr("y", y(data[troughIdx].value) + 24)
    .attr("text-anchor", "middle").attr("fill", C.red)
    .text(fmtGBP(data[troughIdx].value));
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(data[troughIdx].year) + 4).attr("y", y(data[troughIdx].value) + 40)
    .attr("text-anchor", "middle").attr("fill", C.red)
    .text("Trough 2018\u201319");

  // Decline shading (step 0 highlight)
  const declineData = data.filter(d => d.year >= data[peakIdx].year && d.year <= data[troughIdx].year);
  const declineArea = d3.area()
    .x(d => x(d.year))
    .y0(d => y(data[peakIdx].value))
    .y1(d => y(d.value))
    .curve(d3.curveMonotoneX);
  mainGroup.append("path").datum(declineData)
    .attr("class", "decline-shade")
    .attr("d", declineArea).attr("fill", C.redLight).style("opacity", 1);

  // Recovery shading (step 1 highlight)
  const recoveryData = data.filter(d => d.year >= data[troughIdx].year);
  const recoveryArea = d3.area()
    .x(d => x(d.year))
    .y0(d => y(data[troughIdx].value))
    .y1(d => y(d.value))
    .curve(d3.curveMonotoneX);
  mainGroup.append("path").datum(recoveryData)
    .attr("class", "recovery-shade")
    .attr("d", recoveryArea).attr("fill", C.greenLight).style("opacity", 0);

  // Peak reference line (step 1)
  mainGroup.append("line")
    .attr("class", "peak-ref-line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(6720)).attr("y2", y(6720))
    .attr("stroke", C.teal).attr("stroke-width", 1).attr("stroke-dasharray", "6,4")
    .style("opacity", 0);

  mainGroup.append("text")
    .attr("class", "chart-annotation peak-ref-label")
    .attr("x", dim.innerW).attr("y", y(6720) - 8)
    .attr("text-anchor", "end").attr("fill", C.muted)
    .text("2010 peak: \u00a36,720")
    .style("opacity", 0);

  // Latest label
  mainGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(last.year) + 8).attr("y", y(last.value) + 5)
    .attr("fill", C.teal).text(fmtGBP(last.value));

  // Axes
  mainGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => "'" + String(d).slice(2)).tickSize(0))
    .call(g => g.select(".domain").remove());
  mainGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => "\u00a3" + d3.format(",")(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Per-pupil spending (real terms)");

  // Axis break indicator (y-axis does not start at zero)
  const breakY = dim.innerH;
  mainGroup.append("path")
    .attr("d", `M${-8},${breakY - 6} L${-4},${breakY - 2} L${-8},${breakY + 2} L${-4},${breakY + 6}`)
    .attr("fill", "none").attr("stroke", C.muted).attr("stroke-width", 1.2);
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", -16).attr("y", breakY + 5)
    .attr("text-anchor", "end").attr("fill", C.muted)
    .attr("font-size", "10px").text("0 \u2260");

  // Hover
  const hoverRect = mainGroup.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = mainGroup.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDot = mainGroup.append("circle").attr("r", 4).attr("fill", C.teal).style("opacity", 0);

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const yr = Math.round(x.invert(mx));
    const d = data.find(a => a.year === yr);
    if (!d) return;
    hoverLine.attr("x1", x(yr)).attr("x2", x(yr)).style("opacity", 1);
    hoverDot.attr("cx", x(yr)).attr("cy", y(d.value)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${d.label}</div>
      <div class="tt-value">${fmtGBP(d.value)} per pupil</div>
      <div class="tt-value" style="color:${C.muted}">${d.value >= 6720 ? ("+" + ((d.value - 6720) / 6720 * 100).toFixed(1) + "% above") : (((6720 - d.value) / 6720 * 100).toFixed(1) + "% below")} 2010 peak</div>`, event);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0); hoverDot.style("opacity", 0); sobHideTooltip();
  });
}

function updateSpendingChart(step) {
  const svg = d3.select("#chart-spending svg");
  if (step === 0) {
    svg.select(".decline-shade").transition().duration(DURATION).style("opacity", 1);
    svg.select(".recovery-shade").transition().duration(DURATION).style("opacity", 0);
    svg.select(".peak-ref-line").transition().duration(DURATION).style("opacity", 0);
    svg.select(".peak-ref-label").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".decline-shade").transition().duration(DURATION).style("opacity", 0.3);
    svg.select(".recovery-shade").transition().duration(DURATION).style("opacity", 1);
    svg.select(".peak-ref-line").transition().duration(DURATION).style("opacity", 1);
    svg.select(".peak-ref-label").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 2: INTERNATIONAL — bar chart + PISA lines
   ========================================================= */
function buildIntlChart() {
  const container = document.getElementById("chart-intl");
  const dim = sobChartDims(container);
  const h = Math.max(540, dim.height);
  const m = { top: 30, right: 100, bottom: 40, left: sobIsMobile() ? 90 : 120 };
  const innerW = dim.width - m.left - m.right;
  const innerH = h - m.top - m.bottom;

  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", h)
    .attr("viewBox", `0 0 ${dim.width} ${h}`)
    .attr("role", "img")
    .attr("aria-label", "Horizontal bar chart comparing education spending as percentage of GDP across countries, and line chart of PISA scores over time.");
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  // --- BAR VIEW: spending % GDP (step 0) ---
  const barGroup = g.append("g").attr("class", "intl-bar-view");
  const intlData = DATA.intlSpending;

  const yBar = d3.scaleBand().domain(intlData.map(d => d.country)).range([0, innerH]).padding(0.28);
  const xBar = d3.scaleLinear().domain([0, 7.5]).range([0, innerW]);

  // Grid
  barGroup.append("g").attr("class", "grid")
    .call(d3.axisTop(xBar).ticks(6).tickSize(-innerH).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Bars
  barGroup.selectAll(".intl-bar").data(intlData).enter()
    .append("rect").attr("class", "intl-bar")
    .attr("x", 0).attr("y", d => yBar(d.country))
    .attr("width", d => xBar(d.pct)).attr("height", yBar.bandwidth())
    .attr("fill", d => d.country === "UK" ? C.teal : d.country === "OECD avg" ? C.amber : C.faint)
    .attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.country}</div>
        <div class="tt-value">${d.pct}% of GDP on education</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Value labels
  barGroup.selectAll(".intl-val").data(intlData).enter()
    .append("text").attr("class", d => (d.country === "UK" || d.country === "OECD avg") ? "chart-annotation-bold" : "chart-annotation")
    .attr("x", d => xBar(d.pct) + 8)
    .attr("y", d => yBar(d.country) + yBar.bandwidth() / 2 + 4.5)
    .attr("fill", d => d.country === "UK" ? C.teal : d.country === "OECD avg" ? C.amber : C.muted)
    .text(d => d.pct + "%");

  // Country labels
  barGroup.selectAll(".intl-name").data(intlData).enter()
    .append("text").attr("class", "chart-annotation")
    .attr("x", -8).attr("y", d => yBar(d.country) + yBar.bandwidth() / 2 + 4.5)
    .attr("text-anchor", "end")
    .attr("fill", d => d.country === "UK" ? C.teal : d.country === "OECD avg" ? C.amber : C.ink)
    .attr("font-weight", d => (d.country === "UK" || d.country === "OECD avg") ? 600 : 400)
    .text(d => d.country);

  // X axis
  barGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xBar).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Title
  barGroup.append("text").attr("class", "chart-annotation")
    .attr("x", innerW / 2).attr("y", -12)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .text("Education spending as % of GDP");

  // --- PISA VIEW (step 1, hidden) ---
  const pisaGroup = g.append("g").attr("class", "pisa-view").style("opacity", 0).style("pointer-events", "none");
  const pisaData = DATA.pisaScores;

  const xPisa = d3.scaleLinear().domain([2006, 2022]).range([0, innerW]);
  const yPisa = d3.scaleLinear().domain([460, 525]).range([innerH, 0]);

  // Grid
  pisaGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yPisa).ticks(6).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  const subjects = [
    { ukKey: "ukMaths", oecdKey: "oecdMaths", label: "Maths", color: C.teal },
    { ukKey: "ukReading", oecdKey: "oecdReading", label: "Reading", color: C.purple },
    { ukKey: "ukScience", oecdKey: "oecdScience", label: "Science", color: C.orange }
  ];

  subjects.forEach(sub => {
    // UK line
    const ukLine = d3.line().x(d => xPisa(d.year)).y(d => yPisa(d[sub.ukKey])).curve(d3.curveMonotoneX);
    pisaGroup.append("path").datum(pisaData)
      .attr("d", ukLine).attr("fill", "none").attr("stroke", sub.color).attr("stroke-width", 2.5);

    // OECD line (dashed)
    const oecdLine = d3.line().x(d => xPisa(d.year)).y(d => yPisa(d[sub.oecdKey])).curve(d3.curveMonotoneX);
    pisaGroup.append("path").datum(pisaData)
      .attr("d", oecdLine).attr("fill", "none").attr("stroke", sub.color).attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,4").attr("opacity", 0.5);

    // End labels - UK only (OECD labels removed to prevent overlap; dashed-line legend suffices)
    const lastP = pisaData[pisaData.length - 1];
    // Manually separate labels: Science top, Reading middle, Maths bottom
    const ukLabelOffsets = { "ukScience": -8, "ukReading": 4, "ukMaths": 16 };
    pisaGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", xPisa(lastP.year) + 8).attr("y", yPisa(lastP[sub.ukKey]) + (ukLabelOffsets[sub.ukKey] || 4))
      .attr("fill", sub.color).text(sub.label + " " + lastP[sub.ukKey]);

    // Dots
    pisaGroup.selectAll(".pisa-dot-" + sub.ukKey).data(pisaData).enter()
      .append("circle")
      .attr("cx", d => xPisa(d.year)).attr("cy", d => yPisa(d[sub.ukKey]))
      .attr("r", 3.5).attr("fill", sub.color).attr("stroke", "#fff").attr("stroke-width", 1.5)
      .on("mousemove", function(event, d) {
        sobShowTooltip(`<div class="tt-label">PISA ${d.year} &mdash; ${sub.label}</div>
          <div class="tt-value" style="color:${sub.color}">UK: ${d[sub.ukKey]}</div>
          <div class="tt-value" style="color:${sub.color};opacity:0.7">OECD avg: ${d[sub.oecdKey]}</div>
          <div class="tt-value">Gap: ${d[sub.ukKey] > d[sub.oecdKey] ? "+" : ""}${d[sub.ukKey] - d[sub.oecdKey]} pts</div>`, event);
      })
      .on("mouseleave", sobHideTooltip);
  });

  // Axes
  pisaGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xPisa).ticks(5).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  pisaGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yPisa).ticks(6).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Legend
  pisaGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -12).attr("fill", C.muted)
    .text("Solid = UK, dashed = OECD average");
}

function updateIntlChart(step) {
  const svg = d3.select("#chart-intl svg");
  if (step === 0) {
    svg.select(".intl-bar-view").transition().duration(CROSSFADE).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".pisa-view").transition().duration(CROSSFADE).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".intl-bar-view").transition().duration(CROSSFADE).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".pisa-view").transition().duration(CROSSFADE).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 3: GCSE RESULTS
   ========================================================= */
function buildGcseChart() {
  const container = document.getElementById("chart-gcse");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img")
    .attr("aria-label", "Line chart showing GCSE attainment rates under old and new grading systems from 2005 to 2024, with COVID-era grade inflation highlighted.");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const raw = DATA.gcseResults;
  const oldMeasure = raw.filter(d => d.measure.startsWith("5+"));
  const newMeasure = raw.filter(d => d.measure.startsWith("Grade"));

  const x = d3.scaleLinear().domain([2005, 2024]).range([0, dim.innerW]);
  const y = d3.scaleLinear().domain([30, 65]).range([dim.innerH, 0]);

  // --- OLD MEASURE VIEW (step 0) + new measure faint ---
  const mainGroup = g.append("g").attr("class", "gcse-main");

  // Grid
  mainGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Measure change annotation band
  mainGroup.append("rect")
    .attr("x", x(2016.5)).attr("y", 0)
    .attr("width", x(2017.5) - x(2016.5)).attr("height", dim.innerH)
    .attr("fill", "#F0F0EB");
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2017)).attr("y", 16)
    .attr("text-anchor", "middle").attr("fill", C.muted)
    .attr("font-size", "12px")
    .text("New grading");

  // Old measure line
  const oldLine = d3.line().x(d => x(d.year)).y(d => y(d.rate)).curve(d3.curveMonotoneX);
  mainGroup.append("path").datum(oldMeasure)
    .attr("d", oldLine).attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // New measure line
  const newLine = d3.line().x(d => x(d.year)).y(d => y(d.rate)).curve(d3.curveMonotoneX);
  mainGroup.append("path").datum(newMeasure)
    .attr("d", newLine).attr("fill", "none").attr("stroke", C.blue).attr("stroke-width", 2.5);

  // Old measure dots
  mainGroup.selectAll(".old-dot").data(oldMeasure).enter()
    .append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.rate))
    .attr("r", 3.5).attr("fill", C.teal).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value">${d.rate}% &mdash; ${d.measure}</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // New measure dots
  mainGroup.selectAll(".new-dot").data(newMeasure).enter()
    .append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.rate))
    .attr("r", 3.5).attr("fill", C.blue).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value">${d.rate}% &mdash; ${d.measure}</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // COVID highlight (step 1)
  const covidData = newMeasure.filter(d => d.year >= 2020 && d.year <= 2021);
  mainGroup.selectAll(".covid-ring").data(covidData).enter()
    .append("circle")
    .attr("class", "covid-ring")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.rate))
    .attr("r", 10).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2)
    .style("opacity", 0);

  mainGroup.append("text")
    .attr("class", "chart-annotation covid-label")
    .attr("x", x(2020.5)).attr("y", y(52) - 24)
    .attr("text-anchor", "middle").attr("fill", C.red)
    .text("Teacher-assessed grades")
    .style("opacity", 0);

  // End labels
  const lastOld = oldMeasure[oldMeasure.length - 1];
  mainGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastOld.year)).attr("y", y(lastOld.rate) - 12)
    .attr("text-anchor", "middle").attr("fill", C.teal)
    .text(lastOld.rate + "%");

  const lastNew = newMeasure[newMeasure.length - 1];
  mainGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(lastNew.year) + 10).attr("y", y(lastNew.rate) + 5)
    .attr("fill", C.blue).text(lastNew.rate + "%");

  // Peak old
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(2012)).attr("y", y(59.4) - 12)
    .attr("text-anchor", "middle").attr("fill", C.teal)
    .text("59.4% peak");

  // Legend -- positioned relative to first item width
  const legendX1 = 10;
  mainGroup.append("line").attr("x1", legendX1).attr("x2", legendX1 + 24).attr("y1", -10).attr("y2", -10)
    .attr("stroke", C.teal).attr("stroke-width", 2.5);
  const oldLabel = mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", legendX1 + 28).attr("y", -6).attr("fill", C.teal).text("5+ A*\u2013C (old)");
  const legendX2 = legendX1 + 28 + (oldLabel.node().getComputedTextLength ? oldLabel.node().getComputedTextLength() + 20 : 120);
  mainGroup.append("line").attr("x1", legendX2).attr("x2", legendX2 + 24).attr("y1", -10).attr("y2", -10)
    .attr("stroke", C.blue).attr("stroke-width", 2.5);
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", legendX2 + 28).attr("y", -6).attr("fill", C.blue).text("Grade 5+ (new)");

  // Axes
  mainGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  mainGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y-axis title (horizontal, above axis)
  mainGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("% achieving threshold");
}

function updateGcseChart(step) {
  const svg = d3.select("#chart-gcse svg");
  if (step === 0) {
    svg.selectAll(".covid-ring").transition().duration(DURATION).style("opacity", 0);
    svg.select(".covid-label").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.selectAll(".covid-ring").transition().duration(DURATION).style("opacity", 1);
    svg.select(".covid-label").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 4: TEACHERS — vacancy rate + pupil-teacher ratio
   ========================================================= */
function buildTeachersChart() {
  const container = document.getElementById("chart-teachers");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img")
    .attr("aria-label", "Charts showing teacher vacancy rates rising from 0.2% to 0.6% since 2012, and pupil-teacher ratios hovering around 17.5 to 18.1.");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const data = DATA.teacherWorkforce;

  // --- VACANCY RATE VIEW (step 0) ---
  const vacGroup = g.append("g").attr("class", "vacancy-view");

  const xVac = d3.scaleLinear().domain([2010, 2024]).range([0, dim.innerW]);
  const yVac = d3.scaleLinear().domain([0, 0.8]).range([dim.innerH, 0]);

  // Grid
  vacGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yVac).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Line
  const vacLine = d3.line().x(d => xVac(d.year)).y(d => yVac(d.vacancyRate)).curve(d3.curveMonotoneX);
  vacGroup.append("path").datum(data)
    .attr("d", vacLine).attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);

  // Dots
  vacGroup.selectAll(".vac-dot").data(data).enter()
    .append("circle")
    .attr("cx", d => xVac(d.year)).attr("cy", d => yVac(d.vacancyRate))
    .attr("r", 3.5).attr("fill", C.red).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value">Vacancy rate: ${d.vacancyRate}%</div>
        <div class="tt-value">${d.teachers}k teachers</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Annotations
  const peak = data.reduce((a, b) => b.vacancyRate > a.vacancyRate ? b : a);
  vacGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xVac(peak.year)).attr("y", yVac(peak.vacancyRate) - 16)
    .attr("text-anchor", "middle").attr("fill", C.red)
    .text(peak.vacancyRate + "% (" + peak.year + ")");

  const low = data.reduce((a, b) => b.vacancyRate < a.vacancyRate ? b : a);
  vacGroup.append("text").attr("class", "chart-annotation")
    .attr("x", xVac(low.year) + 8).attr("y", yVac(low.vacancyRate) + 20)
    .attr("fill", C.muted)
    .text(low.vacancyRate + "% low");

  // Axes
  vacGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xVac).ticks(7).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  vacGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yVac).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  vacGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Teacher vacancy rate");

  // --- PUPIL-TEACHER RATIO (step 1, hidden) ---
  const ratioGroup = g.append("g").attr("class", "ratio-view").style("opacity", 0).style("pointer-events", "none");

  const xRatio = d3.scaleLinear().domain([2010, 2024]).range([0, dim.innerW]);
  const yRatio = d3.scaleLinear().domain([16, 19]).range([dim.innerH, 0]);

  // Grid
  ratioGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yRatio).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Line
  const ratioLine = d3.line().x(d => xRatio(d.year)).y(d => yRatio(d.ratio)).curve(d3.curveMonotoneX);
  ratioGroup.append("path").datum(data)
    .attr("d", ratioLine).attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // Dots
  ratioGroup.selectAll(".ratio-dot").data(data).enter()
    .append("circle")
    .attr("cx", d => xRatio(d.year)).attr("cy", d => yRatio(d.ratio))
    .attr("r", 3.5).attr("fill", C.teal).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.year}</div>
        <div class="tt-value">Pupil-teacher ratio: ${d.ratio}</div>
        <div class="tt-value">${d.teachers}k teachers</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Peak ratio annotation
  const peakRatio = data.reduce((a, b) => b.ratio > a.ratio ? b : a);
  ratioGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xRatio(peakRatio.year)).attr("y", yRatio(peakRatio.ratio) - 14)
    .attr("text-anchor", "middle").attr("fill", C.tealDark)
    .text(peakRatio.ratio + ":1 (" + peakRatio.year + ")");

  // Latest
  const lastR = data[data.length - 1];
  ratioGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xRatio(lastR.year) + 8).attr("y", yRatio(lastR.ratio) + 5)
    .attr("fill", C.teal).text(lastR.ratio + ":1");

  // Axes
  ratioGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xRatio).ticks(7).tickFormat(d3.format("d")).tickSize(0))
    .call(g => g.select(".domain").remove());
  ratioGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yRatio).ticks(6).tickFormat(d => d + ":1").tickSize(0))
    .call(g => g.select(".domain").remove());

  ratioGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Pupil-teacher ratio");

  // Axis break indicator (y-axis does not start at zero)
  const ratioBreakY = dim.innerH;
  ratioGroup.append("path")
    .attr("d", `M${-8},${ratioBreakY - 6} L${-4},${ratioBreakY - 2} L${-8},${ratioBreakY + 2} L${-4},${ratioBreakY + 6}`)
    .attr("fill", "none").attr("stroke", C.muted).attr("stroke-width", 1.2);
  ratioGroup.append("text").attr("class", "chart-annotation")
    .attr("x", -16).attr("y", ratioBreakY + 5)
    .attr("text-anchor", "end").attr("fill", C.muted)
    .attr("font-size", "10px").text("0 \u2260");
}

function updateTeachersChart(step) {
  const svg = d3.select("#chart-teachers svg");
  if (step === 0) {
    svg.select(".vacancy-view").transition().duration(CROSSFADE).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".ratio-view").transition().duration(CROSSFADE).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".vacancy-view").transition().duration(CROSSFADE).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".ratio-view").transition().duration(CROSSFADE).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   CHART 5: HIGHER EDUCATION — participation + degree classes
   ========================================================= */
function buildHeChart() {
  const container = document.getElementById("chart-he");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img")
    .attr("aria-label", "Charts showing higher education participation rising from 38% to 55% then edging back, and degree classification inflation with Firsts doubling from 15% to 36%.");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  // --- HE PARTICIPATION (step 0) ---
  const partGroup = g.append("g").attr("class", "he-part-view");
  const heData = DATA.heParticipation.map(d => ({ year: parseAcademicYear(d.year), label: d.year, rate: d.rate }));

  const xPart = d3.scaleLinear().domain([d3.min(heData, d => d.year), d3.max(heData, d => d.year)]).range([0, dim.innerW]);
  const yPart = d3.scaleLinear().domain([30, 60]).range([dim.innerH, 0]);

  // Grid
  partGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yPart).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Line
  const partLine = d3.line().x(d => xPart(d.year)).y(d => yPart(d.rate)).curve(d3.curveMonotoneX);
  partGroup.append("path").datum(heData)
    .attr("d", partLine).attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // Dots
  partGroup.selectAll(".part-dot").data(heData).enter()
    .append("circle")
    .attr("cx", d => xPart(d.year)).attr("cy", d => yPart(d.rate))
    .attr("r", 3.5).attr("fill", C.teal).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${d.label}</div>
        <div class="tt-value">HE participation: ${d.rate}%</div>`, event);
    })
    .on("mouseleave", sobHideTooltip);

  // Fee hike annotation
  const feeYear = heData.find(d => d.year === 2012);
  if (feeYear) {
    partGroup.append("line")
      .attr("x1", xPart(2012)).attr("x2", xPart(2012))
      .attr("y1", yPart(feeYear.rate) - 40).attr("y2", yPart(feeYear.rate) - 6)
      .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");
    partGroup.append("text").attr("class", "chart-annotation")
      .attr("x", xPart(2012)).attr("y", yPart(feeYear.rate) - 44)
      .attr("text-anchor", "middle").attr("fill", C.red)
      .text("\u00a39k fees");
  }

  // Peak
  const peakHe = heData.reduce((a, b) => b.rate > a.rate ? b : a);
  partGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xPart(peakHe.year)).attr("y", yPart(peakHe.rate) - 14)
    .attr("text-anchor", "middle").attr("fill", C.teal)
    .text(peakHe.rate + "%");

  // Latest
  const lastHe = heData[heData.length - 1];
  partGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", xPart(lastHe.year) + 8).attr("y", yPart(lastHe.rate) + 5)
    .attr("fill", C.teal).text(lastHe.rate + "%");

  // Axes
  partGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xPart).ticks(7).tickFormat(d => "'" + String(d).slice(2)).tickSize(0))
    .call(g => g.select(".domain").remove());
  partGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yPart).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  partGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("HE participation rate");

  // Axis break indicator (y-axis does not start at zero)
  const partBreakY = dim.innerH;
  partGroup.append("path")
    .attr("d", `M${-8},${partBreakY - 6} L${-4},${partBreakY - 2} L${-8},${partBreakY + 2} L${-4},${partBreakY + 6}`)
    .attr("fill", "none").attr("stroke", C.muted).attr("stroke-width", 1.2);
  partGroup.append("text").attr("class", "chart-annotation")
    .attr("x", -16).attr("y", partBreakY + 5)
    .attr("text-anchor", "end").attr("fill", C.muted)
    .attr("font-size", "10px").text("0 \u2260");

  // --- DEGREE CLASSIFICATION (step 1, hidden) ---
  const degGroup = g.append("g").attr("class", "degree-view").style("opacity", 0).style("pointer-events", "none");
  const degData = DATA.degreeClassification.map(d => ({
    year: parseAcademicYear(d.year), label: d.year,
    first: d.first, twoOne: d.twoOne, twoTwo: d.twoTwo, third: d.third
  }));

  const xDeg = d3.scaleLinear().domain([d3.min(degData, d => d.year), d3.max(degData, d => d.year)]).range([0, dim.innerW]);
  const yDeg = d3.scaleLinear().domain([0, 100]).range([dim.innerH, 0]);

  // Grid
  degGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yDeg).ticks(5).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Stacked area
  const stack = d3.stack()
    .keys(["third", "twoTwo", "twoOne", "first"])
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(degData);
  const stackColors = {
    "first": "#0D9488",
    "twoOne": "#2563A0",
    "twoTwo": C.amber,
    "third": C.faint
  };
  const stackLabels = {
    "first": "First",
    "twoOne": "2:1",
    "twoTwo": "2:2",
    "third": "Third/other"
  };

  const areaGen = d3.area()
    .x(d => xDeg(d.data.year))
    .y0(d => yDeg(d[0]))
    .y1(d => yDeg(d[1]))
    .curve(d3.curveMonotoneX);

  stackedData.forEach(layer => {
    degGroup.append("path")
      .datum(layer)
      .attr("d", areaGen)
      .attr("fill", stackColors[layer.key])
      .attr("opacity", 1)
      .on("mousemove", function(event) {
        const [mx] = d3.pointer(event, this);
        const yr = Math.round(xDeg.invert(mx));
        const d = degData.find(a => a.year === yr);
        if (!d) return;
        sobShowTooltip(`<div class="tt-label">${d.label}</div>
          <div class="tt-value" style="color:${stackColors.first}">First: ${d.first}%</div>
          <div class="tt-value" style="color:${stackColors.twoOne}">2:1: ${d.twoOne}%</div>
          <div class="tt-value" style="color:${stackColors.twoTwo}">2:2: ${d.twoTwo}%</div>
          <div class="tt-value" style="color:${stackColors.third}">Third/other: ${d.third}%</div>`, event);
      })
      .on("mouseleave", sobHideTooltip);
  });

  // Direct labels at end
  const lastDeg = degData[degData.length - 1];
  const labelData = [
    { key: "first", y: lastDeg.third + lastDeg.twoTwo + lastDeg.twoOne + lastDeg.first / 2, val: lastDeg.first },
    { key: "twoOne", y: lastDeg.third + lastDeg.twoTwo + lastDeg.twoOne / 2, val: lastDeg.twoOne },
    { key: "twoTwo", y: lastDeg.third + lastDeg.twoTwo / 2, val: lastDeg.twoTwo },
    { key: "third", y: lastDeg.third / 2, val: lastDeg.third }
  ];

  labelData.forEach(ld => {
    degGroup.append("text").attr("class", "chart-annotation-bold")
      .attr("x", xDeg(lastDeg.year) + 8)
      .attr("y", yDeg(ld.y) + 4)
      .attr("fill", stackColors[ld.key])
      .text(stackLabels[ld.key] + " " + ld.val + "%");
  });

  // Axes
  degGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(xDeg).ticks(7).tickFormat(d => "'" + String(d).slice(2)).tickSize(0))
    .call(g => g.select(".domain").remove());
  degGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yDeg).ticks(5).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  degGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 0).attr("y", -10)
    .attr("text-anchor", "start").attr("fill", C.muted)
    .text("Degree classification (%)");
}

function updateHeChart(step) {
  const svg = d3.select("#chart-he svg");
  if (step === 0) {
    svg.select(".he-part-view").transition().duration(CROSSFADE).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
    svg.select(".degree-view").transition().duration(CROSSFADE).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
  } else {
    svg.select(".he-part-view").transition().duration(CROSSFADE).style("opacity", 0).on("end", function() { d3.select(this).style("pointer-events", "none"); });
    svg.select(".degree-view").transition().duration(CROSSFADE).style("opacity", 1).on("end", function() { d3.select(this).style("pointer-events", "all"); });
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "spending": updateSpendingChart(step); break;
    case "intl": updateIntlChart(step); break;
    case "gcse": updateGcseChart(step); break;
    case "teachers": updateTeachersChart(step); break;
    case "he": updateHeChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("spending"); }

})();
