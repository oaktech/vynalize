import { Router } from 'express';
import { readFile, writeFile, rename } from 'fs/promises';
import { resolve } from 'path';
import { execFile } from 'child_process';

export const updateRouter = Router();

/**
 * Paths resolve relative to the running working directory.
 * In production (Pi), the service runs from ~/vynalize/current,
 * so ../../shared is ~/vynalize/shared. In dev, these files may not exist.
 */
const SHARED_DIR = resolve(process.cwd(), '../../shared');
const UPDATE_JSON = resolve(SHARED_DIR, 'update.json');
const VERSION_FILE = resolve(process.cwd(), 'VERSION');
const UPDATER_SCRIPT = resolve(process.cwd(), '../../scripts/vynalize-updater.sh');

interface UpdateState {
  currentVersion: string;
  updateAvailable: string | null;
  status: 'idle' | 'checking' | 'downloading' | 'installing' | 'error';
  lastCheck: string | null;
  lastUpdate: string | null;
  channel: 'stable' | 'beta';
  error: string | null;
}

const DEFAULT_STATE: UpdateState = {
  currentVersion: '0.1.0',
  updateAvailable: null,
  status: 'idle',
  lastCheck: null,
  lastUpdate: null,
  channel: 'stable',
  error: null,
};

async function readVersion(): Promise<string> {
  try {
    return (await readFile(VERSION_FILE, 'utf-8')).trim();
  } catch {
    return '0.1.0';
  }
}

async function readUpdateState(): Promise<UpdateState> {
  try {
    const raw = await readFile(UPDATE_JSON, 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeUpdateState(state: Partial<UpdateState>): Promise<UpdateState> {
  const current = await readUpdateState();
  const merged = { ...current, ...state };
  const tmp = UPDATE_JSON + '.tmp';
  await writeFile(tmp, JSON.stringify(merged, null, 2) + '\n');
  await rename(tmp, UPDATE_JSON);
  return merged;
}

function runUpdater(subcommand: string): void {
  execFile('bash', [UPDATER_SCRIPT, subcommand], (err, _stdout, stderr) => {
    if (err) {
      console.error(`[update] updater ${subcommand} failed:`, stderr || err.message);
    }
  });
}

/** GET / — current update status + version */
updateRouter.get('/', async (_req, res) => {
  const [version, state] = await Promise.all([readVersion(), readUpdateState()]);
  res.json({ ...state, currentVersion: version });
});

/** POST /check — trigger a background check for updates */
updateRouter.post('/check', async (_req, res) => {
  await writeUpdateState({ status: 'checking', error: null });
  runUpdater('check');
  res.json({ status: 'checking' });
});

/** POST /apply — trigger a background full update cycle */
updateRouter.post('/apply', async (_req, res) => {
  await writeUpdateState({ status: 'downloading', error: null });
  runUpdater('auto');
  res.json({ status: 'downloading' });
});

/** PUT /channel — switch between stable and beta */
updateRouter.put('/channel', async (req, res) => {
  const { channel } = req.body ?? {};
  if (channel !== 'stable' && channel !== 'beta') {
    res.status(400).json({ error: 'channel must be "stable" or "beta"' });
    return;
  }
  const state = await writeUpdateState({ channel });
  res.json({ channel: state.channel });
});
