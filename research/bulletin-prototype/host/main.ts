import { mountPlayer } from './player';
mountPlayer({
  async loadSession(signal) {
    const response = await fetch('/canary/session', { signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Local generated fixture unavailable');
    return response.json();
  },
  async readControlBlock(cid, signal) {
    const response = await fetch(`/canary/block/${cid}`, { signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Local control block unavailable');
    return new Uint8Array(await response.arrayBuffer());
  }
});
