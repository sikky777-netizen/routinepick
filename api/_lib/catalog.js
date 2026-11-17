import { get, put } from '@vercel/blob';

const PATH = 'routinepick/catalog.json';
const HISTORY = 'routinepick/search-usage.json';
const opts = { access: 'private' };

function assertStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_NOT_CONFIGURED');
}

async function readJson(path, fallback) {
  assertStore();
  const blob = await get(path, opts);
  if (!blob) return fallback;
  const raw = await new Response(blob.stream).text();
  return JSON.parse(raw);
}

async function writeJson(path, data) {
  assertStore();
  await put(path, JSON.stringify(data), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}

export async function readCatalog() {
  const value = await readJson(PATH, { products: [], version: 0 });
  return { products: Array.isArray(value.products) ? value.products : [], version: Number(value.version) || 0 };
}

export async function writeCatalog(catalog) {
  if (catalog.products.length > 250) throw new Error('INVALID_PRODUCT');
  await writeJson(PATH, { ...catalog, updatedAt: new Date().toISOString() });
}

export async function reserveSearch() {
  const now = Date.now();
  const history = await readJson(HISTORY, { timestamps: [] });
  const recent = (history.timestamps || []).filter(t => typeof t === 'number' && now - t < 3600000);
  // Conservative guard under the guide's ten searches per hour. This is
  // best-effort for a single admin, not an atomic distributed rate limiter.
  if (recent.length >= 8) throw new Error('SEARCH_LIMIT');
  recent.push(now);
  await writeJson(HISTORY, { timestamps: recent });
  return 8 - recent.length;
}
