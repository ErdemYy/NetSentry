/**
 * Validates whether an IP address or host is private, loopback, or link-local
 * to prevent Server-Side Request Forgery (SSRF) vulnerabilities.
 */
export class SsrfValidator {
  static isPrivateOrReserved(ip: string): boolean {
    if (!ip || typeof ip !== 'string') return true;

    const trimmed = ip.trim();

    // Check special hostnames
    if (
      trimmed === 'localhost' ||
      trimmed.endsWith('.local') ||
      trimmed.endsWith('.internal') ||
      trimmed === 'metadata.google.internal'
    ) {
      return true;
    }

    // IPv6 loopback and private ranges
    if (
      trimmed === '::1' ||
      trimmed === '::' ||
      trimmed.toLowerCase().startsWith('fe80:') || // link-local
      trimmed.toLowerCase().startsWith('fc00:') || // unique local
      trimmed.toLowerCase().startsWith('fd00:')
    ) {
      return true;
    }

    // IPv4 address check
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = trimmed.match(ipv4Regex);
    if (!match) {
      return false; // Let domain check or other validation handle if not IPv4
    }

    const octets = [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      parseInt(match[4], 10),
    ];

    if (octets.some((o) => o < 0 || o > 255)) {
      return true; // Malformed IP
    }

    const [o1, o2] = octets;

    // 0.0.0.0/8 - Current network
    if (o1 === 0) return true;

    // 10.0.0.0/8 - Private Class A
    if (o1 === 10) return true;

    // 127.0.0.0/8 - Loopback
    if (o1 === 127) return true;

    // 100.64.0.0/10 - Shared address space (Carrier-grade NAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;

    // 169.254.0.0/16 - Link-local
    if (o1 === 169 && o2 === 254) return true;

    // 172.16.0.0/12 - Private Class B
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 - Documentation TEST-NET
    if (
      (o1 === 192 && o2 === 0 && octets[2] === 2) ||
      (o1 === 198 && o2 === 51 && octets[2] === 100) ||
      (o1 === 203 && o2 === 0 && octets[2] === 113)
    ) {
      return true;
    }

    // 192.168.0.0/16 - Private Class C
    if (o1 === 192 && o2 === 168) return true;

    // 224.0.0.0/4 - Multicast
    if (o1 >= 224 && o1 <= 239) return true;

    // 240.0.0.0/4 - Reserved
    if (o1 >= 240) return true;

    return false;
  }
}
