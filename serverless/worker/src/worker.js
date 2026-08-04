/**
 * Dельта VPN — serverless entry point.
 *
 * A Cloudflare Worker that speaks VLESS over WebSocket and opens the outbound TCP
 * connection from the edge itself (`cloudflare:sockets`). There is no origin server
 * in this path: the client talks to Cloudflare's anycast addresses, which is what
 * keeps it reachable when a specific VPS IP is not.
 *
 * Routes:
 *   WS  <WS_PATH>        VLESS tunnel
 *   GET /sub?token=…     subscription (base64 list of vless:// links)
 *   GET *                decoy page, so the worker looks like an ordinary site
 *
 * Configure via wrangler secrets/vars: UUID, WS_PATH, SUB_TOKEN, PROXY_IP, EXTRA_NODES.
 */

import { connect } from 'cloudflare:sockets';
import {
  EMPTY,
  concat,
  decodeEarlyData,
  isUuid,
  parseVlessHeader,
  toUint8,
  uuidToBytes,
} from './vless.js';

const DNS_PORT = 53;
const DOH_ENDPOINT = 'https://1.1.1.1/dns-query';

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string>} env
   */
  async fetch(request, env) {
    const config = readConfig(env);
    const url = new URL(request.url);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      if (url.pathname !== config.wsPath) {
        return new Response('Not found', { status: 404 });
      }
      return handleTunnel(request, config);
    }

    if (url.pathname === '/sub') {
      return handleSubscription(url, config);
    }

    return decoyResponse();
  },
};

function readConfig(env) {
  const uuid = (env.UUID || '').trim().toLowerCase();
  if (!isUuid(uuid)) {
    throw new Error('UUID is not configured — set it with `wrangler secret put UUID`');
  }
  return {
    uuid,
    uuidBytes: uuidToBytes(uuid),
    wsPath: env.WS_PATH || '/delta',
    subToken: env.SUB_TOKEN || '',
    // Cloudflare refuses connections to some of its own ranges; a relay IP works
    // around that for the handful of sites hosted behind Cloudflare itself.
    proxyIp: env.PROXY_IP || '',
    extraNodes: (env.EXTRA_NODES || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    nodeName: env.NODE_NAME || 'Dельта · Edge',
  };
}

/* ------------------------------------------------------------------ tunnel */

function handleTunnel(request, config) {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();

  const earlyData = request.headers.get('sec-websocket-protocol') || '';
  pipeTunnel(server, earlyData, config).catch((error) => {
    console.log('tunnel failed:', error?.message || error);
    closeQuietly(server);
  });

  return new Response(null, { status: 101, webSocket: client });
}

async function pipeTunnel(ws, earlyDataHeader, config) {
  const reader = clientStream(ws, earlyDataHeader).getReader();

  const first = await reader.read();
  if (first.done) throw new Error('client closed before sending a header');

  const header = parseVlessHeader(toUint8(first.value), config.uuidBytes);
  // Every VLESS response starts with the version and an empty addon block.
  const responseHeader = new Uint8Array([header.version, 0]);

  if (header.isUdp) {
    if (header.port !== DNS_PORT) throw new Error('UDP is only relayed for DNS');
    await relayDns(ws, reader, header, responseHeader);
    return;
  }

  await relayTcp(ws, reader, header, responseHeader, config);
}

async function relayTcp(ws, reader, header, responseHeader, config) {
  let socket;
  try {
    socket = await openSocket(header.hostname, header.port, header.payload);
  } catch (error) {
    // Cloudflare refuses to open sockets to a few destinations (notably other
    // Cloudflare-fronted sites); a relay IP is the documented workaround.
    if (!config.proxyIp) throw error;
    socket = await openSocket(config.proxyIp, header.port, header.payload);
  }

  const remoteToClient = socket.readable.pipeTo(
    new WritableStream({
      write(chunk) {
        if (ws.readyState !== WS_OPEN) throw new Error('client went away');
        ws.send(concat(responseHeader, toUint8(chunk)));
        // Only the first frame carries the response header.
        responseHeader = EMPTY;
      },
      close: () => closeQuietly(ws),
      abort: () => closeQuietly(ws),
    }),
  );

  const writer = socket.writable.getWriter();
  const clientToRemote = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
    await writer.close().catch(() => {});
  })();

  await Promise.race([remoteToClient, clientToRemote]).catch(() => {});
  closeQuietly(ws);
}

