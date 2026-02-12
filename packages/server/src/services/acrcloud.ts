import crypto from 'crypto';
import fs from 'fs';

export interface ACRCloudResult {
  title: string;
  artist: string;
  album: string;
  duration: number;
  releaseDate: string;
  externalIds: {
    isrc?: string;
    upc?: string;
  };
}

function buildStringToSign(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  signatureVersion: string,
  timestamp: number
): string {
  return [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
}

function sign(stringToSign: string, accessSecret: string): string {
  return crypto
    .createHmac('sha1', accessSecret)
    .update(Buffer.from(stringToSign, 'utf-8'))
    .digest('base64');
}

export async function identifyWithACRCloud(
  audioFilePath: string
): Promise<ACRCloudResult | null> {
  const host = process.env.ACRCLOUD_HOST;
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

  if (!host || !accessKey || !accessSecret) {
    throw new Error('ACRCloud credentials not configured (ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET)');
  }

  const endpoint = '/v1/identify';
  const timestamp = Math.floor(Date.now() / 1000);
  const dataType = 'audio';
  const signatureVersion = '1';

  const stringToSign = buildStringToSign(
    'POST',
    endpoint,
    accessKey,
    dataType,
    signatureVersion,
    timestamp
  );

  const signature = sign(stringToSign, accessSecret);

  const audioData = await fs.promises.readFile(audioFilePath);
  console.log(`[acrcloud] Sending ${(audioData.length / 1024).toFixed(0)}KB audio for identification...`);

  const formData = new FormData();
  formData.append('sample', new Blob([audioData]), 'sample.wav');
  formData.append('sample_bytes', String(audioData.length));
  formData.append('access_key', accessKey);
  formData.append('data_type', dataType);
  formData.append('signature_version', signatureVersion);
  formData.append('signature', signature);
  formData.append('timestamp', String(timestamp));

  const url = `https://${host}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`ACRCloud HTTP error: ${res.status}`);
  }

  const data = (await res.json()) as {
    status: { code: number; msg: string };
    metadata?: {
      music?: Array<{
        title: string;
        artists?: Array<{ name: string }>;
        album?: { name: string };
        duration_ms?: number;
        release_date?: string;
        external_ids?: { isrc?: string; upc?: string };
      }>;
    };
  };

  console.log(`[acrcloud] Response: code=${data.status.code}, msg="${data.status.msg}"`);

  if (data.status.code !== 0) {
    // code 0 = success, 1001 = no result, others = errors
    if (data.status.code === 1001) {
      console.log('[acrcloud] No match found');
      return null;
    }
    console.warn(`[acrcloud] Error: ${data.status.msg}`);
    return null;
  }

  const music = data.metadata?.music;
  if (!music || music.length === 0) {
    return null;
  }

  const track = music[0];
  const result: ACRCloudResult = {
    title: track.title,
    artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist',
    album: track.album?.name || '',
    duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : 0,
    releaseDate: track.release_date || '',
    externalIds: {
      isrc: track.external_ids?.isrc,
      upc: track.external_ids?.upc,
    },
  };

  console.log(`[acrcloud] Match: "${result.title}" by ${result.artist}`);
  return result;
}
