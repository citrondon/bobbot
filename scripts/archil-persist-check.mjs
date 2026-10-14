#!/usr/bin/env node
// Prove an Archil disk keeps files across runs: write a line in one exec, read it back in a
// second, separate exec. It fails loudly when the disk does not return what was written.
//
// Needs ARCHIL_API_KEY — an API key (starts with "key-") from
// https://console.archil.com/api-keys, not a disk or mount token. It uses the disk named by
// ARCHIL_DISK_ID, or creates one and prints its id so it can be stored there; a disk's one-time
// mount token is never printed.
//
// The storage module is TypeScript, which plain `node` runs directly by stripping the types.
import process from "node:process";
import {
  archilDiskConfigFromEnv,
  createArchilDisk,
  getArchilDisk,
} from "../packages/adapters/src/archil-disk.ts";

const DISK_NAME = "rakazo-persist-check";

function fail(message) {
  console.error(`archil persist check failed: ${message}`);
  process.exit(1);
}

const { apiKey, diskId, region } = archilDiskConfigFromEnv();
if (!apiKey) {
  fail(
    'ARCHIL_API_KEY is not set. Put an API key starting with "key-" (not a disk or mount\n' +
      "token) from https://console.archil.com/api-keys in the local env file.",
  );
}

const disk = diskId ? await getArchilDisk() : await createArchilDisk(DISK_NAME);
console.log(
  diskId
    ? `using disk ${disk.name} (${disk.id}) in ${region}`
    : `created disk ${disk.name} (${disk.id}) in ${region}; set ARCHIL_DISK_ID=${disk.id} to reuse it`,
);

const marker = `written ${new Date().toISOString()} by pid ${process.pid}`;
// A shared-mode mount rejects writes to paths another client already owns, so the write claims a
// fresh subdirectory of its own.
const dir = `persist-check/${Date.now()}-${process.pid}`;
const file = `${dir}/marker.txt`;

// Every exec is a fresh container; only what lands on the disk survives into the next one.
const wrote = await disk.exec(`mkdir -p '${dir}' && printf '%s\n' '${marker}' > '${file}'`);
if (wrote.exitCode !== 0) {
  fail(`the write run exited ${wrote.exitCode}: ${wrote.stderr.trim() || "no stderr"}`);
}

const read = await disk.exec(`cat '${file}'`);
if (read.exitCode !== 0) {
  fail(`the read run exited ${read.exitCode}: ${read.stderr.trim() || "no stderr"}`);
}
if (!read.stdout.includes(marker)) {
  fail(`the read run did not return what the write run saved: ${JSON.stringify(read.stdout)}`);
}

console.log(`read back in a second run: ${read.stdout.trim()}`);
console.log(`ok: ${file} persisted on disk ${disk.id}`);
