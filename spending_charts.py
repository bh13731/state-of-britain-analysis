"""
State of Britain — Public Spending Visualisations

Fetches spending.json from the State of Britain API and produces a set of
publication-quality charts saved as PNG files in the charts/ directory.

Usage:
    python spending_charts.py

Dependencies:
    matplotlib, pandas, numpy, requests (see requirements.txt)
"""

from __future__ import annotations

import json
from typing import Any

import requests
import matplotlib.pyplot as plt
import matplotlib.figure as mfigure
import matplotlib.ticker as mticker
import matplotlib.patheffects as pe
import numpy as np
import os

# ── Fetch data ───────────────────────────────────────────────────────────────

DATA_URL = "https://stateofbritain.uk/api/data/spending.json"
CACHE_PATH = "data/spending.json"

os.makedirs("data", exist_ok=True)
if os.path.exists(CACHE_PATH):
    with open(CACHE_PATH) as f:
        data = json.load(f)
else:
    resp = requests.get(DATA_URL, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    with open(CACHE_PATH, "w") as f:
        json.dump(data, f)

os.makedirs("charts", exist_ok=True)

# ── Style ────────────────────────────────────────────────────────────────────

plt.rcParams.update({
    "figure.facecolor": "#0D1117",
    "axes.facecolor": "#0D1117",
    "axes.edgecolor": "#30363D",
    "axes.labelcolor": "#C9D1D9",
    "text.color": "#C9D1D9",
    "xtick.color": "#8B949E",
    "ytick.color": "#8B949E",
    "grid.color": "#21262D",
    "grid.linestyle": "--",
    "grid.alpha": 0.6,
    "font.family": "sans-serif",
    "font.size": 11,
    "figure.dpi": 150,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.3,
    "savefig.facecolor": "#0D1117",
})

# Colour palette — warm accent colours on dark background
BLUE = "#58A6FF"
GREEN = "#3FB950"
RED = "#F85149"
ORANGE = "#D29922"
PURPLE = "#BC8CFF"
CYAN = "#39D2C0"
PINK = "#F778BA"
GREY = "#8B949E"

ACCENT_COLOURS = [BLUE, GREEN, RED, ORANGE, PURPLE, CYAN, PINK,
                  "#79C0FF", "#56D364", "#FFA657", "#D2A8FF", "#A5D6FF",
                  "#7EE787", "#FFBF69", "#FF7B72"]


def save(fig: mfigure.Figure, name: str) -> None:
    """Save a matplotlib figure to the charts/ directory and close it.

    Args:
        fig: The matplotlib figure to save.
        name: Filename (without extension) for the output PNG.
    """
    fig.savefig(f"charts/{name}.png")
    plt.close(fig)
    print(f"  ✓ charts/{name}.png")


# ── Helper: extract time series ──────────────────────────────────────────────

agg = data["aggregates"]
pct = data["pctGDP"]
years = [d["year"] for d in agg]
fys = [d["fy"] for d in agg]

# ═════════════════════════════════════════════════════════════════════════════
# CHART 1 — Receipts vs Expenditure (£bn, nominal)
# ═════════════════════════════════════════════════════════════════════════════
print("Creating charts...")

fig, ax = plt.subplots(figsize=(14, 6))

receipts = [d["receipts"] for d in agg]
tme = [d["tme"] for d in agg]
forecast_mask = [d.get("forecast", False) for d in agg]
first_forecast = next((i for i, f in enumerate(forecast_mask) if f), len(years))

ax.plot(years[:first_forecast], receipts[:first_forecast], color=GREEN, lw=2.2, label="Receipts")
ax.plot(years[:first_forecast], tme[:first_forecast], color=RED, lw=2.2, label="Expenditure (TME)")
ax.plot(years[first_forecast - 1:], receipts[first_forecast - 1:], color=GREEN, lw=2.2, ls="--", alpha=0.6)
ax.plot(years[first_forecast - 1:], tme[first_forecast - 1:], color=RED, lw=2.2, ls="--", alpha=0.6)

ax.fill_between(years, receipts, tme, where=[t > r for t, r in zip(tme, receipts)],
                color=RED, alpha=0.08, interpolate=True)
ax.fill_between(years, receipts, tme, where=[r >= t for t, r in zip(tme, receipts)],
                color=GREEN, alpha=0.08, interpolate=True)

if first_forecast < len(years):
    ax.axvline(years[first_forecast], color=GREY, ls=":", lw=1, alpha=0.5)
    ax.text(years[first_forecast] + 0.3, max(tme) * 0.95, "Forecast →",
            color=GREY, fontsize=9, va="top")

ax.set_title("UK Public Finances: Receipts vs Expenditure", fontsize=16, fontweight="bold", pad=15)
ax.set_ylabel("£ billion (nominal)")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:,.0f}bn"))
ax.legend(loc="upper left", frameon=False)
ax.grid(True, axis="y")
ax.set_xlim(years[0], years[-1])
save(fig, "01_receipts_vs_expenditure")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 2 — Borrowing & Debt Interest (£bn)
# ═════════════════════════════════════════════════════════════════════════════

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), gridspec_kw={"wspace": 0.35})

