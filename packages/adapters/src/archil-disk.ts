import type { Disk, ExecResult } from "disk";
import * as archil from "disk";

/**
 * Archil disk storage for server code.
 *
 * A disk is a filesystem that outlives any one process: every exec runs in a fresh container
 * with the disk mounted, so files written in one call are there in the next. This is the only
 * place the `disk` SDK and its credentials are touched, and it stays server-side — a plain
 * ARCHIL_API_KEY, never a NEXT_PUBLIC_/VITE_ name, never imported from a client component.
 *
 * Environment:
 *   ARCHIL_API_KEY  API key from https://console.archil.com/api-keys. Starts with "key-"; a
 *                   disk/mount token (adt_…) is a different credential and gets HTTP 401.
 *   ARCHIL_REGION   Region the key was issued for; a key from another region fails. Exec runs
 *                   only in aws-us-east-1, aws-us-west-2 and aws-eu-west-1.
 *   ARCHIL_DISK_ID  Disk to store on, e.g. dsk-…. scripts/archil-persist-check.mjs creates one
 *                   and prints its id when this is unset.
 */

/** Used when ARCHIL_REGION is unset, and the region exec-capable keys are most often made in. */
export const DEFAULT_ARCHIL_REGION = "aws-us-east-1";

/** Where an exec container sees the disk. It is also the command's working directory. */
export const ARCHIL_DISK_MOUNT = "/mnt/data";

export interface ArchilDiskConfig {
  /** Empty when ARCHIL_API_KEY is unset or blank. */
  apiKey: string;
  region: string;
  /** Undefined when ARCHIL_DISK_ID is unset or blank. */
  diskId?: string;
}

/** Archil settings from the environment; blank values read as unset. */
export function archilDiskConfigFromEnv(source: NodeJS.ProcessEnv = process.env): ArchilDiskConfig {
  const diskId = source.ARCHIL_DISK_ID?.trim();
  return {
    apiKey: source.ARCHIL_API_KEY?.trim() ?? "",
    region: source.ARCHIL_REGION?.trim() || DEFAULT_ARCHIL_REGION,
    diskId: diskId || undefined,
  };
}

let configured = false;

/** Configure the SDK client once from ARCHIL_API_KEY / ARCHIL_REGION. */
function configureArchil(): ArchilDiskConfig {
  const config = archilDiskConfigFromEnv();
  if (!config.apiKey) {
    throw new Error(
      'ARCHIL_API_KEY is not set. Use an API key (starts with "key-") from ' +
        "https://console.archil.com/api-keys, not a disk or mount token.",
    );
  }
  if (!configured) {
    archil.configure({ apiKey: config.apiKey, region: config.region });
    configured = true;
  }
  return config;
}

/** The disk named by ARCHIL_DISK_ID. */
export async function getArchilDisk(): Promise<Disk> {
  const config = configureArchil();
  if (!config.diskId) {
    throw new Error(
      "ARCHIL_DISK_ID is not set. Create a disk with createArchilDisk() and store its id.",
    );
  }
  return archil.getDisk(config.diskId);
}

/**
 * Create a disk and return it. `createDisk` also returns a one-time mount token; it is dropped
 * here because exec and the object API do not need it, and it cannot be retrieved again.
 */
export async function createArchilDisk(name: string): Promise<Disk> {
  configureArchil();
  const { disk } = await archil.createDisk({ name });
  return disk;
}

/**
 * Run a shell command in a fresh container with the disk mounted at ARCHIL_DISK_MOUNT, which is
 * also the working directory. Container state is discarded when the command ends; the disk is
 * not. A shared-mode mount rejects writes to paths another client already owns, so write into a
 * fresh subdirectory or check the path out with `archil checkout <path>` inside the command.
 */
export async function runArchilCommand(command: string): Promise<ExecResult> {
  return (await getArchilDisk()).exec(command);
}

/** Write one file on the disk through its object API, without starting an exec container. */
export async function writeArchilFile(key: string, contents: string): Promise<void> {
  await (await getArchilDisk()).putObject(key, contents);
}

/** Read a file written by writeArchilFile. */
export async function readArchilFile(key: string): Promise<string> {
  const bytes = await (await getArchilDisk()).getObject(key);
  return new TextDecoder().decode(bytes);
}
