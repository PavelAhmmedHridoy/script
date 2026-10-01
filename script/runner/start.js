/**
 * start.js — runs `start` inside template/expo using the detected package manager.
 */

const os = require("os");
const { loadConfig } = require("../support/config");
const { detectPackageManager } = require("../support/package-manager");
const { runTemplateScript } = require("./run-template-script");

const PREFIX = "[runner/start]";

/**
 * Best-effort LAN IPv4 address for this device (e.g. 192.168.0.101).
 *
 * Expo builds the `exp://<hostname>:<port>` URL from its own LAN detection,
 * whose synchronous interface lookup returns the loopback address on
 * Android/Termux — so the QR code and dev client end up pointing at
 * `localhost`, which no other device can reach. Metro still binds all
 * interfaces, so passing the real address via REACT_NATIVE_PACKAGER_HOSTNAME
 * (Expo's highest-priority override) only fixes the advertised URL.
 *
 * wlan/eth-style interfaces are preferred over any other non-internal one.
 *
 * @returns {string|null} the LAN IPv4 address, or null when none is found.
 */
function resolveLanHostname() {
  const preferred = [];
  const others = [];

  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      (/^(wlan|eth|en)/.test(name) ? preferred : others).push(addr.address);
    }
  }

  return preferred[0] ?? others[0] ?? null;
}

/**
 * The environment the native dev server runs in, plus the host it will
 * advertise to devices.
 *
 * Nothing here changes how `expo start` behaves in the terminal: this is the
 * same interactive server you get from `cd template/expo && pnpm start`, QR
 * code and key bindings included. Expo's CLI only draws that TUI when
 * `EXPO_UNSTABLE_HEADLESS` is unset, `CI` is unset and stdout is a TTY, so the
 * runner deliberately leaves those alone — and since your environment is
 * passed through, `EXPO_UNSTABLE_HEADLESS=1 pnpm start` still gets you the
 * quiet, non-interactive server if the standalone React Native DevTools shell
 * cannot run on your device (Android/Termux: fb-dotslash has no "android"
 * platform entry and crashes on install, though the browser DevTools at
 * /open-debugger keep working).
 *
 * - REACT_NATIVE_PACKAGER_HOSTNAME: advertise the device's LAN address instead
 *   of the loopback one Expo's own detection resolves to on Android/Termux. A
 *   value set by the user wins, and it only changes the advertised URL — the
 *   terminal UI is Expo's own.
 *
 * @returns {{env: object, advertisedHost: string|null}} `advertisedHost` is
 *   null when no LAN address could be found
 */
function serverEnv() {
  const env = { ...process.env };

  if (env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    return { env, advertisedHost: env.REACT_NATIVE_PACKAGER_HOSTNAME };
  }

  const lanIp = resolveLanHostname();
  if (!lanIp) return { env, advertisedHost: null };

  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  return { env, advertisedHost: lanIp };
}

/**
 * The addresses this server is reachable on, in the order they matter:
 * the loopback URL for a browser, then the `exp://` URL a device or dev
 * client can open.
 *
 * @param {number} port
 * @param {string|null} advertisedHost
 * @returns {string}
 */
function serverUrls(port, advertisedHost) {
  const urls = [`http://localhost:${port}`];
  if (advertisedHost) urls.push(`exp://${advertisedHost}:${port}`);
  return urls.join(" · ");
}

/**
 * Run `<pm> start` inside template/expo.
 *
 * @param {object} [options]
 * @param {string|null} [options.packageManager]
 * @returns {import("child_process").ChildProcess|false} false when the target
 *   is disabled or the template is not runnable
 */
function runStart({ packageManager = detectPackageManager() } = {}) {
  const config = loadConfig();

  if (!config.deploy?.expo) {
    console.warn(`${PREFIX} expo deploy is disabled in rexpo.config.js, skipping.`);
    return false;
  }

  const port = config.ports?.expo ?? 8081;
  const command = config.scripts?.expo?.start ?? "start";

  const { env, advertisedHost } = serverEnv();
  if (!advertisedHost) {
    console.warn(`${PREFIX} No LAN address detected, expo will advertise localhost.`);
  }

  return runTemplateScript({
    prefix: PREFIX,
    template: "expo",
    script: command,
    args: ["--port", String(port)],
    url: serverUrls(port, advertisedHost),
    env,
    packageManager,
  });
}

module.exports = { runStart, resolveLanHostname, serverUrls, detectPackageManager, serverEnv };

// Allow `node script/runner/start.js` to run directly.
if (require.main === module) {
  const ok = runStart();
  process.exitCode = ok ? 0 : 1;
}