borrowing = [d["borrowing"] for d in agg]
debt_int = [d["debtInterest"] for d in agg]

colours_borrow = [RED if b > 0 else GREEN for b in borrowing]
ax1.bar(years, borrowing, color=[RED if b > 0 else GREEN for b in borrowing], width=0.7, alpha=0.85)
ax1.axhline(0, color=GREY, lw=0.8)
ax1.set_title("Annual Borrowing", fontsize=14, fontweight="bold", pad=10)
ax1.set_ylabel("£ billion")
ax1.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:,.0f}bn"))
ax1.grid(True, axis="y")

ax2.fill_between(years, debt_int, color=ORANGE, alpha=0.25)
ax2.plot(years, debt_int, color=ORANGE, lw=2.2)
ax2.set_title("Debt Interest Payments", fontsize=14, fontweight="bold", pad=10)
ax2.set_ylabel("£ billion")
ax2.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:,.0f}bn"))
ax2.grid(True, axis="y")

fig.suptitle("Borrowing & Debt Servicing Costs", fontsize=16, fontweight="bold", y=1.02)
save(fig, "02_borrowing_and_debt_interest")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 3 — Key metrics as % of GDP
# ═════════════════════════════════════════════════════════════════════════════

fig, ax = plt.subplots(figsize=(14, 6))

pct_years = [d["year"] for d in pct]
series = [
    ("tme", "Expenditure", RED),
    ("receipts", "Receipts", GREEN),
    ("debt", "Debt", ORANGE),
]

for key, label, colour in series:
    vals = [d[key] for d in pct]
    ax.plot(pct_years, vals, color=colour, lw=2.2, label=label)

ax.set_title("Public Finances as % of GDP", fontsize=16, fontweight="bold", pad=15)
ax.set_ylabel("% of GDP")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))
ax.legend(loc="upper left", frameon=False)
ax.grid(True, axis="y")
ax.set_xlim(pct_years[0], pct_years[-1])
save(fig, "03_pct_gdp")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 4 — Debt / GDP ratio
# ═════════════════════════════════════════════════════════════════════════════

fig, ax = plt.subplots(figsize=(14, 5))

debt_pct = [d["debt"] for d in pct]
ax.fill_between(pct_years, debt_pct, color=ORANGE, alpha=0.15)
ax.plot(pct_years, debt_pct, color=ORANGE, lw=2.5)

# Annotate key moments
peak_idx = int(np.argmax(debt_pct))
ax.annotate(f"{debt_pct[peak_idx]:.1f}%", xy=(pct_years[peak_idx], debt_pct[peak_idx]),
            xytext=(0, 12), textcoords="offset points", fontsize=10,
            color=ORANGE, fontweight="bold", ha="center")

ax.set_title("Public Sector Net Debt as % of GDP", fontsize=16, fontweight="bold", pad=15)
ax.set_ylabel("% of GDP")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))
ax.grid(True, axis="y")
ax.set_xlim(pct_years[0], pct_years[-1])
save(fig, "04_debt_to_gdp")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 5 — Tax Revenue Breakdown (treemap-style horizontal bar)
# ═════════════════════════════════════════════════════════════════════════════

receipt_types = data["receiptTypes"]
receipt_types_sorted = sorted(receipt_types, key=lambda d: d["value"], reverse=True)

