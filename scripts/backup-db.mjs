/**
 * Full local backup bundle for Game Room Management System.
 * Usage: npm run db:backup
 *
 * Creates `backups/gameroom-YYYYMMDD-HHMMSS/` containing:
 *   - database.sql       (Postgres dump via Docker `pg_dump`)
 *   - storage/members/   (member photos; filenames match DB `photoUrl`)
 *   - storage/waivers/   (signed waiver PDFs; filenames match DB `waiverPdfUrl`)
 *   - storage/government-ids/ (gov ID photos; filenames match DB `governmentIdUrl`)
 *   - .env               (secrets — keep this folder private)
 *   - RESTORE.txt        (human restore steps)
 *
 * Requires Docker Desktop + `npm run db:up` (Compose service `db`).
 *
 * Optional: set BACKUP_COPY_TO to an absolute path (USB/NAS folder). After the
 * local bundle is written, the whole folder is copied there. Prefer off-machine
 * copies when the app and database share one computer — a disk failure can wipe
 * both live data and on-disk backups.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory of this script (`scripts/`). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Project root (parent of `scripts/`). */
const root = path.resolve(__dirname, "..");
/** Local backup root; contents are gitignored except `.gitkeep`. */
const backupsDir = path.join(root, "backups");
/** Live member photo directory mirrored into each bundle. */
const membersSrc = path.join(root, "storage", "members");
/** Live signed waiver PDF directory mirrored into each bundle. */
const waiversSrc = path.join(root, "storage", "waivers");
/** Live government ID photo directory mirrored into each bundle. */
const governmentIdsSrc = path.join(root, "storage", "government-ids");
/** Live env file copied into each bundle (never commit bundles). */
const envSrc = path.join(root, ".env");

/** Postgres role inside the Compose container (matches docker-compose defaults). */
const POSTGRES_USER = process.env.POSTGRES_USER ?? "gameroom";
/** Database name to dump. */
const POSTGRES_DB = process.env.POSTGRES_DB ?? "gameroom";
/** Compose service name for Postgres (`db` in docker-compose.yml). */
const COMPOSE_SERVICE = process.env.BACKUP_COMPOSE_SERVICE ?? "db";
/**
 * Optional absolute path to copy the finished bundle (USB, NAS, etc.).
 *
 * @author Muhammad Naheen Mahboob
 */
const BACKUP_COPY_TO = process.env.BACKUP_COPY_TO?.trim() || "";

/**
 * Local filesystem-safe timestamp for the backup folder name.
 *
 * @returns {string} `YYYYMMDD-HHMMSS`
 * @author Muhammad Naheen Mahboob
 */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Runs `docker compose exec … pg_dump` and returns the spawn result (stdout = SQL).
 * Uses `-T` so stdin is not a TTY (required for non-interactive dumps on Windows).
 *
 * @returns {import("node:child_process").SpawnSyncReturns<Buffer>}
 * @author Muhammad Naheen Mahboob
 */
