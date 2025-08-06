export function getSubdomainUrl(subdomain: string): string {
  if (typeof window === 'undefined') {
    return `https://${subdomain}.necessaryreunions.org`;
  }

  const currentHost = window.location.host;

  if (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) {
    const port = currentHost.includes(':') ? currentHost.split(':')[1] : '';
    const portSuffix = port ? `:${port}` : '';
    return `http://${subdomain}.localhost${portSuffix}`;
  } else if (currentHost.includes('necessaryreunions.org')) {
    return `https://${subdomain}.necessaryreunions.org`;
  } else {
    return `https://${subdomain}.necessaryreunions.org`;
  }
}

export const urls = {
  viewer: () => getSubdomainUrl('viewer'),
  gavoc: () => getSubdomainUrl('gavoc'),
  gazetteer: () => getSubdomainUrl('gazetteer'),
  main: () => {
    if (typeof window === 'undefined') {
      return 'https://necessaryreunions.org';
    }

    const currentHost = window.location.host;
    if (
      currentHost.includes('localhost') ||
      currentHost.includes('127.0.0.1')
    ) {
      return `http://${currentHost.replace(/^[^.]+\./, '')}`;
    }
    return 'https://necessaryreunions.org';
  },
};
