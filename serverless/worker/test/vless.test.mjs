import assert from 'node:assert/strict';
import test from 'node:test';

import { concat, decodeEarlyData, isUuid, parseVlessHeader, uuidToBytes } from '../src/vless.js';

const UUID = '8f7a1c2e-4b6d-4f11-9c3a-5e2d7b8f0a91';

/** Builds a VLESS request header the way a client would. */
function buildHeader({ uuid = UUID, command = 1, port = 443, host = 'example.com', payload = [] } = {}) {
  const id = uuidToBytes(uuid);
  const hostBytes = new TextEncoder().encode(host);
  const bytes = [
    0, // version
    ...id,
    0, // no addons
    command,
    (port >> 8) & 0xff,
    port & 0xff,
    2, // address type: domain
    hostBytes.length,
    ...hostBytes,
    ...payload,
  ];
  return new Uint8Array(bytes);
}

test('parses a domain target and keeps the trailing payload', () => {
  const header = parseVlessHeader(buildHeader({ payload: [1, 2, 3] }), uuidToBytes(UUID));

  assert.equal(header.hostname, 'example.com');
  assert.equal(header.port, 443);
  assert.equal(header.isUdp, false);
  assert.deepEqual(Array.from(header.payload), [1, 2, 3]);
});

test('parses an IPv4 target', () => {
  const id = uuidToBytes(UUID);
  const bytes = new Uint8Array([0, ...id, 0, 1, 0x1f, 0x90, 1, 10, 0, 0, 7, 42]);

  const header = parseVlessHeader(bytes, id);

  assert.equal(header.hostname, '10.0.0.7');
  assert.equal(header.port, 8080);
  assert.deepEqual(Array.from(header.payload), [42]);
});

test('flags UDP requests', () => {
  const header = parseVlessHeader(buildHeader({ command: 2, port: 53 }), uuidToBytes(UUID));

  assert.equal(header.isUdp, true);
  assert.equal(header.port, 53);
});

test('rejects a header signed with a different uuid', () => {
  const other = uuidToBytes('00000000-0000-4000-8000-000000000000');

  assert.throws(() => parseVlessHeader(buildHeader(), other), /bad uuid/);
});

test('rejects a truncated header', () => {
  assert.throws(() => parseVlessHeader(new Uint8Array(8), uuidToBytes(UUID)), /too short/);
});

test('rejects unsupported commands', () => {
  assert.throws(() => parseVlessHeader(buildHeader({ command: 3 }), uuidToBytes(UUID)), /unsupported command/);
});

test('validates uuid formatting', () => {
  assert.equal(isUuid(UUID), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(UUID.toUpperCase()), false, 'callers lower-case before checking');
});

test('decodes url-safe early data and ignores junk', () => {
  const encoded = Buffer.from([7, 8, 9]).toString('base64url');

  assert.deepEqual(Array.from(decodeEarlyData(encoded)), [7, 8, 9]);
  assert.equal(decodeEarlyData(''), null);
});

test('concat keeps operand order and avoids copies when possible', () => {
  const a = new Uint8Array([1, 2]);
  const b = new Uint8Array([3]);

  assert.deepEqual(Array.from(concat(a, b)), [1, 2, 3]);
  assert.equal(concat(new Uint8Array(0), b), b);
});
