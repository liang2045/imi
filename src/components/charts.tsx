"use client";

import ReactECharts from "echarts-for-react";

const colors = ["#7C6CEF", "#A38CF5", "#F29A57", "#37D6A5", "#D8CDFB", "#FBE0BE", "#B2B8C2"];
const chartText = "#26272D";
const chartMuted = "#757A84";
const chartGrid = "rgba(33,36,44,.055)";

export function PieChart({ data, height = 260, onItemClick }: { data: { name: string; value: number }[]; height?: number; onItemClick?: (name: string) => void }) {
  return <ReactECharts notMerge style={{ height, cursor: onItemClick ? "pointer" : "default" }} onEvents={onItemClick ? { click: (params: { name?: string }) => params.name && onItemClick(params.name) } : undefined} option={{ color: colors, backgroundColor: "transparent", tooltip: { trigger: "item", backgroundColor: "#FCFCFE", borderColor: "rgba(255,255,255,.88)", borderWidth: 1, padding: [10, 12], textStyle: { color: chartText, fontSize: 12 }, extraCssText: "border-radius:16px;box-shadow:8px 8px 18px rgba(196,201,210,.16),-8px -8px 18px rgba(255,255,255,.95);" }, legend: { top: 0, type: "scroll", icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: chartMuted, fontSize: 11 } }, series: [{ type: "pie", radius: ["34%", "62%"], center: ["50%", "58%"], itemStyle: { borderColor: "#FCFCFE", borderWidth: 2, borderRadius: 4 }, label: { color: chartMuted, formatter: "{b}\n{c} ({d}%)", fontSize: 11 }, labelLine: { lineStyle: { color: "rgba(33,36,44,.18)" } }, data }] }} />;
}

export function BarChart({ data, height = 360 }: { data: { name: string; value: number }[]; height?: number }) {
  return <ReactECharts notMerge style={{ height }} option={{ color: colors, backgroundColor: "transparent", grid: { left: 112, right: 26, top: 18, bottom: 26 }, tooltip: { trigger: "axis", backgroundColor: "#FCFCFE", borderColor: "rgba(255,255,255,.88)", borderWidth: 1, padding: [10, 12], textStyle: { color: chartText, fontSize: 12 }, extraCssText: "border-radius:16px;box-shadow:8px 8px 18px rgba(196,201,210,.16),-8px -8px 18px rgba(255,255,255,.95);" }, xAxis: { type: "value", axisLabel: { color: "#A3A8B2", fontSize: 11 }, axisLine: { lineStyle: { color: chartGrid } }, axisTick: { show: false }, splitLine: { lineStyle: { color: chartGrid } } }, yAxis: { type: "category", data: data.map((d) => d.name), axisLabel: { width: 94, overflow: "truncate", color: "#A3A8B2", fontSize: 11 }, axisLine: { lineStyle: { color: chartGrid } }, axisTick: { show: false } }, series: [{ type: "bar", data: data.map((d) => d.value), barWidth: 18, label: { show: true, position: "right", color: chartMuted }, itemStyle: { borderRadius: [0, 8, 8, 0], color: (params: { dataIndex: number }) => colors[params.dataIndex % colors.length] } }] }} />;
}
