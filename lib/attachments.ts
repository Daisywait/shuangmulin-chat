import pdf from "pdf-parse";
import { Attachment } from "./types";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_TEXT_CHARS = 16000;

export async function parseUpload(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is larger than ${MAX_FILE_SIZE_MB} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base: Attachment = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size
  };

  if (base.mimeType.startsWith("image/")) {
    return {
      ...base,
      dataUrl: `data:${base.mimeType};base64,${buffer.toString("base64")}`
    };
  }

  if (base.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const result = await pdf(buffer);
    return {
      ...base,
      mimeType: "application/pdf",
      text: result.text.slice(0, MAX_TEXT_CHARS)
    };
  }

  if (base.mimeType.startsWith("text/") || /\.(md|txt|csv|json|ts|tsx|js|jsx|py|java|c|cpp|h|sql)$/i.test(file.name)) {
    return {
      ...base,
      text: buffer.toString("utf8").slice(0, MAX_TEXT_CHARS)
    };
  }

  throw new Error("Unsupported file type. Upload text, PDF, or image files.");
}
