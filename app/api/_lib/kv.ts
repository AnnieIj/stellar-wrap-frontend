/**
 * Shared KV storage abstraction for serverless routes.
 *
 * Uses Vercel KV (@vercel/kv) when the environment variables are present,
 * falling back to a lightweight in-process Map for local development and tests.
 *
 * Install Vercel KV when deploying:
 *   pnpm add @vercel/kv   (or yarn add @vercel/kv)
 * Then set KV_REST_API_URL and KV_REST_API_TOKEN in your environment.
 */

// ─── In-process fallback (dev / test) ────────────────────────────────────────

const store = new Map<string, unknown>();

export const localKv = {
  async get<T>(key: string): Promise<T | null> {
    return (store.get(key) as T) ?? null;
  },
  async set(key: string, value: unknown): Promise<void> {
    store.set(key, value);
  },
  async del(key: string): Promise<void> {
    store.delete(key);
  },
  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace("*", "");
    return [...store.keys()].filter((k) => k.startsWith(prefix));
  },
  async sadd(key: string, member: string): Promise<number> {
    const existing = store.get(key);
    const members = existing instanceof Set ? existing : new Set<string>();
    const sizeBefore = members.size;
    members.add(member);
    store.set(key, members);
    return members.size - sizeBefore;
  },
  async srem(key: string, member: string): Promise<number> {
    const existing = store.get(key);
    if (!(existing instanceof Set)) return 0;
    return existing.delete(member) ? 1 : 0;
  },
  clear(): void {
    store.clear();
  },
};

// Lazy-import so the package is optional at build time
async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const mod = await import("@vercel/kv");
    return mod.kv;
  }
  return localKv;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  return kv.get<T>(key);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const kv = await getKv();
  await kv.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const kv = await getKv();
  await kv.del(key);
}

export async function kvKeys(pattern: string): Promise<string[]> {
  const kv = await getKv();
  return kv.keys(pattern);
}

export async function kvSAdd(key: string, member: string): Promise<void> {
  const kv = await getKv();
  await kv.sadd(key, member);
}

export async function kvSRem(key: string, member: string): Promise<void> {
  const kv = await getKv();
  await kv.srem(key, member);
}

export function kvReset(): void {
  store.clear();
}
