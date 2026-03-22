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
function fmtNum(v) {
  if (v >= 1e6) return d3.format(".2f")(v / 1e6) + "m";
  if (v >= 1e4) return d3.format(",")(Math.round(v / 1e3)) + "k";
  if (v >= 1e3) return d3.format(".1f")(v / 1e3) + "k";
  return d3.format(",")(Math.round(v));
}
function fmtNumFull(v) { return d3.format(",")(Math.round(v)); }
function fmtWeeks(v) { return d3.format(".1f")(v) + " wks"; }

function parseDate(period) {
  const [y, m] = period.split("-");
  return new Date(+y, +m - 1, 1);
}
function formatPeriod(period) {
  const d = parseDate(period);
  return d3.timeFormat("%b %Y")(d);
}



/* =========================================================
   DATA LOAD & INIT
   ========================================================= */
let DATA;

sobFetchJSON("https://stateofbritain.uk/api/data/nhs.json")
  .then(d => { DATA = d; init(); })
  .catch(sobShowError);

function init() {
  sobRevealContent();

  const s = DATA.summary;
  const rtt = DATA.rtt;
  const latest = rtt[rtt.length - 1];

  // Set big numbers
  document.getElementById("bn-waiting").textContent = fmtNum(s.totalWaiting);
  document.getElementById("bn-18week").textContent = sobFmtPct(s.pctWithin18Weeks);
  document.getElementById("bn-52week").textContent = fmtNumFull(s.over52Weeks);
  document.getElementById("bn-median").textContent = d3.format(".1f")(s.medianWait);
  document.getElementById("bn-ae").textContent = sobFmtPct(s.aePctWithin4Hours);
  document.getElementById("ae-type1").textContent = sobFmtPct(DATA.ae[DATA.ae.length - 1].pctWithin4HoursType1);

  // Find when 92% target was last met
  let lastMet = null;
  for (let i = 0; i < rtt.length; i++) {
    if (rtt[i].pctWithin18 >= 92) lastMet = rtt[i].period;
  }
  if (lastMet) document.getElementById("target-last-met").textContent = formatPeriod(lastMet);

  buildAllCharts();
  setupScrollObserver();
  window.addEventListener("resize", sobDebounce(rebuildAll, 250));
}

function rebuildAll() {
  d3.selectAll("#chart-hook svg, #chart-18week svg, #chart-longwait svg, #chart-median svg, #chart-ae svg, #chart-outlook svg").remove();
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
  build18WeekChart();
  buildLongWaitChart();
  buildMedianChart();
  buildAEChart();
  buildOutlookChart();
}

/* =========================================================
   SHARED: addHoverLine helper
   ========================================================= */
