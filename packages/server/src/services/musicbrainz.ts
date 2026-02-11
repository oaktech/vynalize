const MB_API_URL = 'https://musicbrainz.org/ws/2';
const CAA_URL = 'https://coverartarchive.org';
const USER_AGENT = 'VinylVisions/0.1.0 (https://github.com/vinyl-visions)';

// Rate limiting: MusicBrainz allows 1 req/sec
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
}

export interface EnrichedMetadata {
  bpm: number | null;
  albumArtUrl: string | null;
}

export async function enrichMetadata(
  musicbrainzId: string,
  releaseGroupId: string | null
): Promise<EnrichedMetadata> {
  const result: EnrichedMetadata = {
    bpm: null,
    albumArtUrl: null,
  };

  // Try to get album art from Cover Art Archive via release group
  if (releaseGroupId) {
    try {
      const caaUrl = `${CAA_URL}/release-group/${releaseGroupId}`;
      const res = await fetch(caaUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });

      if (res.ok) {
        const data = (await res.json()) as {
          images?: Array<{
            front: boolean;
            image: string;
            thumbnails?: Record<string, string>;
          }>;
        };
        const front = data.images?.find((img) => img.front);
        if (front) {
          // Use 250px thumbnail for reasonable size
          result.albumArtUrl =
            front.thumbnails?.['250'] ||
            front.thumbnails?.small ||
            front.image;
        }
      }
    } catch (err) {
      console.warn('Cover Art Archive lookup failed:', err);
    }
  }

  // Try to get recording details from MusicBrainz
  try {
    const res = await rateLimitedFetch(
      `${MB_API_URL}/recording/${musicbrainzId}?fmt=json`
    );

    if (res.ok) {
      const data = await res.json();
      // MusicBrainz doesn't directly store BPM but we tried
      // Some tags might have it in the future
    }
  } catch (err) {
    console.warn('MusicBrainz recording lookup failed:', err);
  }

  return result;
}
