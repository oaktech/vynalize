export async function searchMusicVideo(
  artist: string,
  title: string
): Promise<string | null> {
  const params = new URLSearchParams({
    artist,
    title,
  });

  const res = await fetch(`/api/video/search?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  return data.videoId || null;
}
