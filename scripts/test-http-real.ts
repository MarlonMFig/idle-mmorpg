import assert from 'node:assert/strict';

const baseUrl = (process.env.HTTP_TEST_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const username = process.env.HTTP_TEST_USERNAME || process.env.HTTP_TEST_EMAIL;
const password = process.env.HTTP_TEST_PASSWORD;

if (!username || !password) {
  throw new Error('HTTP_TEST_USERNAME (ou HTTP_TEST_EMAIL) e HTTP_TEST_PASSWORD são obrigatórios.');
}

let cookie = '';

function updateCookie(response: Response): void {
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie')!]
        : [];
  const values = setCookies.map((value) => value.split(';', 1)[0]).filter(Boolean);
  if (values.length > 0) cookie = values.join('; ');
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  updateCookie(response);
  return response;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

const signUp = await request('/api/auth/sign-up', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password, name: 'HTTP Test' }),
});
assert.ok([200, 400, 409, 422].includes(signUp.status), `signup HTTP ${signUp.status}`);

const signIn = await request('/api/auth/sign-in', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
const signInBody = await json(signIn);
assert.equal(signIn.status, 200, `signin HTTP ${signIn.status}: ${JSON.stringify(signInBody)}`);
assert.ok(cookie, 'login não retornou cookie de sessão');

const payload = {
  version: 13,
  player: { nickname: 'HTTP Test', villageId: 'konoha', starterCharacterId: 'naruto-classic' },
};
const savePut = await request('/api/social/save', {
  method: 'PUT',
  headers: { 'content-type': 'application/json', origin: baseUrl },
  body: JSON.stringify({ payload }),
});
const savePutBody = await json(savePut);
assert.equal(
  savePut.status,
  200,
  `save PUT HTTP ${savePut.status}: ${JSON.stringify(savePutBody)}`,
);

const saveGet = await request('/api/social/save');
const saveGetBody = await json(saveGet);
assert.equal(saveGet.status, 200, `save GET HTTP ${saveGet.status}`);
assert.equal((saveGetBody.save as { payload?: unknown } | undefined)?.payload !== undefined, true);

let rateLimited = false;
for (let i = 0; i < 40; i += 1) {
  const response = await request('/api/social/save');
  if (response.status === 429) {
    rateLimited = true;
    break;
  }
}
assert.equal(rateLimited, true, 'rate limit HTTP não foi acionado');
console.info('[http-real] auth, cloud save e rate limit: OK');