function addHoverBehavior(group, dim, xScale, rttData, tooltipFn) {
  const hoverRect = group.append("rect")
    .attr("width", dim.innerW).attr("height", dim.innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");
  const hoverLine = group.append("line")
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
  const hoverDots = [];

  hoverRect.on("mousemove", function(event) {
    const [mx] = d3.pointer(event, this);
    const date = xScale.invert(mx);
    let closest = null, minDist = Infinity;
    rttData.forEach(d => {
      const dist = Math.abs(parseDate(d.period) - date);
      if (dist < minDist) { minDist = dist; closest = d; }
    });
    if (!closest) return;
    const cx = xScale(parseDate(closest.period));
    hoverLine.attr("x1", cx).attr("x2", cx).style("opacity", 1);
    tooltipFn(closest, event, cx);
  }).on("mouseleave", function() {
    hoverLine.style("opacity", 0);
    sobHideTooltip();
    group.selectAll(".hover-dot").style("opacity", 0);
  });

  return { hoverLine };
}

/* =========================================================
   CHART 1: THE HOOK — Total Waiting List
   ========================================================= */
function buildHookChart() {
  const container = document.getElementById("chart-hook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Line chart showing total NHS waiting list over time, rising from around 2.5 million to over 7 million");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const rtt = DATA.rtt;
  const latest = rtt[rtt.length - 1];

  const x = d3.scaleTime()
    .domain([parseDate(rtt[0].period), parseDate(rtt[rtt.length - 1].period)])
    .range([0, dim.innerW]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(rtt, d => d.totalWaiting) * 1.08])
    .range([dim.innerH, 0]);

  // --- STEP 0: Big number only, chart faded ---
  const bgGroup = g.append("g").attr("class", "hook-bg");

  // Grid
  bgGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const area = d3.area()
    .x(d => x(parseDate(d.period)))
    .y0(dim.innerH)
    .y1(d => y(d.totalWaiting))
    .curve(d3.curveMonotoneX);

  bgGroup.append("path").datum(rtt)
    .attr("d", area)
    .attr("fill", C.tealLight);

  // Line
  const line = d3.line()
    .x(d => x(parseDate(d.period)))
    .y(d => y(d.totalWaiting))
    .curve(d3.curveMonotoneX);

  bgGroup.append("path").datum(rtt)
    .attr("d", line)
    .attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // X axis
  bgGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y axis
  bgGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => fmtNum(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // End label — offset above the line with leader line
  bgGroup.append("line")
    .attr("x1", x(parseDate(latest.period))).attr("x2", x(parseDate(latest.period)))
    .attr("y1", y(latest.totalWaiting) - 4).attr("y2", y(latest.totalWaiting) - 16)
    .attr("stroke", C.teal).attr("stroke-width", 1);
  bgGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(latest.period)) + 6)
    .attr("y", y(latest.totalWaiting) - 20)
    .attr("fill", C.teal).text(fmtNum(latest.totalWaiting));

  // COVID annotation
  const covidStart = rtt.find(d => d.period === "2020-03");
  if (covidStart) {
    bgGroup.append("line")
      .attr("x1", x(parseDate("2020-03"))).attr("x2", x(parseDate("2020-03")))
      .attr("y1", 0).attr("y2", dim.innerH)
      .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
    bgGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(parseDate("2020-03")) + 6).attr("y", 14)
      .attr("fill", C.muted).text("Elective care suspended");
  }

  // Initial state: step 0 shows faded chart (0.35 reads as intentionally muted, not broken)
  bgGroup.style("opacity", 0.35);

  // --- STEP 1: Full chart visible ---
  // (We toggle opacity on bgGroup)

  // Hover
  const hoverGroup = g.append("g").attr("class", "hook-hover").style("opacity", 0);
  const hoverDot = hoverGroup.append("circle").attr("class", "hover-dot").attr("r", 4).attr("fill", C.teal).style("opacity", 0);

  addHoverBehavior(hoverGroup, dim, x, rtt, function(d, event, cx) {
    hoverDot.attr("cx", cx).attr("cy", y(d.totalWaiting)).style("opacity", 1);
    // Find year-ago value for context
    const [yr, mo] = d.period.split("-");
    const yoyPeriod = (parseInt(yr) - 1) + "-" + mo;
    const yoyRow = rtt.find(r => r.period === yoyPeriod);
    let yoyStr = "";
    if (yoyRow) {
      const pctChg = ((d.totalWaiting - yoyRow.totalWaiting) / yoyRow.totalWaiting * 100);
      const sign = pctChg >= 0 ? "+" : "";
      yoyStr = `<div class="tt-value" style="font-size:12px;color:${C.muted}">${sign}${d3.format(".1f")(pctChg)}% vs year ago</div>`;
    }
    sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)}</div>
      <div class="tt-value">${fmtNumFull(d.totalWaiting)} waiting</div>${yoyStr}`, event);
  });
}

function updateHookChart(step) {
  const svg = d3.select("#chart-hook svg");
  if (step === 0) {
    svg.select(".hook-bg").transition().duration(DURATION).style("opacity", 0.35);
    svg.select(".hook-hover").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".hook-bg").transition().duration(DURATION).style("opacity", 1);
    svg.select(".hook-hover").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 2: 18-WEEK TARGET
   ========================================================= */
function build18WeekChart() {
  const container = document.getElementById("chart-18week");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Line chart showing percentage of patients treated within 18 weeks, falling from above 92% target to around 60%");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const rtt = DATA.rtt;
  const latest = rtt[rtt.length - 1];

  const x = d3.scaleTime()
    .domain([parseDate(rtt[0].period), parseDate(rtt[rtt.length - 1].period)])
    .range([0, dim.innerW]);
  const y = d3.scaleLinear()
    .domain([40, 100])
    .range([dim.innerH, 0]);

  // --- Step 0: early years meeting target ---
  const earlyGroup = g.append("g").attr("class", "early-view");

  // Grid
  earlyGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // 92% target line
  earlyGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(92)).attr("y2", y(92))
    .attr("stroke", C.red).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  earlyGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", dim.innerW + 4).attr("y", y(92) + 4)
    .attr("fill", C.red).text("92% target");

  // Data line
  const line = d3.line()
    .x(d => x(parseDate(d.period)))
    .y(d => y(d.pctWithin18))
    .curve(d3.curveMonotoneX);

  // Line coloured by whether target is met: teal above 92%, red below
  // Use a gradient trick with a clipPath for clean colour transition
  const lineId18 = "line-18wk-" + Math.random().toString(36).slice(2,8);
  const defs = svg.append("defs");
  // Clip paths relative to the inner chart group coordinate system
  defs.append("clipPath").attr("id", lineId18 + "-above")
    .attr("clipPathUnits", "userSpaceOnUse")
    .append("rect").attr("x", -10).attr("y", -10)
    .attr("width", dim.innerW + 20).attr("height", y(92) + 10);
  defs.append("clipPath").attr("id", lineId18 + "-below")
    .attr("clipPathUnits", "userSpaceOnUse")
    .append("rect").attr("x", -10).attr("y", y(92))
    .attr("width", dim.innerW + 20).attr("height", dim.innerH - y(92) + 10);

  earlyGroup.append("path").datum(rtt)
    .attr("d", line)
    .attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5)
    .attr("clip-path", `url(#${lineId18}-above)`);
  earlyGroup.append("path").datum(rtt)
    .attr("d", line)
    .attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5)
    .attr("clip-path", `url(#${lineId18}-below)`);

  // X axis
  earlyGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y axis (starts at 40% -- add break marker for honesty)
  earlyGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());
  // Axis-break zigzag at bottom to signal truncated scale
  const breakY = dim.innerH;
  earlyGroup.append("path")
    .attr("d", `M${-8},${breakY - 6} L${-4},${breakY - 2} L${-8},${breakY + 2} L${-4},${breakY + 6}`)
    .attr("fill", "none").attr("stroke", C.faint).attr("stroke-width", 1.5);

  // End label — offset below with leader line to avoid sitting on the data line
  earlyGroup.append("line")
    .attr("x1", x(parseDate(latest.period))).attr("x2", x(parseDate(latest.period)))
    .attr("y1", y(latest.pctWithin18) + 4).attr("y2", y(latest.pctWithin18) + 18)
    .attr("stroke", C.red).attr("stroke-width", 1);
  earlyGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(latest.period)) + 6)
    .attr("y", y(latest.pctWithin18) + 30)
    .attr("fill", C.red).text(sobFmtPct(latest.pctWithin18));

  // Start label — offset above with enough clearance
  earlyGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate(rtt[0].period)) + 6)
    .attr("y", y(rtt[0].pctWithin18) - 12)
    .attr("text-anchor", "start").attr("fill", C.teal)
    .text(sobFmtPct(rtt[0].pctWithin18));

  // --- Step 1 additions: red danger zone below target ---
  const dangerGroup = g.append("g").attr("class", "danger-view").style("opacity", 0);

  // Red shaded area below 92%
  const clipBelow = d3.area()
    .x(d => x(parseDate(d.period)))
    .y0(d => y(Math.min(d.pctWithin18, 92)))
    .y1(y(40))
    .curve(d3.curveMonotoneX);

  dangerGroup.append("path").datum(rtt.filter(d => d.pctWithin18 < 92))
    .attr("d", d3.area()
      .x(d => x(parseDate(d.period)))
      .y0(y(92))
      .y1(d => y(d.pctWithin18))
      .curve(d3.curveMonotoneX))
    .attr("fill", C.redLight);

  // Find when target was first consistently missed
  let firstBreachIdx = -1;
  for (let i = 0; i < rtt.length; i++) {
    if (rtt[i].pctWithin18 < 92) {
      // Check if it stays below
      let staysBelow = true;
      for (let j = i; j < Math.min(i + 6, rtt.length); j++) {
        if (rtt[j].pctWithin18 >= 92) { staysBelow = false; break; }
      }
      if (staysBelow) { firstBreachIdx = i; break; }
    }
  }

  if (firstBreachIdx >= 0) {
    const breachPeriod = rtt[firstBreachIdx].period;
    dangerGroup.append("line")
      .attr("x1", x(parseDate(breachPeriod))).attr("x2", x(parseDate(breachPeriod)))
      .attr("y1", 0).attr("y2", dim.innerH)
      .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
    dangerGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(parseDate(breachPeriod)) + 6).attr("y", 14)
      .attr("fill", C.red).text("Demand outpaces capacity");
    dangerGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(parseDate(breachPeriod)) + 6).attr("y", 28)
      .attr("fill", C.red).text("92% never met again (" + formatPeriod(breachPeriod) + ")");
  }

  // COVID annotation -- explain the mechanism, not just the event
  dangerGroup.append("line")
    .attr("x1", x(parseDate("2020-03"))).attr("x2", x(parseDate("2020-03")))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  dangerGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", dim.innerH - 28)
    .attr("fill", C.muted).text("Routine referrals");
  dangerGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", dim.innerH - 14)
    .attr("fill", C.muted).text("halted");

  // Lowest point annotation
  const lowest = rtt.reduce((a, b) => a.pctWithin18 < b.pctWithin18 ? a : b);
  dangerGroup.append("circle")
    .attr("cx", x(parseDate(lowest.period))).attr("cy", y(lowest.pctWithin18))
    .attr("r", 4).attr("fill", C.red);
  // Leader line from dot to annotation in white space below
  dangerGroup.append("line")
    .attr("x1", x(parseDate(lowest.period))).attr("x2", x(parseDate(lowest.period)) + 12)
    .attr("y1", y(lowest.pctWithin18) + 6).attr("y2", y(lowest.pctWithin18) + 22)
    .attr("stroke", C.red).attr("stroke-width", 1);
  dangerGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(lowest.period)) + 14).attr("y", y(lowest.pctWithin18) + 34)
    .attr("fill", C.red).text("Low: " + sobFmtPct(lowest.pctWithin18));

  // Hover
  const hoverGroup = g.append("g").attr("class", "w18-hover");
  const hoverDot = hoverGroup.append("circle").attr("class", "hover-dot").attr("r", 4).attr("fill", C.teal).style("opacity", 0);

  addHoverBehavior(hoverGroup, dim, x, rtt, function(d, event, cx) {
    hoverDot.attr("cx", cx).attr("cy", y(d.pctWithin18)).style("opacity", 1);
    const metTarget = d.pctWithin18 >= 92;
    sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)}</div>
      <div class="tt-value" style="color:${metTarget ? C.teal : C.red}">${sobFmtPct(d.pctWithin18)} within 18 weeks</div>
      <div class="tt-value" style="font-size:13px;color:${C.muted}">${metTarget ? "Target met" : "Target missed (" + d3.format(".1f")(92 - d.pctWithin18) + "pp gap)"}</div>`, event);
  });
}

function update18WeekChart(step) {
  const svg = d3.select("#chart-18week svg");
  if (step === 0) {
    svg.select(".danger-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".danger-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 3: LONG WAITERS (52+ weeks)
   ========================================================= */
function buildLongWaitChart() {
  const container = document.getElementById("chart-longwait");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Area chart showing patients waiting over 52 weeks, spiking from near-zero pre-COVID to over 400,000 at peak");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const rtt = DATA.rtt;
  const latest = rtt[rtt.length - 1];
  const peak = rtt.reduce((a, b) => a.over52weeks > b.over52weeks ? a : b);

  const x = d3.scaleTime()
    .domain([parseDate(rtt[0].period), parseDate(rtt[rtt.length - 1].period)])
    .range([0, dim.innerW]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(rtt, d => d.over52weeks) * 1.1])
    .range([dim.innerH, 0]);

  // --- Step 0: Pre-COVID era showing near-zero ---
  const preGroup = g.append("g").attr("class", "pre-view");

  // Grid
  preGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const area = d3.area()
    .x(d => x(parseDate(d.period)))
    .y0(dim.innerH)
    .y1(d => y(d.over52weeks))
    .curve(d3.curveMonotoneX);

  preGroup.append("path").datum(rtt)
    .attr("d", area)
    .attr("fill", C.redLight);

  // Line
  const line = d3.line()
    .x(d => x(parseDate(d.period)))
    .y(d => y(d.over52weeks))
    .curve(d3.curveMonotoneX);

  preGroup.append("path").datum(rtt)
    .attr("d", line)
    .attr("fill", "none").attr("stroke", C.red).attr("stroke-width", 2.5);

  // X axis
  preGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y axis
  preGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => fmtNum(d)).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Pre-COVID annotation showing near-zero
  const preCovid = rtt.find(d => d.period === "2019-12");
  if (preCovid) {
    preGroup.append("text").attr("class", "chart-annotation")
      .attr("x", x(parseDate("2019-06"))).attr("y", y(preCovid.over52weeks) - 30)
      .attr("text-anchor", "middle").attr("fill", C.muted)
      .text("Pre-COVID: ~" + fmtNum(preCovid.over52weeks));
  }

  // --- Step 1: Peak annotation ---
  const peakGroup = g.append("g").attr("class", "peak-view").style("opacity", 0);

  // Peak annotation — leader line from dot to label in white space above
  peakGroup.append("circle")
    .attr("cx", x(parseDate(peak.period))).attr("cy", y(peak.over52weeks))
    .attr("r", 5).attr("fill", C.red);
  peakGroup.append("line")
    .attr("x1", x(parseDate(peak.period))).attr("x2", x(parseDate(peak.period)) - 14)
    .attr("y1", y(peak.over52weeks) - 7).attr("y2", y(peak.over52weeks) - 22)
    .attr("stroke", C.red).attr("stroke-width", 1);
  peakGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate(peak.period)) - 16).attr("y", y(peak.over52weeks) - 38)
    .attr("text-anchor", "end").attr("fill", C.muted)
    .text(formatPeriod(peak.period));
  peakGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(peak.period)) - 16).attr("y", y(peak.over52weeks) - 24)
    .attr("text-anchor", "end").attr("fill", C.red)
    .text("Peak: " + fmtNumFull(peak.over52weeks));

  // End label — offset above with leader line
  peakGroup.append("line")
    .attr("x1", x(parseDate(latest.period))).attr("x2", x(parseDate(latest.period)))
    .attr("y1", y(latest.over52weeks) - 4).attr("y2", y(latest.over52weeks) - 18)
    .attr("stroke", C.red).attr("stroke-width", 1);
  peakGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(latest.period)) + 6)
    .attr("y", y(latest.over52weeks) - 22)
    .attr("fill", C.red).text(fmtNum(latest.over52weeks));

  // COVID marker -- explain the mechanism
  peakGroup.append("line")
    .attr("x1", x(parseDate("2020-03"))).attr("x2", x(parseDate("2020-03")))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  peakGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", 14)
    .attr("fill", C.muted).text("Operations cancelled;");
  peakGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", 28)
    .attr("fill", C.muted).text("backlog balloons");

  // Hover
  const hoverGroup = g.append("g").attr("class", "lw-hover");
  const hoverDot = hoverGroup.append("circle").attr("class", "hover-dot").attr("r", 4).attr("fill", C.red).style("opacity", 0);

  addHoverBehavior(hoverGroup, dim, x, rtt, function(d, event, cx) {
    hoverDot.attr("cx", cx).attr("cy", y(d.over52weeks)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)}</div>
      <div class="tt-value" style="color:${C.red}">${fmtNumFull(d.over52weeks)} waiting 52+ weeks</div>`, event);
  });
}

