import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs the real sw-template.js against a tiny in-memory Cache Storage / fetch.
const SOURCE = readFileSync(resolve(__dirname, '../../sw-template.js'), 'utf8');
const ORIGIN = 'https://kamisado.test';
const keyOf = (r: unknown) => new URL(typeof r === 'string' ? r : (r as { url: string }).url, ORIGIN).pathname;

type Handler = (event: any) => void;

function bootSw(version: string, files: string[], stores: Map<string, Map<string, Response>>, network: (url: string) => Promise<Response>) {
  const handlers: Record<string, Handler> = {};
  const puts: string[] = [];
  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name)!;
    return {
      put: async (req: unknown, res: Response) => {
        puts.push(`${name}:${keyOf(req)}`);
        map.set(keyOf(req), res);
      },
      match: async (req: unknown) => map.get(keyOf(req))?.clone(),
      addAll: async (urls: string[]) => {
        for (const u of urls) map.set(keyOf(u), await network(u));
      },
    };
  };
  const caches = {
    open: async (n: string) => cacheOf(n),
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (req: unknown) => {
      for (const map of stores.values()) {
        const hit = map.get(keyOf(req));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const fetchFn = (req: { url: string }) => network(req.url);
  const source = SOURCE.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files));
  new Function('self', 'caches', 'fetch', 'URL', source)(self, caches, fetchFn, URL);

  const run = async (type: string, event: any) => {
    handlers[type]!(event);
    await Promise.all(event.waits ?? []);
  };
  const fetchEvent = (url: string, mode: string) => {
    const event: any = { request: { method: 'GET', url: ORIGIN + url, mode }, waits: [] as Promise<unknown>[], response: undefined as Promise<Response> | undefined };
    event.respondWith = (p: Promise<Response>) => (event.response = p);
    event.waitUntil = (p: Promise<unknown>) => event.waits.push(p);
    return event;
  };
  return { handlers, puts, run, fetchEvent, install: () => run('install', { waits: [], waitUntil(p: Promise<unknown>) { this.waits.push(p); } }), activate: () => run('activate', { waits: [], waitUntil(p: Promise<unknown>) { this.waits.push(p); } }) };
}

// a same-origin network response, as the browser hands it to a service worker
const page = (body: string, status = 200) => {
  const res = new Response(body, { status });
  Object.defineProperty(res, 'type', { value: 'basic' });
  return res;
};

describe('service worker', () => {
  it('never lets an error page replace the cached app shell', async () => {
    const stores = new Map<string, Map<string, Response>>();
    let online = true;
    let status = 200;
    const sw = bootSw('aaa', ['/index.html'], stores, async (url) => {
      if (!online) throw new TypeError('offline');
      return page(status === 200 ? 'GOOD SHELL' : 'BAD GATEWAY', status);
    });
    await sw.install();

    // a healthy navigation refreshes the shell
    let ev = sw.fetchEvent('/play', 'navigate');
    sw.handlers.fetch!(ev);
    expect(await (await ev.response).text()).toBe('GOOD SHELL');
    await Promise.all(ev.waits);
    expect(sw.puts).toContain('kamisado-aaa:/index.html');

    // a 502 navigation is passed through but must not be cached
    const before = sw.puts.length;
    status = 502;
    ev = sw.fetchEvent('/play', 'navigate');
    sw.handlers.fetch!(ev);
    expect((await ev.response).status).toBe(502);
    await Promise.all(ev.waits);
    expect(sw.puts.length).toBe(before);

    // offline: the good shell is served, not the 502
    online = false;
    ev = sw.fetchEvent('/campaign', 'navigate');
    sw.handlers.fetch!(ev);
    expect(await (await ev.response).text()).toBe('GOOD SHELL');
  });

  it('does not cache a cross-origin or opaque navigation result either', async () => {
    const stores = new Map<string, Map<string, Response>>();
    const sw = bootSw('bbb', ['/index.html'], stores, async () => {
      const res = new Response('portal', { status: 200 });
      Object.defineProperty(res, 'type', { value: 'opaque' });
      return res;
    });
    await sw.install();
    sw.puts.length = 0;
    const ev = sw.fetchEvent('/play', 'navigate');
    sw.handlers.fetch!(ev);
    await ev.response;
    await Promise.all(ev.waits);
    expect(sw.puts).toEqual([]);
  });

  it('offline navigations use this build\'s shell, not an older generation\'s', async () => {
    const stores = new Map<string, Map<string, Response>>();
    stores.set('kamisado-0old', new Map([['/index.html', page('OLD SHELL')]]));
    let online = true;
    const sw = bootSw('new', ['/index.html'], stores, async () => {
      if (!online) throw new TypeError('offline');
      return page('NEW SHELL');
    });
    await sw.install();
    online = false;
    const ev = sw.fetchEvent('/play', 'navigate');
    sw.handlers.fetch!(ev);
    expect(await (await ev.response).text()).toBe('NEW SHELL');
  });

  it('keeps only the newest previous cache so a tab on the old build can still load its lazy files', async () => {
    const stores = new Map<string, Map<string, Response>>();
    stores.set('kamisado-0a', new Map([['/assets/old1.js', page('1')]]));
    stores.set('kamisado-0b', new Map([['/assets/botWorker-old.js', page('worker')]]));
    stores.set('unrelated-cache', new Map());
    const sw = bootSw('0c', ['/index.html'], stores, async () => page('x'));
    await sw.install();
    await sw.activate();
    expect([...stores.keys()].sort()).toEqual(['kamisado-0b', 'kamisado-0c', 'unrelated-cache']);

    // the old build's worker script is still found (cache-first across generations)
    const ev = sw.fetchEvent('/assets/botWorker-old.js', 'no-cors');
    sw.handlers.fetch!(ev);
    expect(await (await ev.response).text()).toBe('worker');
  });

  it('ignores non-GET and cross-origin requests', async () => {
    const sw = bootSw('z', ['/index.html'], new Map(), async () => page('x'));
    await sw.install();
    const post: any = { request: { method: 'POST', url: ORIGIN + '/api', mode: 'cors' }, respondWith: () => { throw new Error('should not respond'); }, waitUntil: () => undefined };
    sw.handlers.fetch!(post);
    const cross: any = { request: { method: 'GET', url: 'https://fonts.example/x.css', mode: 'no-cors' }, respondWith: () => { throw new Error('should not respond'); }, waitUntil: () => undefined };
    sw.handlers.fetch!(cross);
  });
});
