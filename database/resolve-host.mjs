import { execSync } from "child_process";

/** Resolve via Windows DNS when Node getaddrinfo fails (IPv6-only Supabase hosts) */
export function resolveHost(hostname) {
  try {
    const cmd = `powershell -NoProfile -Command "(Resolve-DnsName -Name '${hostname}' -Type AAAA -ErrorAction Stop | Select-Object -First 1 -ExpandProperty IPAddress)"`;
    const ip = execSync(cmd, { encoding: "utf8" }).trim();
    if (ip) return ip;
  } catch {
    /* fall through */
  }
  try {
    const cmd = `powershell -NoProfile -Command "(Resolve-DnsName -Name '${hostname}' -Type A -ErrorAction Stop | Select-Object -First 1 -ExpandProperty IPAddress)"`;
    const ip = execSync(cmd, { encoding: "utf8" }).trim();
    if (ip) return ip;
  } catch {
    /* fall through */
  }
  return hostname;
}