fig, ax = plt.subplots(figsize=(12, 7))

names = [d["name"] for d in receipt_types_sorted]
vals = [d["value"] for d in receipt_types_sorted]
total = sum(vals)

bars = ax.barh(range(len(names)), vals, color=ACCENT_COLOURS[:len(names)], height=0.7, alpha=0.9)

for i, (bar, v) in enumerate(zip(bars, vals)):
    pct_val = v / total * 100
    ax.text(v + total * 0.008, i, f"£{v:.1f}bn  ({pct_val:.1f}%)",
            va="center", fontsize=9, color="#C9D1D9")

ax.set_yticks(range(len(names)))
ax.set_yticklabels(names, fontsize=10)
ax.invert_yaxis()
ax.set_xlabel("£ billion")
ax.set_title("Where the Money Comes From: Tax Revenue Breakdown", fontsize=16, fontweight="bold", pad=15)
ax.grid(True, axis="x")
ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:,.0f}bn"))
save(fig, "05_tax_revenue_breakdown")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 6 — Departmental Spending (latest year, horizontal bar)
# ═════════════════════════════════════════════════════════════════════════════

depts = data["departments"]
latest_fy = depts["latestFy"]
items = depts["items"]

# Get latest year value for each department
dept_data = []
for item in items:
    val = item["values"].get(latest_fy, 0)
    if val and val > 0:
        dept_data.append({"name": item["name"], "value": val})

dept_data.sort(key=lambda d: d["value"], reverse=True)

fig, ax = plt.subplots(figsize=(13, 9))

names = [d["name"] for d in dept_data]
vals = [d["value"] / 1000 for d in dept_data]  # Convert to £bn

bars = ax.barh(range(len(names)), vals, color=ACCENT_COLOURS[:len(names)], height=0.72, alpha=0.9)

for i, (bar, v) in enumerate(zip(bars, vals)):
    ax.text(v + max(vals) * 0.01, i, f"£{v:.1f}bn",
            va="center", fontsize=9, color="#C9D1D9")

ax.set_yticks(range(len(names)))
ax.set_yticklabels(names, fontsize=10)
ax.invert_yaxis()
ax.set_xlabel("£ billion")
ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:,.0f}bn"))
ax.set_title(f"Government Departmental Spending ({latest_fy})", fontsize=16, fontweight="bold", pad=15)
ax.grid(True, axis="x")
save(fig, "06_departmental_spending")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 7 — Top 5 Departments over time (stacked area)
# ═════════════════════════════════════════════════════════════════════════════

dept_fys = depts["fys"]

# Find top 5 by latest year
top5 = dept_data[:5]
top5_names = [d["name"] for d in top5]

fig, ax = plt.subplots(figsize=(14, 7))

bottoms = np.zeros(len(dept_fys))
for i, name in enumerate(top5_names):
    item = next(it for it in items if it["name"] == name)
    vals = [item["values"].get(fy, 0) / 1000 for fy in dept_fys]
    ax.bar(dept_fys, vals, bottom=bottoms, color=ACCENT_COLOURS[i], label=name, alpha=0.9)
    # Label in the middle of each top bar segment
    bottoms += np.array(vals)

ax.set_title("Top 5 Departments by Spending (Stacked)", fontsize=16, fontweight="bold", pad=15)
ax.set_ylabel("£ billion")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:,.0f}bn"))
ax.legend(loc="upper left", frameon=False, fontsize=10)
ax.grid(True, axis="y")
save(fig, "07_top5_departments_stacked")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 8 — Departmental Breakdown: Top 3 departments sub-categories (latest year)
# ═════════════════════════════════════════════════════════════════════════════

fig, axes = plt.subplots(1, 3, figsize=(18, 8))

