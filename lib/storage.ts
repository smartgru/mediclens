import fs from "node:fs/promises";
import path from "node:path";
import { FileIndex } from "@/lib/types";

const rootDir = process.cwd();
const uploadDir = path.join(rootDir, "uploads");
const indexDir = path.join(rootDir, "data", "indexes");

export function getUploadPath(fileId: string): string {
  return path.join(uploadDir, `${fileId}.pdf`);
}

export function getIndexPath(fileId: string): string {
  return path.join(indexDir, `${fileId}.json`);
}

export async function ensureStorageDirs(): Promise<void> {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(indexDir, { recursive: true });
}

export async function savePdf(fileId: string, bytes: Uint8Array): Promise<string> {
  await ensureStorageDirs();
  const filePath = getUploadPath(fileId);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export async function saveIndex(index: FileIndex): Promise<void> {
  await ensureStorageDirs();
  const indexPath = getIndexPath(index.fileId);
  await fs.writeFile(indexPath, JSON.stringify(index));
}

export async function readIndex(fileId: string): Promise<FileIndex | null> {
  try {
    const raw = await fs.readFile(getIndexPath(fileId), "utf-8");
    return JSON.parse(raw) as FileIndex;
  } catch {
    return null;
  }
}

export async function readPdf(fileId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(getUploadPath(fileId));
  } catch {
    return null;
  }
}
