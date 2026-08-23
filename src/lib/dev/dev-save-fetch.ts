export const DEV_SAVE_TIMEOUT_MS = 45_000;
export const DEV_SAVE_TIMEOUT_MESSAGE = 'Falha ao salvar: tempo limite excedido.';
export const DEV_SAVE_HTML_MESSAGE =
  'O Next recompilou no meio do save e devolveu HTML. Confirma de novo — o arquivo pode já ter sido gravado.';

export async function fetchDevSave(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEV_SAVE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(DEV_SAVE_TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function isHtmlBody(text: string): boolean {
  const t = text.trimStart().slice(0, 32).toLowerCase();
  return t.startsWith('<!') || t.startsWith('<html') || t.startsWith('<head');
}

/** Lê JSON de uma resposta DEV. HTML (HMR/404) vira erro legível, não SyntaxError. */
export async function parseDevSaveJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Resposta vazia (${res.status} ${res.statusText}).`);
  }
  if (isHtmlBody(text)) {
    throw new Error(DEV_SAVE_HTML_MESSAGE);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta inválida (${res.status}): ${text.slice(0, 160)}`);
  }
}

export async function fetchDevSaveJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 1,
): Promise<{ res: Response; json: T }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetchDevSave(input, init);
    try {
      const json = await parseDevSaveJson<T>(res);
      return { res, json };
    } catch (error) {
      lastError = error;
      const html =
        error instanceof Error && error.message === DEV_SAVE_HTML_MESSAGE;
      if (html && attempt < retries) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1200);
        });
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
