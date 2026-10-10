/**
 * io.js — filesystem helpers shared by the generator.
 *
 * Everything the generator writes goes through here, because rewriting a file
 * with identical content is not free: it bumps the mtime, and that is enough
 * for Vite and Metro to treat the file as changed.
 *
 * The visible symptom of getting this wrong is Metro printing
 * "Detected a change in metro.config.js. Restart the server to see the new
 * results." on a sync that changed nothing, invalidating its transform cache,
 * and a bundle in flight stalling near the end — which looks exactly like a
 * build hanging at 99%.
 *
 * Writing only on a real difference makes a repeated sync a true no-op, so
 * re-running `rexpo start` next to a live server is safe.
 */

const fs = require("fs");
const path = require("path");

/** Ensure the parent directory of `dest` exists. */
function ensureDir(dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write string `content` to `dest` only when it differs from what is there.
 *
 * @returns {boolean} true when the file was actually written
 */
function writeIfChanged(dest, content) {
  try {
    if (fs.existsSync(dest) && fs.readFileSync(dest, "utf-8") === content) return false;
  } catch {
    // Unreadable destination — fall through and write it.
  }

  ensureDir(dest);
  fs.writeFileSync(dest, content);
  return true;
}

/**
 * Copy `src` to `dest` only when the bytes differ. Buffer-based, so it is
 * correct for binary assets as well as config files.
 *
 * @returns {boolean} true when the file was actually written
 */
function copyFileIfChanged(src, dest) {
  let from;
  try {
    from = fs.readFileSync(src);
  } catch (err) {
    console.error(`[io] Failed to read ${src}: ${err.message}`);
    return false;
  }

  try {
    if (fs.existsSync(dest) && fs.readFileSync(dest).equals(from)) return false;
  } catch {
    // Unreadable destination — fall through and write it.
  }

  ensureDir(dest);
  fs.writeFileSync(dest, from);
  return true;
}

module.exports = { writeIfChanged, copyFileIfChanged, ensureDir };
