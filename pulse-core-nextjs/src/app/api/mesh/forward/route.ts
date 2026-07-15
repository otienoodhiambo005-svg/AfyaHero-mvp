/**
 * Mesh Network Message Forwarding Endpoint
 * Implements multi-hop routing protocol for mesh messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { MeshNetworkManager, MeshMessage, MessagePriority } from '../../../../lib/mesh-network';
import { enforceApiGuard, readJsonBody, requireString, validateNumber } from '@/lib/api-security';

// Initialize mesh manager for server side
const meshManager = new MeshNetworkManager(`server-${process.pid || Math.random().toString(36)}`);

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:mesh:forward',
      requireAuth: false,
      requireTrustedOrigin: false,
    });
    if (guard.response) return guard.response;

    const configured = process.env.MESH_INTERNAL_TOKEN;
    const provided = request.headers.get('x-mesh-token');
    if (!configured || !provided || provided !== configured) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = await readJsonBody<Record<string, unknown>>(request);
    if (message instanceof NextResponse) return message;

    // Validate message structure
    const id = requireString(message.id, 'id', { min: 1, max: 128 });
    if (id instanceof NextResponse) return id;
      // Validate message type against allowed values
      const validTypes = ['data', 'heartbeat', 'routing', 'sync', 'ack'] as const;
      const typeResult = requireString(message.type, 'type', { 
        min: 1, 
        max: 16
      });
      if (typeResult instanceof NextResponse) return typeResult;
      const type = typeResult as typeof validTypes[number];
    const source = requireString(message.source, 'source', { min: 1, max: 128 });
    if (source instanceof NextResponse) return source;
    const destination = requireString(message.destination, 'destination', { min: 1, max: 128 });
    if (destination instanceof NextResponse) return destination;
    const hopCountResult = validateNumber(message.hopCount ?? 0, 'hopCount', { min: 0, max: 32, integer: true, defaultValue: 0 });
    if (hopCountResult instanceof NextResponse) return hopCountResult;

     // Construct proper MeshMessage with all required fields
     const meshMessage: MeshMessage = {
       id,
       type,
       source,
       destination,
       payload: message.payload || {},
       priority: message.priority as MessagePriority || 'normal',
       timestamp: message.timestamp ? Number(message.timestamp) : Date.now(),
       ttl: message.ttl ? Number(message.ttl) : 300,
       hopCount: hopCountResult,
       previousHop: message.previousHop as string || '',
       signature: message.signature as string || '',
     };
     
     // Route message through mesh
     const routed = meshManager.routeMessage(meshMessage);

    return NextResponse.json({
      success: routed,
      hopCount: hopCountResult,
      forwarded: routed && destination !== meshManager.nodeId,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to process mesh message' }, { status: 500 });
  }
}
