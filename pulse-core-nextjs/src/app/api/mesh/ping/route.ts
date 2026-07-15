/**
 * Mesh Network Ping Endpoint
 * Used for peer health checks and latency measurement
 */

import { NextRequest, NextResponse } from 'next/server';

function isMeshAuthorized(request: NextRequest): boolean {
  const configured = process.env.MESH_INTERNAL_TOKEN;
  if (!configured) return false;
  const provided = request.headers.get('x-mesh-token');
  return Boolean(provided && provided === configured);
}

export async function HEAD(request: NextRequest) {
  if (!isMeshAuthorized(request)) {
    return new NextResponse(null, { status: 401 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Mesh-Node': 'afyahero-mesh',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isMeshAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'online',
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