for idx, dept_name in enumerate(top5_names[:3]):
    ax = axes[idx]
    item = next(it for it in items if it["name"] == dept_name)
    breakdown = item.get("breakdown", {})

    # breakdown is {fy: [{name, value}, ...]}
    sub_items = breakdown.get(latest_fy, [])
    sub_items = [s for s in sub_items if s.get("value", 0) > 0]
    sub_items.sort(key=lambda d: d["value"], reverse=True)
    sub_items = sub_items[:10]  # Top 10 sub-categories

    s_names = [s["name"] for s in sub_items]
    s_vals = [s["value"] / 1000 for s in sub_items]

    bars = ax.barh(range(len(s_names)), s_vals,
                   color=ACCENT_COLOURS[idx], height=0.65, alpha=0.85)

    for j, (bar, v) in enumerate(zip(bars, s_vals)):
        ax.text(v + max(s_vals) * 0.02, j, f"£{v:.1f}bn",
                va="center", fontsize=8, color="#C9D1D9")

    ax.set_yticks(range(len(s_names)))
    ax.set_yticklabels(s_names, fontsize=9)
    ax.invert_yaxis()
    ax.set_title(dept_name, fontsize=12, fontweight="bold", pad=8)
    ax.grid(True, axis="x")
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"£{x:.0f}bn"))

fig.suptitle(f"Departmental Spending Breakdown ({latest_fy})",
             fontsize=16, fontweight="bold", y=1.02)
plt.tight_layout()
save(fig, "08_department_breakdowns")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 9 — Spending composition: departments vs other items (donut)
# ═════════════════════════════════════════════════════════════════════════════

# Build donut from department-level data
donut_data = sorted(dept_data, key=lambda d: d["value"], reverse=True)
# Group small departments into "Other"
TOP_N = 8
top_donut = donut_data[:TOP_N]
other_val = sum(d["value"] for d in donut_data[TOP_N:])
donut_entries = top_donut + [{"name": "Other departments", "value": other_val}]
total_dept = sum(d["value"] for d in donut_data)

fig, ax = plt.subplots(figsize=(10, 10))

labels = [d["name"] for d in donut_entries]
sizes = [d["value"] / 1000 for d in donut_entries]
colours = ACCENT_COLOURS[:len(donut_entries)]

wedges, texts, autotexts = ax.pie(
    sizes, labels=None,
    autopct=lambda p: f"£{p * sum(sizes) / 100:.0f}bn\n({p:.1f}%)" if p > 4 else "",
    colors=colours, startangle=90, pctdistance=0.75,
    wedgeprops=dict(width=0.45, edgecolor="#0D1117", linewidth=2),
    textprops=dict(fontsize=9, color="#C9D1D9")
)

for at in autotexts:
    at.set_fontsize(9)
    at.set_color("#C9D1D9")
    at.set_path_effects([pe.withStroke(linewidth=2, foreground="#0D1117")])

ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(0.92, 0.5),
          frameon=False, fontsize=10)

ax.set_title(f"Departmental Spending Share ({latest_fy})\n£{total_dept / 1000:,.0f}bn total",
             fontsize=16, fontweight="bold", pad=20)
save(fig, "09_spending_share_donut")


# ═════════════════════════════════════════════════════════════════════════════
# CHART 10 — Historical overview: deficit as % of GDP with recession shading
# ═════════════════════════════════════════════════════════════════════════════

fig, ax = plt.subplots(figsize=(14, 5.5))

borrow_pct = [d["borrowing"] for d in pct]
pct_years_arr = np.array(pct_years)

ax.fill_between(pct_years, 0, borrow_pct,
                where=[b >= 0 for b in borrow_pct], color=RED, alpha=0.2)
ax.fill_between(pct_years, 0, borrow_pct,
                where=[b < 0 for b in borrow_pct], color=GREEN, alpha=0.2)
ax.plot(pct_years, borrow_pct, color=RED, lw=2)
ax.axhline(0, color=GREY, lw=1)

# Annotate COVID spike
if any(d["year"] == 2020 for d in pct):
    covid = next(d for d in pct if d["year"] == 2020)
    ax.annotate(f"COVID: {covid['borrowing']:.1f}%",
                xy=(2020, covid["borrowing"]),
                xytext=(30, 10), textcoords="offset points",
                fontsize=10, color=RED, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=RED, lw=1.5))

ax.set_title("Budget Deficit as % of GDP", fontsize=16, fontweight="bold", pad=15)
ax.set_ylabel("% of GDP (borrowing)")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))
ax.grid(True, axis="y")
ax.set_xlim(pct_years[0], pct_years[-1])
save(fig, "10_deficit_pct_gdp")


print("\nAll charts saved to charts/")
