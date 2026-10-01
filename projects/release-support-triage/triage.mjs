export const RELEASE_URL = 'https://api.github.com/repos/n8n-io/n8n/releases/latest';
export class IntegrationError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// Release descriptions are untrusted and intentionally omitted from the draft.
export function normalizeRelease(body) {
  if (!body || typeof body !== 'object' || !Number.isSafeInteger(body.id) || body.id < 1
      || typeof body.tag_name !== 'string' || body.tag_name.length > 100
      || !/^n8n@\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(body.tag_name)
      || body.draft !== false || body.prerelease !== false
      || typeof body.published_at !== 'string' || !Number.isFinite(Date.parse(body.published_at))) throw new IntegrationError('invalid_release');
  const expected = `https://github.com/n8n-io/n8n/releases/tag/${encodeURIComponent(body.tag_name)}`;
  let url;
  try { url = new URL(body.html_url); } catch { throw new IntegrationError('invalid_release_url'); }
  if (url.href !== expected && url.href !== expected.replace('%40', '@')) throw new IntegrationError('invalid_release_url');
  return { id: body.id, version: body.tag_name.slice(4), publishedAt: body.published_at, url: url.href };
}

export async function fetchRelease({ fetchImpl = fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)), timeoutMs = 6000, attempts = 3 } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3 || timeoutMs < 1 || timeoutMs > 10000) throw new IntegrationError('invalid_options');
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(RELEASE_URL, { method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Nico-Joschke-Portfolio-Demo' } });
      if ((response.status === 429 || response.status >= 500) && attempt < attempts - 1) {
        const seconds = Number(response.headers.get('retry-after') ?? (attempt + 1));
        await response.body?.cancel();
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3) throw new IntegrationError('retry_deferred');
        clearTimeout(timer); await sleep(seconds * 1000); continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new IntegrationError(response.status === 403 || response.status === 429 ? 'rate_limited' : 'http_error');
      }
      if (Number(response.headers.get('content-length')) > 256000) { await response.body?.cancel(); throw new IntegrationError('response_too_large'); }
      const reader = response.body.getReader(); let length = 0; const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          length += value.byteLength;
          if (length > 256000) { await reader.cancel(); throw new IntegrationError('response_too_large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let data;
      try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new IntegrationError('invalid_json'); }
      return normalizeRelease(data);
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      const code = controller.signal.aborted ? 'timeout' : 'network_error';
      if (attempt === attempts - 1) throw new IntegrationError(code);
      clearTimeout(timer); await sleep((attempt + 1) * 250);
    } finally { clearTimeout(timer); }
  }
}

export function validateTicket(ticket) {
  if (!ticket || typeof ticket !== 'object' || Array.isArray(ticket)
      || Object.keys(ticket).some(k => !['id', 'product', 'category', 'installedVersion'].includes(k))
      || typeof ticket.id !== 'string' || !/^synthetic-[a-z0-9-]{1,50}$/.test(ticket.id)
      || ticket.product !== 'n8n' || !['update-question', 'incident'].includes(ticket.category)
      || typeof ticket.installedVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(ticket.installedVersion)) throw new IntegrationError('invalid_ticket');
}

export function prepareDraft(ticket, release) {
  validateTicket(ticket);
  const installed = ticket.installedVersion.split('.').map(Number), latest = release.version.split('-')[0].split('.').map(Number);
  let comparison = 0;
  for (let i = 0; i < 3; i++) if (installed[i] !== latest[i]) { comparison = Math.sign(latest[i] - installed[i]); break; }
  return { status: 'awaiting-human-review', ticketId: ticket.id, priority: ticket.category === 'incident' ? 'manual-incident-review' : 'normal',
    versionStatus: comparison > 0 ? 'newer-release-available' : comparison === 0 ? 'same-version' : 'installed-ahead-of-latest-stable',
    installedVersion: ticket.installedVersion, latestRelease: release,
    draft: 'Release-Hinweise und Kompatibilität prüfen; Änderungen zuerst in einer getrennten Testumgebung testen. Keine automatische Update-Empfehlung.',
    executionGate: false, externalActions: { messagesSent: 0, ticketsChanged: 0, updatesInstalled: 0 } };
}

// Demo-only, bounded, process-local deduplication. A restart clears the cache.
export function createTriage({ loadRelease = fetchRelease, maxEntries = 100 } = {}) {
  const cache = new Map();
  return async ticket => {
    validateTicket(ticket);
    const key = JSON.stringify([ticket.product, ticket.category, ticket.installedVersion]);
    if (cache.has(ticket.id)) {
      const saved = cache.get(ticket.id);
      if (saved.key !== key) throw new IntegrationError('idempotency_conflict');
      return { ...(await saved.promise), status: 'duplicate', cached: true };
    }
    if (cache.size >= maxEntries) throw new IntegrationError('demo_capacity_reached');
    const promise = Promise.resolve().then(loadRelease).then(release => prepareDraft(ticket, release));
    cache.set(ticket.id, { key, promise });
    try { return await promise; } catch (error) { cache.delete(ticket.id); throw error; }
  };
}
