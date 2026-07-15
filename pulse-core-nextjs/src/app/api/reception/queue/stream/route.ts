import { NextRequest } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { readReceptionQueueSnapshot } from '@/app/api/reception/queue/route';

export const runtime = 'nodejs';

const STREAM_INTERVAL_MS = 5000;
const encoder = new TextEncoder();

function sseData(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:queue',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return new Response(JSON.stringify({ error: 'Missing hospital context.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const hospitalId = guard.session.hospitalId;
  const service = req.nextUrl.searchParams.get('service');

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) {
          clearInterval(interval);
        }
        req.signal.removeEventListener('abort', onAbort);
        controller.close();
      };

      const onAbort = () => close();
      req.signal.addEventListener('abort', onAbort);

      const emitSnapshot = async () => {
        if (closed) return;
        try {
          const queue = await readReceptionQueueSnapshot(hospitalId, service);
          controller.enqueue(encoder.encode(sseData('queue', queue)));
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          try {
            if (!closed) {
              controller.enqueue(encoder.encode(sseData('error', { message: 'Failed to read queue.' })));
            }
          } catch {
            // Stream likely already closed by client disconnect.
          }
          close();
        }
      };

      void emitSnapshot();
      interval = setInterval(() => {
        void emitSnapshot();
      }, STREAM_INTERVAL_MS);
    },
    cancel() {
      // No-op: interval cleanup happens in abort handler.
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
