/**
 * results.js — the shape every check reports in.
 *
 * A check appends plain `{ level, check, detail }` records; the report reads
 * them and nothing else. Constructors live here so a typo in a level string is
 * impossible.
 */

/** @typedef {{level: "ok"|"warn"|"fail", check: string, detail: string}} Result */

/** @returns {Result} */
const ok = (check, detail) => ({ level: "ok", check, detail });

/** @returns {Result} */
const warn = (check, detail) => ({ level: "warn", check, detail });

/** @returns {Result} */
const fail = (check, detail) => ({ level: "fail", check, detail });

module.exports = { ok, warn, fail };
