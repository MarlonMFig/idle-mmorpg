export async function getMultiplayerAuthToken(): Promise<string> {
  const response = await fetch('/api/multiplayer/token', {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
  };
  if (!response.ok || !body.token) {
    throw new Error(body.error || 'Não foi possível autenticar o multiplayer.');
  }
  return body.token;
}
