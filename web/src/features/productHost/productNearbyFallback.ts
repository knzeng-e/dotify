/** Open discovery separately, without joining a room or transferring Host authority. */
export function productNearbyBrowserUrl(publicAppUrl: string | undefined): string | null {
  if (!publicAppUrl) return null;
  try {
    const url = new URL(publicAppUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.search = '';
    url.hash = '/rooms';
    return url.toString();
  } catch {
    return null;
  }
}
