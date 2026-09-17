/**
 * 从 fetch Response 解析 NDJSON 流（每行一个 JSON 对象）。
 *
 * 自动处理：
 * - 跨 chunk 边界（一行可能跨多个网络包）
 * - 末尾无换行
 * - AbortSignal 取消（yield 0 行后退出）
 */
export async function* parseNDJSON<T>(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) yield JSON.parse(line) as T;
      }
    }
    // 流末尾剩余内容作为最后一条
    const tail = buf.trim();
    if (tail) yield JSON.parse(tail) as T;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    throw e;
  }
}