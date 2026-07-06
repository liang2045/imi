import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const runtime = "nodejs";

const input = z.object({
  directory: z.string().trim().min(1, "请填写导出目录"),
  filename: z.string().trim().min(1, "请填写文件名"),
  contentBase64: z.string().min(1, "文件内容为空"),
});

function safeFilename(filename: string) {
  return path.basename(filename).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "导出信息不完整", details: parsed.error.flatten() }, { status: 400 });
  }

  const directory = parsed.data.directory;
  if (!path.isAbsolute(directory)) {
    return Response.json({ error: "导出目录必须是绝对路径，例如 E:\\imi-exports" }, { status: 400 });
  }

  const filename = safeFilename(parsed.data.filename);
  const filePath = path.join(directory, filename);

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, Buffer.from(parsed.data.contentBase64, "base64"));
    const info = await stat(filePath);
    return Response.json({ ok: true, path: filePath, mtimeMs: info.mtimeMs });
  } catch (error) {
    return Response.json(
      {
        error: "保存导出文件失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}