function dockerComposeDump() {
  const args = [
    "compose",
    "exec",
    "-T",
    COMPOSE_SERVICE,
    "pg_dump",
    "-U",
    POSTGRES_USER,
    "--clean",
    "--if-exists",
    "--no-owner",
    POSTGRES_DB,
  ];
  // Capture as Buffer so large dumps are not corrupted by string encoding.
  return spawnSync("docker", args, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/**
 * Recursively copies a directory; creates an empty dest when the source is missing.
 * Used for `storage/members` so photo filenames stay aligned with DB `photoUrl`.
 *
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {{ files: number }} Count of top-level entries copied (excludes `.gitkeep`)
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
function copyDirOrEmpty(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${src} missing — created empty ${dest}`);
    return { files: 0 };
  }
  fs.cpSync(src, dest, { recursive: true });
  const files = fs.readdirSync(dest).filter((n) => n !== ".gitkeep");
  return { files: files.length };
}

/**
 * Writes a short restore cheat-sheet inside the bundle.
 *
 * @param {string} bundleDir - Timestamped backup folder
 * @author Muhammad Naheen Mahboob
 */
function writeRestoreNotes(bundleDir) {
  const notes = `Game Room backup bundle
Created: ${new Date().toISOString()}

Contents
- database.sql      Postgres dump (schema + data)
- storage/members   Photo files referenced by Member.photoUrl
- storage/waivers   Signed waiver PDFs referenced by Member.waiverPdfUrl
- storage/government-ids  Government ID photos referenced by Member.governmentIdUrl
- .env              App secrets (DATABASE_URL, JWT_SECRET, …) — keep private

Restore (same machine, Docker Postgres up)
1. Copy .env back to the project root if needed.
2. Copy storage/members/* into the project's storage/members/.
3. Copy storage/waivers/* into the project's storage/waivers/.
4. Copy storage/government-ids/* into the project's storage/government-ids/.
5. Restore the database, e.g.:
   docker compose exec -T db psql -U gameroom -d gameroom < database.sql
   (On Windows PowerShell you may need: Get-Content database.sql | docker compose exec -T db psql -U gameroom -d gameroom)
6. Restart the app (npm run start / npm run dev).

Off-site
Copy this whole folder to another disk/USB/NAS regularly. App + DB on one
machine means a single disk failure can destroy live data and local backups.
`;
  fs.writeFileSync(path.join(bundleDir, "RESTORE.txt"), notes, "utf8");
}

/**
 * Entry point: build one timestamped bundle (SQL + photos + .env), then optional off-site copy.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
function main() {
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = timestamp();
  const bundleDir = path.join(backupsDir, `gameroom-${stamp}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  console.log(`Creating backup bundle: ${bundleDir}`);

  // --- 1) Database dump ---
  console.log(
    `1/5 Database (${POSTGRES_DB}) via docker compose service "${COMPOSE_SERVICE}"…`
  );
  const result = dockerComposeDump();
  if (result.error) {
    console.error("Failed to run docker:", result.error.message);
    console.error("Is Docker Desktop running?");
    process.exit(1);
  }
  if (result.status !== 0) {
    const errText = (result.stderr ?? Buffer.alloc(0)).toString("utf8").trim();
    console.error(
      errText || `docker compose exited with code ${result.status}`
    );
    console.error("Tip: start Postgres with `npm run db:up`, then retry.");
    process.exit(result.status ?? 1);
  }
  const sql = result.stdout;
  if (!sql || sql.length === 0) {
    console.error("pg_dump produced an empty dump.");
    process.exit(1);
  }
  // Write via Node (not shell redirect) so paths work the same on Win/Mac/Linux.
  const sqlPath = path.join(bundleDir, "database.sql");
  fs.writeFileSync(sqlPath, sql);
  console.log(`   Wrote database.sql (${sql.length} bytes)`);

  // --- 2) Photos + signed waivers + gov IDs (must stay with SQL so filenames resolve) ---
  console.log("2/5 Member photos (storage/members)…");
  const photoDest = path.join(bundleDir, "storage", "members");
  const photoInfo = copyDirOrEmpty(membersSrc, photoDest);
  console.log(`   Copied photo directory (${photoInfo.files} entries)`);

  console.log("3/5 Signed waivers (storage/waivers)…");
  const waiverDest = path.join(bundleDir, "storage", "waivers");
  const waiverInfo = copyDirOrEmpty(waiversSrc, waiverDest);
  console.log(`   Copied waiver directory (${waiverInfo.files} entries)`);

  console.log("4/5 Government IDs (storage/government-ids)…");
  const govIdDest = path.join(bundleDir, "storage", "government-ids");
  const govIdInfo = copyDirOrEmpty(governmentIdsSrc, govIdDest);
  console.log(`   Copied government ID directory (${govIdInfo.files} entries)`);

  // --- 5) Secrets ---
  console.log("5/5 Environment file (.env)…");
  const envDest = path.join(bundleDir, ".env");
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDest);
    console.log("   Copied .env");
  } else {
    console.warn(
      "   Warning: .env not found — skipped (use .env.example as a template)"
    );
  }

  writeRestoreNotes(bundleDir);
  console.log("   Wrote RESTORE.txt");

  // Optional second copy off this machine’s only disk.
  if (BACKUP_COPY_TO) {
    const remote = path.join(BACKUP_COPY_TO, `gameroom-${stamp}`);
    console.log(`Copying bundle off-machine to ${remote}…`);
    fs.mkdirSync(BACKUP_COPY_TO, { recursive: true });
    fs.cpSync(bundleDir, remote, { recursive: true });
    console.log("   Off-site copy done.");
  } else {
    console.log(
      "Tip: set BACKUP_COPY_TO to a USB/NAS path to duplicate this bundle off the server disk."
    );
  }

  console.log(`Backup complete: ${bundleDir}`);
  console.log(
    "Schedule `npm run db:backup` with Task Scheduler (Windows), launchd (macOS), or cron (Linux)."
  );
}

main();
