"use client";

import ReactECharts from "echarts-for-react";

type ChartTheme = {
  colors: string[];
  text: string;
  muted: string;
  tertiary: string;
  grid: string;
  surface: string;
  border: string;
  tooltipShadow: string;
  isDark: boolean;
};

const lightChartTheme: ChartTheme = {
  colors: ["#161816", "#B8FF3D", "#B8BDC5", "#5D82D9", "#EC6A6A"],
  text: "#111311",
  muted: "#6F747C",
  tertiary: "#9DA3AC",
  grid: "#ECEEF1",
  surface: "#FFFFFF",
  border: "#E5E8EC",
  tooltipShadow: "border-radius:10px;box-shadow:0 1px 2px rgba(17,24,39,.03),0 8px 24px rgba(17,24,39,.08);",
  isDark: false,
};

function readChartTheme(): ChartTheme {
  if (typeof document === "undefined") return lightChartTheme;
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const isDark = document.documentElement.dataset.theme === "dark";
  return {
    colors: [token("--chart-black", "#161816"), token("--accent", "#B8FF3D"), token("--chart-gray", "#B8BDC5"), isDark ? "#8EAEFF" : "#5D82D9", isDark ? "#FF9696" : "#EC6A6A"],
    text: token("--text-primary", "#111311"),
    muted: token("--text-secondary", "#6F747C"),
    tertiary: token("--text-tertiary", "#9DA3AC"),
    grid: token("--chart-grid", "#ECEEF1"),
    surface: token("--surface", "#FFFFFF"),
    border: token("--border-default", "#E5E8EC"),
    tooltipShadow: isDark
      ? "border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.24),0 10px 30px rgba(0,0,0,.3);"
      : lightChartTheme.tooltipShadow,
    isDark,
  };
}

export function PieChart({ data, height = 260, onItemClick }: { data: { name: string; value: number }[]; height?: number; onItemClick?: (name: string) => void }) {
  const theme = readChartTheme();
  return (
    <ReactECharts
      notMerge
      style={{ height, cursor: onItemClick ? "pointer" : "default" }}
      onEvents={onItemClick ? {
        click: (params: { name?: string }) => params.name && onItemClick(params.name),
        legendselectchanged: (params: { name?: string }) => params.name && onItemClick(params.name),
      } : undefined}
      option={{
        aria: { enabled: true, decal: { show: true } },
        color: theme.colors,
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          padding: [10, 12],
          textStyle: { color: theme.text, fontSize: 12 },
          extraCssText: theme.tooltipShadow,
        },
        legend: {
          top: 0,
          type: "scroll",
          icon: "roundRect",
          itemWidth: 16,
          itemHeight: 6,
          textStyle: { color: theme.muted, fontSize: 11 },
        },
        series: [{
          type: "pie",
          radius: ["44%", "68%"],
          center: ["50%", "58%"],
          itemStyle: { borderColor: theme.surface, borderWidth: 4, borderRadius: 5 },
          label: { color: theme.muted, formatter: "{b}\n{c} ({d}%)", fontSize: 11 },
          labelLine: { lineStyle: { color: theme.grid } },
          data,
        }],
      }}
    />
  );
}

export function BarChart({ data, height = 360 }: { data: { name: string; value: number }[]; height?: number }) {
  const theme = readChartTheme();
  return (
    <ReactECharts
      notMerge
      style={{ height }}
      option={{
        aria: { enabled: true, decal: { show: true } },
        color: theme.colors,
        backgroundColor: "transparent",
        grid: { left: 112, right: 30, top: 18, bottom: 26 },
        tooltip: {
          trigger: "axis",
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          padding: [10, 12],
          textStyle: { color: theme.text, fontSize: 12 },
          extraCssText: theme.tooltipShadow,
          axisPointer: { type: "shadow", shadowStyle: { color: theme.isDark ? "rgba(255,255,255,.06)" : "rgba(17,19,17,.035)" } },
        },
        xAxis: {
          type: "value",
          axisLabel: { color: theme.tertiary, fontSize: 11 },
          axisLine: { lineStyle: { color: theme.grid } },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: theme.grid } },
        },
        yAxis: {
          type: "category",
          data: data.map((item) => item.name),
          axisLabel: { width: 94, overflow: "truncate", color: theme.muted, fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [{
          type: "bar",
          data: data.map((item) => item.value),
          barWidth: 16,
          label: { show: true, position: "right", color: theme.muted, fontSize: 11 },
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: (params: { dataIndex: number }) => params.dataIndex === 0 ? theme.colors[1] : params.dataIndex === 1 ? theme.colors[0] : theme.colors[2],
          },
        }],
      }}
    />
  );
}
