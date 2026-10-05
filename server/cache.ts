type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  etag?: string;
  lastModified?: string;
  inFlight?: Promise<CacheEntry<T>>;
  status: "fresh" | "stale" | "error";
  error?: string;
};

export class HttpCache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly ttlMs: number) {}

  async getJson<T>(url: string, schemaParse: (value: unknown) => T): Promise<CacheEntry<T> & { url: string; collectedAt: string }> {
    const now = Date.now();
    const current = this.store.get(url) as CacheEntry<T> | undefined;
    if (current?.value && current.expiresAt > now) {
      return { ...current, url, collectedAt: new Date().toISOString() };
    }
    if (current?.inFlight) {
      const shared = await current.inFlight;
      return { ...(shared as CacheEntry<T>), url, collectedAt: new Date().toISOString() };
    }

    const request = this.fetchJson(url, schemaParse, current);
    this.store.set(url, { ...current, expiresAt: now + this.ttlMs, inFlight: request, status: current?.status ?? "stale" });
    const entry = await request;
    this.store.set(url, entry);
    return { ...entry, url, collectedAt: new Date().toISOString() };
  }

  private async fetchJson<T>(url: string, schemaParse: (value: unknown) => T, previous?: CacheEntry<T>): Promise<CacheEntry<T>> {
    const headers: Record<string, string> = {};
    if (previous?.etag) headers["If-None-Match"] = previous.etag;
    if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
      if (response.status === 304 && previous?.value) {
        return { ...previous, expiresAt: Date.now() + this.ttlMs, status: "fresh" };
      }
      if (response.status === 404) {
        if (previous?.value) {
          return { ...previous, expiresAt: Date.now() + Math.max(this.ttlMs, 120000), status: "stale", error: "Arquivo ainda nao gerado ou URL invalida (404)" };
        }
        throw new Error("Arquivo ainda nao gerado ou URL invalida (404)");
      }
      if (!response.ok) {
        throw new Error(`Fonte oficial indisponivel: HTTP ${response.status}`);
      }
      const body = schemaParse(await response.json());
      return {
        value: body,
        expiresAt: Date.now() + this.ttlMs,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
        status: "fresh"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro de rede";
      if (previous?.value) {
        return { ...previous, expiresAt: Date.now() + Math.max(this.ttlMs, 60000), status: "stale", error: message };
      }
      throw new Error(message);
    }
  }
}
