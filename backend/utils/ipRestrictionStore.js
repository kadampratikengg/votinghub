const fs = require('fs/promises');
const path = require('path');

const STORE_FILE =
  process.env.IP_RESTRICTION_STORE_PATH ||
  path.join(__dirname, '..', 'data', 'ip-restrictions.json');

let writeQueue = Promise.resolve();

const normalizeIp = (value) =>
  String(value || '')
    .trim()
    .replace(/^::ffff:/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/^::1$/, '127.0.0.1')
    .replace(/^0:0:0:0:0:0:0:1$/, '127.0.0.1');

const ensureStoreDir = async () => {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
};

const readStore = async () => {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        'Failed to read IP restriction store:',
        error.message || error,
      );
    }
    return {};
  }
};

const writeStore = async (store) => {
  await ensureStoreDir();
  const tempFile = `${STORE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tempFile, STORE_FILE);
};

const enqueueWrite = (task) => {
  const next = writeQueue.then(task, task);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

const getIpRestrictionSettings = async (userId) => {
  if (!userId) return null;

  const store = await readStore();
  return store[String(userId)] || null;
};

const upsertIpRestrictionSettings = async (userId, settings = {}) => {
  if (!userId) return null;

  const normalizedSettings = {
    ipRestrictionEnabled: !!settings.ipRestrictionEnabled,
    // Support comma-separated list of allowed IPs. Normalize each entry.
    allowedIp: Array.isArray(settings.allowedIp)
      ? settings.allowedIp
          .map((v) => normalizeIp(v))
          .filter(Boolean)
          .join(',')
      : String(settings.allowedIp || '')
          .split(',')
          .map((v) => normalizeIp(v))
          .filter(Boolean)
          .join(','),
    updatedAt: new Date().toISOString(),
  };

  return enqueueWrite(async () => {
    const store = await readStore();
    store[String(userId)] = normalizedSettings;
    await writeStore(store);
    return normalizedSettings;
  });
};

module.exports = {
  getIpRestrictionSettings,
  upsertIpRestrictionSettings,
};
