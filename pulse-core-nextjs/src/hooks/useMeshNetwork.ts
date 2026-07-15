/**
 * React Hook for Resilient Mesh Networking
 *
 * Integrates mesh networking into React components with real-time status updates
 * and automatic lifecycle management.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { MeshNetworkManager, MeshMessage, MeshNode, MessagePriority } from '../lib/mesh-network';

let globalMeshManager: MeshNetworkManager | null = null;

/**
 * Get or create global mesh network instance
 */
function getGlobalMeshManager(): MeshNetworkManager {
  if (!globalMeshManager) {
    const nodeId = `node-${Math.random().toString(36).substring(2, 10)}`;
    globalMeshManager = new MeshNetworkManager(nodeId);
  }
  return globalMeshManager;
}

/**
 * React hook for mesh network functionality
 */
export function useMeshNetwork() {
  const [meshManager, setMeshManager] = useState(() => getGlobalMeshManager());
  const [status, setStatus] = useState(meshManager.getMeshStatus());
  const [peers, setPeers] = useState<MeshNode[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Start mesh network when component mounts
    meshManager.start();
    // Defer setState to avoid synchronous setState in effect
    setTimeout(() => setIsInitialized(true), 0);

    // Status update interval
    const statusInterval = setInterval(() => {
      setStatus(meshManager.getMeshStatus());
      setPeers(Array.from(meshManager.peers.values()));
    }, 2000);

    // Listen for incoming messages
    const handleMeshMessage = (event: Event) => {
      const customEvent = event as CustomEvent<MeshMessage>;
      // Dispatch to application event system
      window.dispatchEvent(new CustomEvent('mesh:received', { detail: customEvent.detail }));
    };

    window.addEventListener('mesh:message', handleMeshMessage);

    return () => {
      clearInterval(statusInterval);
      window.removeEventListener('mesh:message', handleMeshMessage);
      meshManager.saveState();
    };
  }, [meshManager]);

  const sendMessage = useCallback((destination: string, payload: unknown, priority: MessagePriority = 'normal') => {
    const message: MeshMessage = {
      id: `${Date.now()}-${Math.random().toString(36)}`,
      type: 'data',
      source: meshManager.nodeId,
      destination,
      payload,
      priority,
      timestamp: Date.now(),
      ttl: 3600,
      hopCount: 0,
      previousHop: '',
      signature: '',
    };

    return meshManager.routeMessage(message);
  }, [meshManager]);

  const broadcastMessage = useCallback((payload: unknown, priority: MessagePriority = 'normal') => {
    meshManager.broadcast({
      type: 'data',
      destination: '*',
      payload,
      priority,
      ttl: 3600,
      signature: '',
    });
  }, [meshManager]);

  return {
    nodeId: meshManager.nodeId,
    status,
    peers,
    isInitialized,
    sendMessage,
    broadcastMessage,
    getMeshStatus: () => meshManager.getMeshStatus(),
  };
}