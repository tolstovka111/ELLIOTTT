/**
 * Pure VLESS helpers — no Workers runtime APIs, so they can be unit-tested with
 * plain Node (`npm test`).
 */

export const EMPTY = new Uint8Array(0);

/**
 * VLESS request header:
 *   0        version
 *   1..16    uuid
 *   17       addon length (M)
 *   18..     addons
 *   18+M     command (1 tcp, 2 udp, 3 mux)
 *   19+M     port (uint16 BE)
 *   21+M     address type (1 ipv4, 2 domain, 3 ipv6)
 *   22+M..   address, then payload
 */
export function parseVlessHeader(bytes, expectedUuid) {
  if (bytes.byteLength < 24) throw new Error('header too short');

  const version = bytes[0];
  for (let i = 0; i < 16; i++) {
    if (bytes[1 + i] !== expectedUuid[i]) throw new Error('rejected: bad uuid');
  }

  const addonLength = bytes[17];
  let cursor = 18 + addonLength;

  const command = bytes[cursor++];
  if (command !== 1 && command !== 2) throw new Error(`unsupported command ${command}`);

  const port = (bytes[cursor] << 8) | bytes[cursor + 1];
  cursor += 2;

  const addressType = bytes[cursor++];
  let hostname = '';
  if (addressType === 1) {
    hostname = Array.from(bytes.slice(cursor, cursor + 4)).join('.');
    cursor += 4;
  } else if (addressType === 2) {
    const length = bytes[cursor++];
    hostname = new TextDecoder().decode(bytes.slice(cursor, cursor + length));
    cursor += length;
  } else if (addressType === 3) {
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(((bytes[cursor] << 8) | bytes[cursor + 1]).toString(16));
      cursor += 2;
    }
    hostname = parts.join(':');
  } else {
    throw new Error(`unsupported address type ${addressType}`);
  }

  return {
    version,
    isUdp: command === 2,
    hostname,
    port,
    payload: bytes.slice(cursor),
  };
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

export function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function toUint8(value) {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

export function concat(a, b) {
  if (!a.byteLength) return b;
  if (!b.byteLength) return a;
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/** 0-RTT payload smuggled through the websocket subprotocol header. */
export function decodeEarlyData(header) {
  if (!header) return null;
  try {
    const normalised = header.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalised);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.byteLength ? bytes : null;
  } catch {
    return null;
  }
}
