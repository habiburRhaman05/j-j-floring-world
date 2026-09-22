"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { chartPalette } from "@/lib/charts/theme";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export interface ChartRow {
  label: string;
  count: number;
  tone?: "won" | "lost";
}

interface BarChartProps {
  rows: ChartRow[];
  /** Word used in the tooltip, e.g. "leads" or "jobs". */
  unit?: string;
  className?: string;
}

/**
 * A horizontal bar chart used for the sales funnel and the job pipeline. It
 * replaces the hand-built percentage bars: the shape of the report is the
 * same, but the visual is a real chart with tooltips and axes.
 */
export function BarChart({ rows, unit = "records", className }: BarChartProps) {
  const palette = useMemo(() => chartPalette(), []);

  const data = useMemo<ChartData<"bar">>(
    () => ({
      labels: rows.map((r) => r.label),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: rows.map((r) =>
            r.tone === "won" ? palette.moss : r.tone === "lost" ? palette.clay : palette.blue,
          ),
          hoverBackgroundColor: rows.map((r) =>
            r.tone === "won" ? palette.moss : r.tone === "lost" ? palette.clay : palette.blueDeep,
          ),
          borderRadius: 4,
          barThickness: 16,
        },
      ],
    }),
    [rows, palette],
  );

  const options = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: palette.blueDeep,
          padding: 9,
          cornerRadius: 7,
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed.x;
              return `${value} ${value === 1 ? unit.replace(/s$/, "") : unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: palette.ink3, font: { size: 11 } },
          grid: { color: palette.rule },
          border: { display: false },
        },
        y: {
          ticks: { color: palette.ink3, font: { size: 12 } },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
    [palette, unit],
  );

  return (
    <div className={cn("chart-box", className)}>
      <Bar data={data} options={options} />
    </div>
  );
}
