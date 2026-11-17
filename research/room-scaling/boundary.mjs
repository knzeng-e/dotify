// Research only: never accept a cloud endpoint, a wallet or a production secret.
export function loopbackUrl(value, protocols = ['http:', 'ws:', 'redis:']) {
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error('Only literal loopback endpoints without credentials are allowed');
  }
  return url;
}
export function percentile(values, fraction) {
  if (!values.length) throw new Error('No samples');
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
}
