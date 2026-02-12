const ACOUSTID_API_URL = 'https://api.acoustid.org/v2/lookup';

interface AcoustIDResult {
  id: string;
  recordings?: Array<{
    id: string;
    title: string;
    artists?: Array<{ id: string; name: string }>;
    duration?: number;
    releasegroups?: Array<{
      id: string;
      title: string;
      type: string;
    }>;
  }>;
}

export interface LookupResult {
  title: string;
  artist: string;
  album: string;
  duration: number;
  musicbrainzId: string;
  releaseGroupId: string | null;
}

export async function lookupFingerprint(
  fingerprint: string,
  duration: number
): Promise<LookupResult | null> {
  const apiKey = process.env.ACOUSTID_API_KEY;
  if (!apiKey) {
    throw new Error('ACOUSTID_API_KEY not configured');
  }

  const params = new URLSearchParams({
    client: apiKey,
    duration: String(duration),
    fingerprint,
    meta: 'recordings+releasegroups',
  });

  const res = await fetch(`${ACOUSTID_API_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`AcoustID API error: ${res.status}`);
  }

  const data = (await res.json()) as { status: string; results?: AcoustIDResult[]; error?: { message: string } };
  console.log(`[acoustid] Response status: ${data.status}, results: ${data.results?.length ?? 0}`);
  if (data.error) {
    console.error(`[acoustid] API error: ${data.error.message}`);
  }
  if (data.results?.length) {
    console.log(`[acoustid] Top result score: ${(data.results[0] as any).score}, recordings: ${data.results[0].recordings?.length ?? 0}`);
  }
  if (!data.results || data.results.length === 0) {
    return null;
  }

  // Find best result with recording info
  for (const result of data.results) {
    if (!result.recordings || result.recordings.length === 0) continue;

    const rec = result.recordings[0];
    const artist = rec.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
    const album = rec.releasegroups?.[0]?.title || '';
    const releaseGroupId = rec.releasegroups?.[0]?.id || null;

    return {
      title: rec.title,
      artist,
      album,
      duration: rec.duration || duration,
      musicbrainzId: rec.id,
      releaseGroupId,
    };
  }

  return null;
}
