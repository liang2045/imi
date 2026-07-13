"use client";

import ReactECharts from "echarts-for-react";

const colors = ["#161816", "#B8FF3D", "#B8BDC5", "#5D82D9", "#EC6A6A"];
const chartText = "#111311";
const chartMuted = "#6F747C";
const chartTertiary = "#9DA3AC";
const chartGrid = "#ECEEF1";
const tooltipShadow = "border-radius:10px;box-shadow:0 1px 2px rgba(17,24,39,.03),0 8px 24px rgba(17,24,39,.08);";

export function PieChart({ data, height = 260, onItemClick }: { data: { name: string; value: number }[]; height?: number; onItemClick?: (name: string) => void }) {
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
        color: colors,
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#FFFFFF",
          borderColor: "#E5E8EC",
          borderWidth: 1,
          padding: [10, 12],
          textStyle: { color: chartText, fontSize: 12 },
          extraCssText: tooltipShadow,
        },
        legend: {
          top: 0,
          type: "scroll",
          icon: "roundRect",
          itemWidth: 16,
          itemHeight: 6,
          textStyle: { color: chartMuted, fontSize: 11 },
        },
        series: [{
          type: "pie",
          radius: ["44%", "68%"],
          center: ["50%", "58%"],
          itemStyle: { borderColor: "#FFFFFF", borderWidth: 4, borderRadius: 5 },
          label: { color: chartMuted, formatter: "{b}\n{c} ({d}%)", fontSize: 11 },
          labelLine: { lineStyle: { color: chartGrid } },
          data,
        }],
      }}
    />
  );
}

export function BarChart({ data, height = 360 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <ReactECharts
      notMerge
      style={{ height }}
      option={{
        aria: { enabled: true, decal: { show: true } },
        color: colors,
        backgroundColor: "transparent",
        grid: { left: 112, right: 30, top: 18, bottom: 26 },
        tooltip: {
          trigger: "axis",
          backgroundColor: "#FFFFFF",
          borderColor: "#E5E8EC",
          borderWidth: 1,
          padding: [10, 12],
          textStyle: { color: chartText, fontSize: 12 },
          extraCssText: tooltipShadow,
          axisPointer: { type: "shadow", shadowStyle: { color: "rgba(17,19,17,.035)" } },
        },
        xAxis: {
          type: "value",
          axisLabel: { color: chartTertiary, fontSize: 11 },
          axisLine: { lineStyle: { color: chartGrid } },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: chartGrid } },
        },
        yAxis: {
          type: "category",
          data: data.map((item) => item.name),
          axisLabel: { width: 94, overflow: "truncate", color: chartMuted, fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [{
          type: "bar",
          data: data.map((item) => item.value),
          barWidth: 16,
          label: { show: true, position: "right", color: chartMuted, fontSize: 11 },
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: (params: { dataIndex: number }) => params.dataIndex === 0 ? colors[1] : params.dataIndex === 1 ? colors[0] : colors[2],
          },
        }],
      }}
    />
  );
}
