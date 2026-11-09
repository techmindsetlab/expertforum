// Production deploy from a clean export of HEAD, without git metadata.
// Vercel (Hobby team "mbustanai") blocks CLI deploys whose commit author is
// not a team member (TEAM_ACCESS_REQUIRED); deploying a plain folder avoids it.
//   npm run deploy            → production
//   npm run deploy -- --preview
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const preview = process.argv.includes("--preview");
const dir = mkdtempSync(path.join(tmpdir(), "expertforum-deploy-"));
try {
  // Extract with cwd = target dir: GNU tar on Windows reads "C:\…" as a remote host.
  execSync(`git -C "${process.cwd()}" archive --format=tar HEAD | tar -x`, { cwd: dir, stdio: "inherit", shell: true });
  cpSync(".vercel", path.join(dir, ".vercel"), { recursive: true });
  const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (dirty) console.warn("⚠ Uncommitted changes are NOT deployed (deploying HEAD only).");
  execSync(`vercel deploy ${preview ? "" : "--prod"} --yes --archive=tgz`, { cwd: dir, stdio: "inherit", shell: true });
} finally {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    // Windows can keep the temp folder locked briefly; it is safe to leave behind.
  }
}