function updateLongWaitChart(step) {
  const svg = d3.select("#chart-longwait svg");
  if (step === 0) {
    svg.select(".peak-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".peak-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 4: MEDIAN WAIT
   ========================================================= */
function buildMedianChart() {
  const container = document.getElementById("chart-median");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Line chart showing median NHS wait in weeks, doubling from around 6 weeks to over 14 weeks");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const rtt = DATA.rtt;
  const latest = rtt[rtt.length - 1];
  const peak = rtt.reduce((a, b) => a.medianWait > b.medianWait ? a : b);
  const earliest = rtt[0];

  const x = d3.scaleTime()
    .domain([parseDate(rtt[0].period), parseDate(rtt[rtt.length - 1].period)])
    .range([0, dim.innerW]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(rtt, d => d.medianWait) * 1.15])
    .range([dim.innerH, 0]);

  // --- Step 0: The trend ---
  const trendGroup = g.append("g").attr("class", "trend-view");

  // Grid
  trendGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Area
  const area = d3.area()
    .x(d => x(parseDate(d.period)))
    .y0(dim.innerH)
    .y1(d => y(d.medianWait))
    .curve(d3.curveMonotoneX);

  trendGroup.append("path").datum(rtt)
    .attr("d", area)
    .attr("fill", C.tealLight);

  // Line
  const line = d3.line()
    .x(d => x(parseDate(d.period)))
    .y(d => y(d.medianWait))
    .curve(d3.curveMonotoneX);

  trendGroup.append("path").datum(rtt)
    .attr("d", line)
    .attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // X axis
  trendGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Y axis — include unit on first and last ticks for unambiguous reading
  const yTicks = y.ticks(6);
  trendGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat((d, i) => {
      if (i === 0 || i === yTicks.length - 1) return d + " wks";
      return d;
    }).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Start annotation — offset above with enough padding
  trendGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate(earliest.period)) + 6)
    .attr("y", y(earliest.medianWait) - 12)
    .attr("fill", C.teal).text(d3.format(".1f")(earliest.medianWait) + " wks");

  // --- Step 1: annotated with peak and latest ---
  const annotGroup = g.append("g").attr("class", "annot-view").style("opacity", 0);

  // COVID peak annotation — leader line from dot to label in white space above
  annotGroup.append("circle")
    .attr("cx", x(parseDate(peak.period))).attr("cy", y(peak.medianWait))
    .attr("r", 5).attr("fill", C.red);
  annotGroup.append("line")
    .attr("x1", x(parseDate(peak.period))).attr("x2", x(parseDate(peak.period)) + 10)
    .attr("y1", y(peak.medianWait) - 7).attr("y2", y(peak.medianWait) - 20)
    .attr("stroke", C.red).attr("stroke-width", 1);
  annotGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(peak.period)) + 12).attr("y", y(peak.medianWait) - 24)
    .attr("fill", C.red).text("Peak: " + d3.format(".1f")(peak.medianWait) + " wks");

  // End label — offset above with leader line
  annotGroup.append("line")
    .attr("x1", x(parseDate(latest.period))).attr("x2", x(parseDate(latest.period)))
    .attr("y1", y(latest.medianWait) - 4).attr("y2", y(latest.medianWait) - 18)
    .attr("stroke", C.teal).attr("stroke-width", 1);
  annotGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(latest.period)) + 6)
    .attr("y", y(latest.medianWait) - 22)
    .attr("fill", C.teal).text(d3.format(".1f")(latest.medianWait) + " wks");

  // COVID marker -- explain the mechanism
  annotGroup.append("line")
    .attr("x1", x(parseDate("2020-03"))).attr("x2", x(parseDate("2020-03")))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  annotGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", 14)
    .attr("fill", C.muted).text("Queues freeze as");
  annotGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", 28)
    .attr("fill", C.muted).text("hospitals pivot to COVID");

  // Reference line at ~6 weeks (early average)
  const earlyAvg = d3.mean(rtt.filter(d => d.period < "2015-01"), d => d.medianWait);
  annotGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(earlyAvg)).attr("y2", y(earlyAvg))
    .attr("stroke", C.teal).attr("stroke-width", 1).attr("stroke-dasharray", "6,4").attr("opacity", 0.5);
  annotGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW + 4).attr("y", y(earlyAvg) + 4)
    .attr("fill", C.teal).text("2012\u201314 avg");

  // Hover
  const hoverGroup = g.append("g").attr("class", "med-hover");
  const hoverDot = hoverGroup.append("circle").attr("class", "hover-dot").attr("r", 4).attr("fill", C.teal).style("opacity", 0);

  addHoverBehavior(hoverGroup, dim, x, rtt, function(d, event, cx) {
    hoverDot.attr("cx", cx).attr("cy", y(d.medianWait)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)}</div>
      <div class="tt-value">${d3.format(".1f")(d.medianWait)} weeks median wait</div>`, event);
  });
}

function updateMedianChart(step) {
  const svg = d3.select("#chart-median svg");
  if (step === 0) {
    svg.select(".annot-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".annot-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 5: A&E PERFORMANCE
   ========================================================= */
function buildAEChart() {
  const container = document.getElementById("chart-ae");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Paired bar chart showing A&E 4-hour performance, both all types and major departments, consistently below the 95% target");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const ae = DATA.ae;
  const latest = ae[ae.length - 1];

  // We have limited A&E data points, so also show the RTT pctWithin18 for context
  // Build a bar chart for A&E quarterly data
  const barWidth = Math.min(80, dim.innerW / (ae.length * 2));
  const x = d3.scaleBand()
    .domain(ae.map(d => d.period))
    .range([0, dim.innerW])
    .padding(0.35);
  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([dim.innerH, 0]);

  // --- Step 0: The bars ---
  const barGroup = g.append("g").attr("class", "ae-bars");

  // Grid
  barGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // 95% target line
  barGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", y(95)).attr("y2", y(95))
    .attr("stroke", C.red).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
  barGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", dim.innerW + 4).attr("y", y(95) + 4)
    .attr("fill", C.red).text("95% target");

  // All-type bars
  barGroup.selectAll(".ae-bar-all").data(ae).enter()
    .append("rect").attr("class", "ae-bar-all")
    .attr("x", d => x(d.period))
    .attr("y", d => y(d.pctWithin4Hours))
    .attr("width", x.bandwidth() / 2 - 2)
    .attr("height", d => dim.innerH - y(d.pctWithin4Hours))
    .attr("fill", C.teal).attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)}</div>
        <div class="tt-value" style="color:${C.teal}">All types: ${sobFmtPct(d.pctWithin4Hours)}</div>
        <div class="tt-value" style="color:${C.red}">Type 1 (major): ${sobFmtPct(d.pctWithin4HoursType1)}</div>
        <div class="tt-value">${fmtNumFull(d.totalAttendances)} attendances</div>`, event);
    })
    .on("mouseleave", hideTooltip);

  // Type 1 bars
  barGroup.selectAll(".ae-bar-t1").data(ae).enter()
    .append("rect").attr("class", "ae-bar-t1")
    .attr("x", d => x(d.period) + x.bandwidth() / 2 + 2)
    .attr("y", d => y(d.pctWithin4HoursType1))
    .attr("width", x.bandwidth() / 2 - 2)
    .attr("height", d => dim.innerH - y(d.pctWithin4HoursType1))
    .attr("fill", C.red).attr("rx", 2)
    .on("mousemove", function(event, d) {
      sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)} &mdash; Type 1 (Major A&amp;E)</div>
        <div class="tt-value" style="color:${C.red}">${sobFmtPct(d.pctWithin4HoursType1)} within 4 hours</div>
        <div class="tt-value">${fmtNumFull(d.over4Hours)} waited over 4 hours</div>`, event);
    })
    .on("mouseleave", hideTooltip);

  // Bar value labels - All types (10px padding from bar top; include % for unambiguous reading)
  barGroup.selectAll(".ae-val-all").data(ae).enter()
    .append("text").attr("class", "chart-annotation-bold ae-val-all")
    .attr("x", d => x(d.period) + x.bandwidth() / 4 - 1)
    .attr("y", d => y(d.pctWithin4Hours) - 10)
    .attr("text-anchor", "middle")
    .attr("fill", C.teal).attr("font-size", "12px")
    .text(d => d3.format(".0f")(d.pctWithin4Hours) + "%");

  // Bar value labels - Type 1 (10px padding from bar top; include % for unambiguous reading)
  barGroup.selectAll(".ae-val-t1").data(ae).enter()
    .append("text").attr("class", "chart-annotation-bold ae-val-t1")
    .attr("x", d => x(d.period) + x.bandwidth() * 3 / 4 + 1)
    .attr("y", d => y(d.pctWithin4HoursType1) - 10)
    .attr("text-anchor", "middle")
    .attr("fill", C.red).attr("font-size", "12px")
    .text(d => d3.format(".0f")(d.pctWithin4HoursType1) + "%");

  // X axis — use abbreviated format to prevent tick label overlap
  barGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      const dt = parseDate(d);
      return d3.timeFormat("%b '%y")(dt);
    }).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").style("text-anchor", "middle");

  // Y axis — percent sign in ticks is sufficient; no separate title needed
  barGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());

  // Legend
  const legend = barGroup.append("g").attr("transform", `translate(${dim.innerW - 200}, ${dim.innerH - 60})`);
  legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 14).attr("height", 14).attr("fill", C.teal).attr("rx", 2);
  legend.append("text").attr("class", "chart-annotation").attr("x", 20).attr("y", 11).text("All A&E types");
  legend.append("rect").attr("x", 0).attr("y", 22).attr("width", 14).attr("height", 14).attr("fill", C.red).attr("rx", 2);
  legend.append("text").attr("class", "chart-annotation").attr("x", 20).attr("y", 33).text("Type 1 (major)");

  // --- Step 1: Highlight the gap ---
  const gapGroup = g.append("g").attr("class", "ae-gap-view").style("opacity", 0);

  // Gap annotation between target and actual
  const lastBar = ae[ae.length - 1];
  const gapX = x(lastBar.period) + x.bandwidth() + 12;
  const gapY1 = y(95);
  const gapY2 = y(lastBar.pctWithin4Hours);
  gapGroup.append("line").attr("x1", gapX).attr("x2", gapX)
    .attr("y1", gapY1).attr("y2", gapY2)
    .attr("stroke", C.red).attr("stroke-width", 2);
  gapGroup.append("line").attr("x1", gapX - 5).attr("x2", gapX + 5)
    .attr("y1", gapY1).attr("y2", gapY1)
    .attr("stroke", C.red).attr("stroke-width", 2);
  gapGroup.append("line").attr("x1", gapX - 5).attr("x2", gapX + 5)
    .attr("y1", gapY2).attr("y2", gapY2)
    .attr("stroke", C.red).attr("stroke-width", 2);
  gapGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", gapX + 10).attr("y", (gapY1 + gapY2) / 2 + 5)
    .attr("fill", C.red).text(d3.format(".1f")(95 - lastBar.pctWithin4Hours) + "pp gap");

  // Winter crisis annotation — placed in top white space with leader line to avoid bar overlap
  const winterQ = ae.find(d => d.period.endsWith("-01"));
  if (winterQ) {
    const winterBarX = x(winterQ.period) + x.bandwidth() / 2;
    const winterBarTopY = y(winterQ.pctWithin4HoursType1);
    gapGroup.append("line")
      .attr("x1", winterBarX).attr("x2", winterBarX)
      .attr("y1", winterBarTopY - 14).attr("y2", 28)
      .attr("stroke", C.red).attr("stroke-width", 1).attr("stroke-dasharray", "2,2");
    gapGroup.append("text").attr("class", "chart-annotation")
      .attr("x", winterBarX).attr("y", 20)
      .attr("text-anchor", "middle").attr("fill", C.red)
      .text("Flu + cold surge beds");
  }
}

function updateAEChart(step) {
  const svg = d3.select("#chart-ae svg");
  if (step === 0) {
    svg.select(".ae-gap-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".ae-gap-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   CHART 6: OUTLOOK — Summary dashboard
   ========================================================= */
function buildOutlookChart() {
  const container = document.getElementById("chart-outlook");
  const dim = sobChartDims(container);
  const svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", `0 0 ${dim.width} ${dim.height}`)
    .attr("role", "img").attr("aria-label", "Summary chart overlaying 18-week performance and total waiting list, followed by a scorecard of all key NHS metrics");
  const g = svg.append("g").attr("transform", `translate(${dim.margin.left},${dim.margin.top})`);

  const rtt = DATA.rtt;
  const latest = rtt[rtt.length - 1];

  // --- Step 0: Multi-line overview showing all RTT metrics normalized ---
  const overviewGroup = g.append("g").attr("class", "overview-view");

  const x = d3.scaleTime()
    .domain([parseDate(rtt[0].period), parseDate(rtt[rtt.length - 1].period)])
    .range([0, dim.innerW]);

  // Dual axis: left for %, right for count
  const yPct = d3.scaleLinear().domain([40, 100]).range([dim.innerH, 0]);
  const yCount = d3.scaleLinear().domain([0, d3.max(rtt, d => d.totalWaiting) * 1.1]).range([dim.innerH, 0]);

  // Grid
  overviewGroup.append("g").attr("class", "grid")
    .call(d3.axisLeft(yPct).ticks(6).tickSize(-dim.innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // 92% target reference
  overviewGroup.append("line")
    .attr("x1", 0).attr("x2", dim.innerW)
    .attr("y1", yPct(92)).attr("y2", yPct(92))
    .attr("stroke", C.faint).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  overviewGroup.append("text").attr("class", "chart-annotation")
    .attr("x", 4).attr("y", yPct(92) - 6)
    .attr("fill", C.faint).text("92% RTT target");

  // Waiting list as area (on right axis)
  const waitArea = d3.area()
    .x(d => x(parseDate(d.period)))
    .y0(dim.innerH)
    .y1(d => yCount(d.totalWaiting))
    .curve(d3.curveMonotoneX);

  overviewGroup.append("path").datum(rtt)
    .attr("d", waitArea)
    .attr("fill", "rgba(14,116,144,0.06)");

  // pctWithin18 line
  const pctLine = d3.line()
    .x(d => x(parseDate(d.period)))
    .y(d => yPct(d.pctWithin18))
    .curve(d3.curveMonotoneX);

  overviewGroup.append("path").datum(rtt)
    .attr("d", pctLine)
    .attr("fill", "none").attr("stroke", C.teal).attr("stroke-width", 2.5);

  // Total waiting line (right axis)
  const waitLine = d3.line()
    .x(d => x(parseDate(d.period)))
    .y(d => yCount(d.totalWaiting))
    .curve(d3.curveMonotoneX);

  overviewGroup.append("path").datum(rtt)
    .attr("d", waitLine)
    .attr("fill", "none").attr("stroke", C.amber).attr("stroke-width", 2).attr("stroke-dasharray", "6,3");

  // X axis
  overviewGroup.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${dim.innerH})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(g => g.select(".domain").remove());

  // Left Y axis (%) -- labelled for clarity
  overviewGroup.append("g").attr("class", "axis y-axis")
    .call(d3.axisLeft(yPct).ticks(6).tickFormat(d => d + "%").tickSize(0))
    .call(g => g.select(".domain").remove());
  overviewGroup.append("text").attr("class", "chart-annotation")
    .attr("x", -dim.margin.left + 4).attr("y", -12)
    .attr("fill", C.teal).attr("font-weight", 600)
    .text("% within 18 wks");

  // Right Y axis (count) -- labelled and colour-coded to match line
  overviewGroup.append("g").attr("class", "axis y-axis-right")
    .attr("transform", `translate(${dim.innerW},0)`)
    .call(d3.axisRight(yCount).ticks(5).tickFormat(d => fmtNum(d)).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", C.amber);
  overviewGroup.append("text").attr("class", "chart-annotation")
    .attr("x", dim.innerW + dim.margin.right - 4).attr("y", -12)
    .attr("text-anchor", "end").attr("fill", C.amber).attr("font-weight", 600)
    .text("Total waiting");

  // End labels — offset with leader lines to keep clear of data
  overviewGroup.append("line")
    .attr("x1", x(parseDate(latest.period))).attr("x2", x(parseDate(latest.period)))
    .attr("y1", yPct(latest.pctWithin18) - 4).attr("y2", yPct(latest.pctWithin18) - 18)
    .attr("stroke", C.teal).attr("stroke-width", 1);
  overviewGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(latest.period)) + 6)
    .attr("y", yPct(latest.pctWithin18) - 22)
    .attr("fill", C.teal).text(sobFmtPct(latest.pctWithin18) + " in 18wks");

  overviewGroup.append("line")
    .attr("x1", x(parseDate(latest.period))).attr("x2", x(parseDate(latest.period)))
    .attr("y1", yCount(latest.totalWaiting) + 4).attr("y2", yCount(latest.totalWaiting) + 18)
    .attr("stroke", C.amber).attr("stroke-width", 1);
  overviewGroup.append("text").attr("class", "chart-annotation-bold")
    .attr("x", x(parseDate(latest.period)) + 6)
    .attr("y", yCount(latest.totalWaiting) + 30)
    .attr("fill", C.amber).text(fmtNum(latest.totalWaiting) + " waiting");

  // COVID marker
  overviewGroup.append("line")
    .attr("x1", x(parseDate("2020-03"))).attr("x2", x(parseDate("2020-03")))
    .attr("y1", 0).attr("y2", dim.innerH)
    .attr("stroke", C.muted).attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
  overviewGroup.append("text").attr("class", "chart-annotation")
    .attr("x", x(parseDate("2020-03")) + 6).attr("y", 14)
    .attr("fill", C.muted).text("Mar 2020");

  // Hover
  const hoverDotPct = overviewGroup.append("circle").attr("class", "hover-dot").attr("r", 4).attr("fill", C.teal).style("opacity", 0);
  const hoverDotWait = overviewGroup.append("circle").attr("class", "hover-dot").attr("r", 4).attr("fill", C.amber).style("opacity", 0);

  addHoverBehavior(overviewGroup, dim, x, rtt, function(d, event, cx) {
    hoverDotPct.attr("cx", cx).attr("cy", yPct(d.pctWithin18)).style("opacity", 1);
    hoverDotWait.attr("cx", cx).attr("cy", yCount(d.totalWaiting)).style("opacity", 1);
    sobShowTooltip(`<div class="tt-label">${formatPeriod(d.period)}</div>
      <div class="tt-value" style="color:${C.teal};font-weight:600">${sobFmtPct(d.pctWithin18)} within 18 weeks</div>
      <div class="tt-value" style="color:${C.amber};font-weight:600">${fmtNumFull(d.totalWaiting)} on waiting list</div>
      <hr style="border:none;border-top:1px solid #E0E0DB;margin:4px 0">
      <div class="tt-value" style="font-size:12px;color:${C.muted}">Median wait: ${d3.format(".1f")(d.medianWait)} wks</div>
      <div class="tt-value" style="font-size:12px;color:${C.muted}">Over 52 wks: ${fmtNumFull(d.over52weeks)}</div>`, event);
  });

  // --- Step 1: Scorecard view ---
  const scoreGroup = g.append("g").attr("class", "score-view").style("opacity", 0);

  const metrics = [
    { label: "Waiting list", value: fmtNum(latest.totalWaiting), sub: "Total patients waiting", color: C.teal, target: null, status: "high" },
    { label: "18-week standard", value: sobFmtPct(latest.pctWithin18), sub: "Target: 92%", color: C.red, target: 92, status: "fail" },
    { label: "Median wait", value: d3.format(".1f")(latest.medianWait) + " wks", sub: "Was ~6 weeks in 2012", color: C.teal, target: null, status: "worse" },
    { label: "52+ week waiters", value: fmtNum(latest.over52weeks), sub: "Was near zero pre-COVID", color: C.red, target: 0, status: "fail" },
    { label: "A&E 4-hour target", value: sobFmtPct(DATA.summary.aePctWithin4Hours), sub: "Target: 95%", color: C.red, target: 95, status: "fail" },
    { label: "A&E Type 1", value: sobFmtPct(DATA.ae[DATA.ae.length - 1].pctWithin4HoursType1), sub: "Major departments only", color: C.red, target: 95, status: "fail" }
  ];

  const cardH = dim.innerH / metrics.length - 8;
  const cardPad = 8;

  metrics.forEach((m, i) => {
    const yPos = i * (cardH + cardPad);
    const cardG = scoreGroup.append("g").attr("transform", `translate(0,${yPos})`);

    // Background card
    cardG.append("rect")
      .attr("x", 0).attr("y", 0)
      .attr("width", dim.innerW).attr("height", cardH)
      .attr("fill", m.status === "fail" ? "rgba(197,48,48,0.04)" : "rgba(14,116,144,0.04)")
      .attr("rx", 6).attr("stroke", m.status === "fail" ? "rgba(197,48,48,0.15)" : "rgba(14,116,144,0.15)")
      .attr("stroke-width", 1);

    // Status indicator
    cardG.append("circle")
      .attr("cx", 20).attr("cy", cardH / 2)
      .attr("r", 6)
      .attr("fill", m.color);

    // Label
    cardG.append("text")
      .attr("x", 38).attr("y", cardH / 2 - 6)
      .attr("font-family", "Inter, sans-serif").attr("font-size", "14px")
      .attr("font-weight", 600).attr("fill", C.ink)
      .text(m.label);

    // Sub label
    cardG.append("text")
      .attr("x", 38).attr("y", cardH / 2 + 12)
      .attr("font-family", "Inter, sans-serif").attr("font-size", "13px")
      .attr("fill", C.muted)
      .text(m.sub);

    // Value (right-aligned)
    cardG.append("text")
      .attr("x", dim.innerW - 16).attr("y", cardH / 2 + 6)
      .attr("text-anchor", "end")
      .attr("font-family", "Source Serif 4, serif").attr("font-size", "24px")
      .attr("font-weight", 700).attr("fill", m.color)
      .text(m.value);
  });

  // Period label
  scoreGroup.append("text")
    .attr("x", dim.innerW / 2).attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("font-family", "Inter, sans-serif").attr("font-size", "14px")
    .attr("fill", C.muted)
    .text("Latest data: RTT " + formatPeriod(DATA.summary.rttPeriod) + " | A&E " + formatPeriod(DATA.summary.aePeriod));
}

function updateOutlookChart(step) {
  const svg = d3.select("#chart-outlook svg");
  if (step === 0) {
    svg.select(".overview-view").transition().duration(DURATION).style("opacity", 1);
    svg.select(".score-view").transition().duration(DURATION).style("opacity", 0);
  } else {
    svg.select(".overview-view").transition().duration(DURATION).style("opacity", 0);
    svg.select(".score-view").transition().duration(DURATION).style("opacity", 1);
  }
}

/* =========================================================
   UPDATE DISPATCHER
   ========================================================= */
function updateChart(section, step) {
  switch (section) {
    case "hook": updateHookChart(step); break;
    case "18week": update18WeekChart(step); break;
    case "longwait": updateLongWaitChart(step); break;
    case "median": updateMedianChart(step); break;
    case "ae": updateAEChart(step); break;
    case "outlook": updateOutlookChart(step); break;
  }
}

/* =========================================================
   SCROLLYTELLING — IntersectionObserver
   ========================================================= */
function setupScrollObserver() { sobSetupScrollObserver("hook"); }

})();
