let cachedClientIpPromise = null;

const getClientPublicIp = async () => {
  if (!cachedClientIpPromise) {
    cachedClientIpPromise = fetch('https://api.ipify.org?format=json')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to detect public IP');
        }
        return res.json();
      })
      .then((data) => String(data?.ip || '').trim())
      .catch(() => '');
  }

  return cachedClientIpPromise;
};

const buildClientIpHeaders = async () => {
  const ip = await getClientPublicIp();
  return ip ? { 'x-client-public-ip': ip } : {};
};

export { buildClientIpHeaders, getClientPublicIp };
