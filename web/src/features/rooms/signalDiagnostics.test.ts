import { describe, expect, it, vi } from 'vitest';
import { diagnoseSignalFailure, explainSignalFailure } from './signalDiagnostics';

const SIGNAL_URL = 'https://dotify-signal.example';
const HOST_ORIGIN = 'https://dotify-test01.dev-dot.li';

describe('explainSignalFailure', () => {
  it('names the rejected origin when the server allowlist excludes it', () => {
    const reason = explainSignalFailure({ ok: true, allowedOrigins: ['https://muzinga.netlify.app'] }, HOST_ORIGIN);

    expect(reason).toContain(HOST_ORIGIN);
    expect(reason).toContain('SIGNAL_ORIGINS');
  });

  it('ignores a trailing slash when comparing origins', () => {
    const reason = explainSignalFailure({ ok: true, allowedOrigins: ['https://muzinga.netlify.app/'] }, 'https://muzinga.netlify.app');

    expect(reason).toBe('Room service unavailable.');
  });

  it('does not blame configuration when the origin is allowed', () => {
    const reason = explainSignalFailure({ ok: true, allowedOrigins: [HOST_ORIGIN] }, HOST_ORIGIN);

    expect(reason).toBe('Room service unavailable.');
  });

  it('does not blame configuration on a wildcard allowlist', () => {
    const reason = explainSignalFailure({ ok: true, allowedOrigins: '*' }, HOST_ORIGIN);

    expect(reason).toBe('Room service unavailable.');
  });

  it('reports an unreachable server rather than an origin problem', () => {
    const reason = explainSignalFailure(null, HOST_ORIGIN);

    expect(reason).toContain('did not answer');
    expect(reason).toContain(HOST_ORIGIN);
    expect(reason).toContain('SIGNAL_ORIGINS');
  });

  it('does not recommend allowlisting literal null origins', () => {
    const reason = explainSignalFailure(null, 'null');

    expect(reason).toContain('opaque Product host origin');
    expect(reason).toContain('Fly signaling logs');
    expect(reason).not.toContain('Add that origin');
  });
});

describe('diagnoseSignalFailure', () => {
  it('reads the health endpoint and explains an origin rejection', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, allowedOrigins: ['https://muzinga.netlify.app'] })));

    const reason = await diagnoseSignalFailure(SIGNAL_URL, HOST_ORIGIN, { fetchImpl: fetchMock });

    expect(fetchMock.mock.calls[0][0]).toBe('https://dotify-signal.example/health');
    expect(reason).toContain(HOST_ORIGIN);
  });

  it('falls back to the generic reason when health cannot be read', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    const reason = await diagnoseSignalFailure(SIGNAL_URL, HOST_ORIGIN, { fetchImpl: fetchMock });

    expect(reason).toContain('Room service unavailable.');
    expect(reason).toContain('did not answer');
  });

  it('falls back when health returns a non-ok status', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 502 }));

    const reason = await diagnoseSignalFailure(SIGNAL_URL, HOST_ORIGIN, { fetchImpl: fetchMock });

    expect(reason).toContain('did not answer');
  });

  it('rejects nothing when the signal URL is unusable', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const reason = await diagnoseSignalFailure('not a url', HOST_ORIGIN, { fetchImpl: fetchMock });

    expect(reason).toContain('not valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
