export interface Cdp {
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>;
  next(method: string, sessionId: string | undefined, timeout: number): Waiting;
  close(): void;
}

export type Waiting = Promise<Record<string, unknown>> & { cancel(): void };

interface Message {
  id?: number;
  method?: string;
  sessionId?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
}

export async function connect(endpoint: string): Promise<Cdp> {
  if (typeof WebSocket === 'undefined') throw new Error('layer-lens-audit needs Node 22 or later on the command line.');

  const socket = new WebSocket(endpoint);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to Chrome.')), { once: true });
  });

  let lastId = 0;
  const calls = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void; method: string }>();
  const waiters = new Set<(message: Message) => boolean>();
  const cancels = new Set<() => void>();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as Message;
    if (message.id !== undefined) {
      const call = calls.get(message.id);
      if (!call) return;
      calls.delete(message.id);
      if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`));
      else call.resolve(message.result ?? {});
      return;
    }
    for (const waiter of waiters) if (waiter(message)) waiters.delete(waiter);
  });

  socket.addEventListener('close', () => {
    for (const call of calls.values()) call.reject(new Error('Chrome closed the connection.'));
    calls.clear();
  });

  return {
    send<T>(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
      const id = ++lastId;
      return new Promise<T>((resolve, reject) => {
        calls.set(id, { resolve: resolve as (value: Record<string, unknown>) => void, reject, method });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    next(method, sessionId, timeout) {
      let cancel = () => {};
      const waiting = new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => {
          cancel();
          reject(new Error(`timed out waiting for ${method}.`));
        }, timeout);
        const waiter = (message: Message) => {
          if (message.method !== method || message.sessionId !== sessionId) return false;
          cancel();
          resolve(message.params ?? {});
          return true;
        };
        cancel = () => {
          clearTimeout(timer);
          waiters.delete(waiter);
          cancels.delete(cancel);
        };
        waiters.add(waiter);
        cancels.add(cancel);
      });
      return Object.assign(waiting, { cancel: () => cancel() });
    },
    close() {
      for (const cancel of [...cancels]) cancel();
      socket.close();
    }
  };
}
