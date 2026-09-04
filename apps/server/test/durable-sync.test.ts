import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncDirectoryDurable } from "../src/durable-sync.js";

test("syncDirectoryDurable succeeds on a real directory", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "owb-durable-sync-"));
  try {
    await syncDirectoryDurable(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("syncDirectoryDurable propagates non-EPERM errors", async () => {
  await assert.rejects(
    syncDirectoryDurable("/nonexistent/path/that/does/not/exist"),
    (error: NodeJS.ErrnoException) => error.code === "ENOENT",
  );
});

test("syncDirectoryDurable swallows EPERM with injected platform win32", async () => {
  const epermHandle = {
    sync: async () => {
      const error = new Error("operation not permitted, fsync") as NodeJS.ErrnoException;
      error.code = "EPERM";
      throw error;
    },
    close: async () => {},
  };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "owb-durable-sync-win32-"));
  try {
    await syncDirectoryDurable(dir, epermHandle, "win32");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("syncDirectoryDurable propagates EPERM with injected platform linux", async () => {
  const epermHandle = {
    sync: async () => {
      const error = new Error("operation not permitted, fsync") as NodeJS.ErrnoException;
      error.code = "EPERM";
      throw error;
    },
    close: async () => {},
  };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "owb-durable-sync-posix-"));
  try {
    await assert.rejects(
      syncDirectoryDurable(dir, epermHandle, "linux"),
      (error: NodeJS.ErrnoException) => error.code === "EPERM",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
