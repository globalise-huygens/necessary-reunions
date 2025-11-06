export function getPathUrl(path: string): string {
  if (typeof window === 'undefined') {
    return `https://necessaryreunions.org/${path}`;
  }

  const currentHost = window.location.host;
  const protocol = currentHost.includes('localhost') ? 'http' : 'https';

  return `${protocol}://${currentHost}/${path}`;
}

export const urls = {
  viewer: () => getPathUrl('viewer'),
  gavoc: () => getPathUrl('gavoc'),
  gazetteer: () => getPathUrl('gazetteer'),
  main: () => {
    if (typeof window === 'undefined') {
      return 'https://necessaryreunions.org';
    }

    const currentHost = window.location.host;
    const protocol = currentHost.includes('localhost') ? 'http' : 'https';

    return `${protocol}://${currentHost}`;
  },
};
