function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function searchMusicVideo(
  artist: string,
  title: string
): Promise<string | null> {
  const params = new URLSearchParams({
    artist,
    title,
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(`/api/video/search?${params}`);
      if (!res.ok) return null;

      const data = await res.json();
      return data.videoId || null;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  console.warn('[videoApi] Failed after retries:', lastError);
  return null;
}
