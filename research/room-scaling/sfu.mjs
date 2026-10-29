import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { loopbackUrl } from './boundary.mjs';

async function unusedPort() {
  const server = createTcpServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
export async function measureSfu() {
  const name = `w39-sfu-${randomBytes(6).toString('hex')}`,
    apiKey = 'local-research',
    apiSecret = randomBytes(32).toString('hex');
  let browser, http, nativeProcess;
  const nativeBinary = process.env.W39_LIVEKIT_BINARY;
  if (!nativeBinary?.startsWith('/')) throw new Error('W39_LIVEKIT_BINARY must be an absolute path to LiveKit 1.13.11');
  const directory = await mkdtemp(join(tmpdir(), 'dotify-w39-'));
  try {
    const tcpPort = await unusedPort();
    const nativeWsPort = await unusedPort();
    const config = join(directory, 'livekit.yaml');
    await writeFile(
      config,
      `port: ${nativeWsPort}\nbind_addresses: [127.0.0.1]\nrtc:\n  tcp_port: ${tcpPort}\n  use_external_ip: false\n  node_ip: 127.0.0.1\n  enable_loopback_candidate: true\n  port_range_start: 0\n  port_range_end: 0\nkeys:\n  ${apiKey}: ${apiSecret}\nlogging:\n  level: error\n`,
      { mode: 0o600 }
    );
    assert.match(execFileSync(nativeBinary, ['--version'], { encoding: 'utf8' }), /version 1\.13\.11(?:\s|$)/);
    nativeProcess = spawn(nativeBinary, ['--config', config], { env: { PATH: process.env.PATH }, stdio: 'ignore' });
    let nativeError;
    nativeProcess.once('error', error => {
      nativeError = error;
    });
    const url = `http://127.0.0.1:${nativeWsPort}`;
    loopbackUrl(url);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (nativeError) throw nativeError;
      if (nativeProcess.exitCode !== null) throw new Error('SFU exited before readiness');
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(200);
    }
    assert.ok(ready, 'SFU readiness timeout');
    const roomName = name;
    const service = new RoomServiceClient(url, apiKey, apiSecret);
    await service.createRoom({ name: roomName, emptyTimeout: 10, maxParticipants: 30 });
    async function token(identity, host = false) {
      const access = new AccessToken(apiKey, apiSecret, { identity, ttl: '5m' });
      access.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: host,
        canSubscribe: !host,
        canPublishData: false,
        ...(host ? { canPublishSources: [TrackSource.MICROPHONE] } : {})
      });
      return access.toJwt();
    }
    const credentials = {
      host: await token('synthetic-host', true),
      guests: await Promise.all(Array.from({ length: 25 }, (_, i) => token(`synthetic-guest-${i}`)))
    };
    const require = createRequire(import.meta.url);
    const sdkRoot = dirname(require.resolve('livekit-client'));
    const sdk = await readFile(join(sdkRoot, 'livekit-client.umd.js'));
    http = createServer((request, response) => {
      if (request.url === '/sdk.js') {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.end(sdk);
      } else {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<!doctype html><script src="/sdk.js"></script>');
      }
    });
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
    const page = await browser.newPage();
    await page.exposeFunction('verifyServerGrants', async () => {
      const participants = await service.listParticipants(roomName);
      const host = participants.find(p => p.identity === 'synthetic-host');
      const guests = participants.filter(p => p.identity.startsWith('synthetic-guest-'));
      assert.equal(participants.length, 26);
      assert.equal(host.permission.canPublish, true);
      assert.equal(guests.length, 25);
      assert.ok(guests.every(p => !p.permission.canPublish && !p.permission.canPublishData && p.permission.canSubscribe));
      return { participants: participants.length, hostPublishers: 1, subscribeOnlyGuests: guests.length };
    });
    await page.goto(`http://127.0.0.1:${http.address().port}`);
    const measured = await page.evaluate(
      async ({ url, credentials }) => {
        const { Room, RoomEvent, Track, setLogLevel, LogLevel } = window.LivekitClient;
        setLogLevel(LogLevel.silent);
        const options = { adaptiveStream: false, dynacast: false, disconnectOnPageLeave: false };
        const connectOptions = { rtcConfig: { iceServers: [] } };
        const host = new Room(options),
          guests = [];
        const received = new Map();
        const began = performance.now();
        const audio = new AudioContext({ sampleRate: 48000 });
        await audio.resume();
        const source = audio.createOscillator();
        const gain = audio.createGain();
        gain.gain.value = 0.15;
        const destination = audio.createMediaStreamDestination();
        source.connect(gain).connect(destination);
        source.start();
        try {
          await host.connect(url, credentials.host, connectOptions);
          const localTrack = destination.stream.getAudioTracks()[0];
          const publication = await host.localParticipant.publishTrack(localTrack, {
            source: Track.Source.Microphone,
            name: 'synthetic-tone',
            dtx: false,
            red: false
          });
          for (let i = 0; i < credentials.guests.length; i++) {
            const guest = new Room(options);
            guests.push(guest);
            guest.on(RoomEvent.TrackSubscribed, track => {
              if (track.kind === Track.Kind.Audio) {
                const element = track.attach();
                element.muted = true;
                document.body.appendChild(element);
                void element.play().catch(() => {});
                received.set(i, { track, at: performance.now() });
              }
            });
            await guest.connect(url, credentials.guests[i], connectOptions);
          }
          const deadline = performance.now() + 15000;
          while (received.size < 25 && performance.now() < deadline) await new Promise(r => setTimeout(r, 100));
          if (received.size !== 25) throw Error(`Only ${received.size}/25 guests subscribed`);
          await new Promise(r => setTimeout(r, 3000));
          const receivers = [];
          for (const [id, { track, at }] of received) {
            const report = await track.getRTCStatsReport();
            const inbound = [...report.values()].filter(s => s.type === 'inbound-rtp' && s.kind === 'audio');
            receivers.push({
              id,
              subscribedMs: at - began,
              packets: inbound.reduce((n, s) => n + (s.packetsReceived || 0), 0),
              bytes: inbound.reduce((n, s) => n + (s.bytesReceived || 0), 0),
              decodedSamples: inbound.reduce((n, s) => n + (s.totalSamplesReceived || 0), 0)
            });
          }
          let denied = false;
          try {
            await guests[0].localParticipant.publishTrack(localTrack.clone(), { source: Track.Source.Microphone });
          } catch {
            denied = true;
          }
          const serverGrants = await window.verifyServerGrants();
          const senderReport = await publication.track.getRTCStatsReport();
          const outbound = [...senderReport.values()].filter(s => s.type === 'outbound-rtp' && s.kind === 'audio');
          return {
            serverGrants,
            subscriberCount: received.size,
            receivers,
            guestPublishRejected: denied,
            hostOutboundAudioStreams: outbound.length,
            hostBytesSent: outbound.reduce((n, s) => n + (s.bytesSent || 0), 0),
            elapsedMs: performance.now() - began
          };
        } finally {
          await Promise.all(guests.map(g => g.disconnect()));
          await host.disconnect();
          source.stop();
          await audio.close();
        }
      },
      { url: url.replace('http:', 'ws:'), credentials }
    );
    assert.equal(measured.subscriberCount, 25);
    assert.ok(
      measured.receivers.every(r => r.packets > 0 && r.bytes > 0 && r.decodedSamples > 0),
      `Every guest must actually receive and decode RTP: ${JSON.stringify(measured.receivers)}`
    );
    assert.equal(measured.guestPublishRejected, true);
    assert.equal(measured.hostOutboundAudioStreams, 1);
    // JWT and independent server readback must agree with the tested browser grants.
    const claims = JSON.parse(Buffer.from(credentials.guests[0].split('.')[1], 'base64url').toString());
    assert.equal(claims.video.canPublish, false);
    assert.equal(claims.video.canPublishData, false);
    await service.deleteRoom(roomName);
    return {
      state: 'passed',
      serverVersion: '1.13.11',
      serverMode: 'native',
      binarySha256: createHash('sha256')
        .update(await readFile(nativeBinary))
        .digest('hex'),
      browser: browser.version(),
      transport: 'native loopback WebRTC; no WAN/TURN measurement',
      syntheticAudio: '440 Hz oscillator; no protected track/key/source or wallet',
      ...measured,
      guestGrant: { canPublish: false, canPublishData: false, canSubscribe: true },
      physicalAudibilityTested: false
    };
  } finally {
    await browser?.close();
    if (http) await new Promise(resolve => http.close(resolve));
    if (nativeProcess?.pid && nativeProcess.exitCode === null) {
      const exited = new Promise(resolve => nativeProcess.once('exit', resolve));
      nativeProcess.kill('SIGTERM');
      const timer = setTimeout(() => nativeProcess.kill('SIGKILL'), 3000);
      await exited;
      clearTimeout(timer);
    }
    await rm(directory, { recursive: true, force: true });
  }
}
