import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "imi达人管理",
  description: "imi达人资源、合作、寄样、结算与数据分析的一体化工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
