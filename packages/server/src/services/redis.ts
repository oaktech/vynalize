import Redis from 'ioredis';

let client: Redis | null = null;
let subscriber: Redis | null = null;
export let redisAvailable = false;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  client = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });

  const onReady = () => { redisAvailable = true; };
  const onError = (err: Error) => {
    console.error('[redis] Connection error:', err.message);
    redisAvailable = false;
  };

  client.on('ready', onReady);
  client.on('error', onError);
  subscriber.on('error', onError);
}

export async function connectRedis(): Promise<void> {
  if (!client || !subscriber) return;
  try {
    await Promise.all([client.connect(), subscriber.connect()]);
    console.log('[redis] Connected');
  } catch (err) {
    console.warn('[redis] Failed to connect:', (err as Error).message);
    redisAvailable = false;
  }
}

export function getRedis(): Redis | null {
  return redisAvailable ? client : null;
}

export function getSubscriber(): Redis | null {
  return redisAvailable ? subscriber : null;
}
