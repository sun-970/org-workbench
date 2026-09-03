import fs from "node:fs/promises";

interface SyncableHandle {
  sync(): Promise<void>;
  close(): Promise<void>;
}

/**
 * fsync a directory handle, swallowing EPERM only on win32 where NTFS rejects
 * directory fsync but rename() has already committed the data atomically.
 *
 * Reduced durability guarantee (AC-004): on Windows the rename directory entry
 * may not survive a subsequent power loss — POSIX callers lose the "renamed
 * AND fsync-durable" guarantee. On POSIX, EPERM indicates a real failure and
 * propagates.
 *
 * Accepts an optional pre-opened handle so callers with injected operations
 * (e.g. atomicWriteJson) can pass their own directory handle. When omitted,
 * opens the directory directly via fs.
 */
export async function syncDirectoryDurable(dir: string, existing?: SyncableHandle): Promise<void> {
  const own = existing === undefined;
  const directory = own ? await fs.open(dir, "r") : existing;
  try {
    try {
      await directory.sync();
    } catch (error) {
      if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") {
        throw error;
      }
      console.error("[ac-005] directory fsync EPERM swallowed on win32", { dir, code: "EPERM" });
    }
  } finally {
    if (own) await directory.close();
  }
}
