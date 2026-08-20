const configuredBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const url = `${configuredBase}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export function getApiBase() {
  return configuredBase;
}
