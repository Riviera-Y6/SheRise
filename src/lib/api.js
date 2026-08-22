import { supabase } from './supabase';

const configuredBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const url = `${configuredBase}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (!headers.Authorization && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // Public API requests should remain usable when no session exists.
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }

  return data;
}

export function getApiBase() {
  return configuredBase;
}