async function openSocket(hostname, port, payload) {
  const socket = connect({ hostname, port });
  // `opened` is where connection errors surface, so await it before writing —
  // that is what makes the relay fallback in relayTcp reachable.
  await socket.opened;
  const writer = socket.writable.getWriter();
  if (payload && payload.byteLength) await writer.write(payload);
  writer.releaseLock();
  return socket;
}

/**
 * UDP is limited to DNS, forwarded over DoH. Each datagram is length-prefixed with
 * two bytes, exactly as VLESS specifies for UDP payloads.
 */
async function relayDns(ws, reader, header, responseHeader) {
  let prefix = responseHeader;
  let pending = header.payload;

  const flush = async (buffer) => {
    let offset = 0;
    while (offset + 2 <= buffer.byteLength) {
      const length = (buffer[offset] << 8) | buffer[offset + 1];
      if (offset + 2 + length > buffer.byteLength) break;
      const query = buffer.slice(offset + 2, offset + 2 + length);
      offset += 2 + length;

      const answer = await resolveOverHttps(query);
      const size = new Uint8Array([(answer.byteLength >> 8) & 0xff, answer.byteLength & 0xff]);
      if (ws.readyState === WS_OPEN) {
        ws.send(concat(prefix, concat(size, answer)));
        prefix = EMPTY;
      }
    }
    return buffer.slice(offset);
  };

  pending = await flush(pending);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending = await flush(concat(pending, toUint8(value)));
  }
  closeQuietly(ws);
}

async function resolveOverHttps(query) {
  const response = await fetch(DOH_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/dns-message' },
    body: query,
  });
  return new Uint8Array(await response.arrayBuffer());
}

function clientStream(ws, earlyDataHeader) {
  let cancelled = false;
  return new ReadableStream({
    start(controller) {
      ws.addEventListener('message', (event) => {
        if (!cancelled) controller.enqueue(event.data);
      });
      ws.addEventListener('close', () => {
        if (!cancelled) {
          closeQuietly(ws);
          controller.close();
        }
      });
      ws.addEventListener('error', (error) => controller.error(error));

      // 0-RTT: clients may smuggle the first frame in the subprotocol header.
      const early = decodeEarlyData(earlyDataHeader);
      if (early) controller.enqueue(early);
    },
    cancel() {
      cancelled = true;
      closeQuietly(ws);
    },
  });
}

/* ------------------------------------------------------- subscription/decoy */

function handleSubscription(url, config) {
  if (config.subToken && url.searchParams.get('token') !== config.subToken) {
    return new Response('Not found', { status: 404 });
  }

  const host = url.hostname;
  const params = new URLSearchParams({
    type: 'ws',
    security: 'tls',
    encryption: 'none',
    host,
    sni: host,
    fp: 'chrome',
    path: `${config.wsPath}?ed=2048`,
  });

  const links = [
    `vless://${config.uuid}@${host}:443?${params}#${encodeURIComponent(config.nodeName)}`,
    ...config.extraNodes,
  ];

  return new Response(btoa(links.join('\n')), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      // Clients read the title from here when saving the subscription.
      'profile-title': 'Delta VPN',
    },
  });
}

/** Anything that is not the tunnel or the subscription looks like a plain site. */
function decoyResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Delta</title>' +
      '<body style="font-family:system-ui;background:#0B0E14;color:#8A93A6;' +
      'display:grid;place-items:center;height:100vh;margin:0">' +
      '<p>Сервис временно недоступен.</p>',
    { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 200 },
  );
}

/* -------------------------------------------------------------- primitives */

const WS_OPEN = 1;

function closeQuietly(ws) {
  try {
    if (ws.readyState === WS_OPEN) ws.close(1000, 'done');
  } catch {
    /* the socket is already gone */
  }
}
