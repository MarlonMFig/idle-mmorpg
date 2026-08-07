import type {
  WonsrCatalogMap,
  WonsrCatalogName,
  WonsrManifest,
} from '@/types/wonsr';

const BASE_URL = '/data/wonsr';
const cache = new Map<WonsrCatalogName, readonly unknown[]>();
let manifestCache: WonsrManifest | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar catálogo WONSR: ${response.status} ${url}`);
  }
  return response.json() as Promise<T>;
}

/** Metadados e contagens dos dados importados do WONSR. */
export async function loadWonsrManifest(): Promise<WonsrManifest> {
  if (manifestCache) return manifestCache;
  manifestCache = await fetchJson<WonsrManifest>(`${BASE_URL}/manifest.json`);
  return manifestCache;
}

/**
 * Carrega um catálogo sob demanda. Itens/monstros não entram no bundle inicial,
 * evitando transferir milhares de registros para quem só está no hub.
 */
export async function loadWonsrCatalog<K extends WonsrCatalogName>(
  name: K,
): Promise<readonly WonsrCatalogMap[K][]> {
  const cached = cache.get(name);
  if (cached) return cached as readonly WonsrCatalogMap[K][];

  const catalog = await fetchJson<WonsrCatalogMap[K][]>(`${BASE_URL}/${name}.json`);
  cache.set(name, catalog);
  return catalog;
}

export function clearWonsrCatalogCache(): void {
  cache.clear();
  manifestCache = null;
}
