import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { z } from "zod";

export const runtime = "nodejs";

const input = z.object({
  action: z.enum(["stat", "read", "readRows", "write"]),
  path: z.string().trim().min(1, "缺少同步文件路径"),
  contentBase64: z.string().optional(),
});

function isAbsoluteFilePath(filePath: string) {
  return path.isAbsolute(filePath) || path.win32.isAbsolute(filePath);
}

function cellToText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  if ("result" in value) return cellToText(value.result as ExcelJS.CellValue);
  return String(value);
}

async function fileStat(filePath: string) {
  const info = await stat(filePath);
  return { exists: true, mtimeMs: info.mtimeMs, size: info.size };
}

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "同步信息不完整", details: parsed.error.flatten() }, { status: 400 });
  }

  const filePath = parsed.data.path;
  if (!isAbsoluteFilePath(filePath)) {
    return Response.json({ error: "同步文件必须是绝对路径" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "stat") {
      return Response.json({ ok: true, ...(await fileStat(filePath)) });
    }

    if (parsed.data.action === "write") {
      if (!parsed.data.contentBase64) return Response.json({ error: "写入内容为空" }, { status: 400 });
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from(parsed.data.contentBase64, "base64"));
      return Response.json({ ok: true, path: filePath, ...(await fileStat(filePath)) });
    }

    await readFile(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet("达人资源库") || workbook.worksheets[0];
    if (!sheet) return Response.json({ ok: true, rows: [], ...(await fileStat(filePath)) });

    if (parsed.data.action === "readRows") {
      const rawRows: string[][] = [];
      sheet.eachRow((row) => {
        const values: string[] = [];
        const maxColumn = sheet.columnCount || row.cellCount;
        for (let index = 1; index <= maxColumn; index += 1) values.push(cellToText(row.getCell(index).value).trim());
        rawRows.push(values);
      });
      return Response.json({ ok: true, path: filePath, rawRows, ...(await fileStat(filePath)) });
    }

    const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(cellToText);
    const rows: Record<string, string | number>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string | number> = {};
      headers.forEach((header, index) => {
        const cellValue = row.getCell(index + 1).value;
        record[header] = typeof cellValue === "number" ? cellValue : cellToText(cellValue);
      });
      if (Object.values(record).some((value) => String(value).trim())) rows.push(record);
    });

    return Response.json({ ok: true, path: filePath, rows, ...(await fileStat(filePath)) });
  } catch (error) {
    return Response.json(
      {
        error: "同步文件失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}
