"use client";

import ReactECharts from "echarts-for-react";

const colors = ["#6F4EF6", "#20C5E8", "#32C59D", "#F6B84A", "#F0525F"];
const chartText = "#1D2638";
const chartMuted = "#667085";
const chartTertiary = "#98A2B3";
const chartGrid = "rgba(152,162,179,.16)";
const tooltipShadow = "border-radius:14px;box-shadow:0 10px 30px rgba(31,42,68,.08),0 2px 8px rgba(31,42,68,.04);";

export function PieChart({ data, height = 260, onItemClick }: { data: { name: string; value: number }[]; height?: number; onItemClick?: (name: string) => void }) {
  return <ReactECharts notMerge style={{ height, cursor: onItemClick ? "pointer" : "default" }} onEvents={onItemClick ? { click: (params: { name?: string }) => params.name && onItemClick(params.name), legendselectchanged: (params: { name?: string }) => params.name && onItemClick(params.name) } : undefined} option={{ color: colors, backgroundColor: "transparent", tooltip: { trigger: "item", backgroundColor: "#FFFFFF", borderColor: "#E7ECF1", borderWidth: 1, padding: [10, 12], textStyle: { color: chartText, fontSize: 12 }, extraCssText: tooltipShadow }, legend: { top: 0, type: "scroll", icon: "roundRect", itemWidth: 16, itemHeight: 6, textStyle: { color: chartMuted, fontSize: 11 } }, series: [{ type: "pie", radius: ["42%", "66%"], center: ["50%", "58%"], itemStyle: { borderColor: "#FFFFFF", borderWidth: 4, borderRadius: 6 }, label: { color: chartMuted, formatter: "{b}\n{c} ({d}%)", fontSize: 11 }, labelLine: { lineStyle: { color: chartGrid } }, data }] }} />;
}

export function BarChart({ data, height = 360 }: { data: { name: string; value: number }[]; height?: number }) {
  return <ReactECharts notMerge style={{ height }} option={{ color: colors, backgroundColor: "transparent", grid: { left: 112, right: 26, top: 18, bottom: 26 }, tooltip: { trigger: "axis", backgroundColor: "#FFFFFF", borderColor: "#E7ECF1", borderWidth: 1, padding: [10, 12], textStyle: { color: chartText, fontSize: 12 }, extraCssText: tooltipShadow }, xAxis: { type: "value", axisLabel: { color: chartTertiary, fontSize: 11 }, axisLine: { lineStyle: { color: chartGrid } }, axisTick: { show: false }, splitLine: { lineStyle: { color: chartGrid } } }, yAxis: { type: "category", data: data.map((d) => d.name), axisLabel: { width: 94, overflow: "truncate", color: chartTertiary, fontSize: 11 }, axisLine: { lineStyle: { color: chartGrid } }, axisTick: { show: false } }, series: [{ type: "bar", data: data.map((d) => d.value), barWidth: 18, label: { show: true, position: "right", color: chartMuted }, itemStyle: { borderRadius: [0, 9, 9, 0], color: (params: { dataIndex: number }) => colors[params.dataIndex % Math.min(colors.length, 3)] } }] }} />;
}
