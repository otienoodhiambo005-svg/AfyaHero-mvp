/**
 * DHA Kenya AfyaLink SHA Integration Client
 * Service Health Access (SHA) API Implementation
 */

import crypto from 'crypto';
import logger from './logger';

export interface AfyaLinkConfig {
  baseUrl: string;
  agentId: string;
  username: string;
  password: string;
  tokenKey: string;
  tokenSecret: string;
  publicKey: string;
  privateKey: string;
}

export interface AfyaLinkAuthHeaders {
  'X-API-Key': string;
  'Authorization': string;
  'X-Timestamp': string;
  'X-Signature': string;
  'X-Agent-ID': string;
}

export class AfyaLinkClient {
  private config: AfyaLinkConfig;
  
  constructor() {
    this.config = {
      baseUrl: process.env.AFYALINK_BASE_URL || 'https://uat.dha.go.ke',
      agentId: process.env.AFYALINK_AGENT_ID || '',
      username: process.env.AFYALINK_BASIC_USERNAME || '',
      password: process.env.AFYALINK_BASIC_PASSWORD || '',
      tokenKey: process.env.AFYALINK_TOKEN_KEY || '',
      tokenSecret: process.env.AFYALINK_TOKEN_SECRET || '',
      publicKey: process.env.AFYALINK_PUBLIC_KEY?.replace(/"/g, '') || '',
      privateKey: process.env.AFYALINK_PRIVATE_KEY?.replace(/"/g, '') || '',
    };
  }

  /**
   * Generate Basic Authentication header
   */
  getBasicAuth(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Generate request signature using RSA private key
   */
  generateSignature(payload: string, timestamp: string): string {
    const sign = crypto.createSign('SHA256');
    const data = `${timestamp}:${payload}`;
    
    sign.update(data);
    sign.end();
    
    return sign.sign(this.config.privateKey, 'base64');
  }

  /**
   * Verify incoming request signature using DHA public key
   */
  verifySignature(payload: string, timestamp: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      const data = `${timestamp}:${payload}`;
      
      verify.update(data);
      verify.end();
      
      return verify.verify(this.config.publicKey, signature, 'base64');
    } catch (error) {
      logger.error('AfyaLink signature verification failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Generate all required authentication headers for API requests
   */
  getAuthHeaders(payload: string = ''): AfyaLinkAuthHeaders {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(payload, timestamp);

    return {
      'X-API-Key': this.config.tokenKey,
      'Authorization': this.getBasicAuth(),
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'X-Agent-ID': this.config.agentId,
    };
  }

  /**
   * Validate incoming callback request from DHA
   */
  validateCallbackRequest(headers: Record<string, string>, body: string): boolean {
    const timestamp = headers['x-timestamp'];
    const signature = headers['x-signature'];
    const agentId = headers['x-agent-id'];

    if (!timestamp || !signature || !agentId) {
      return false;
    }

    // Verify timestamp is within 5 minute window
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return false;
    }

    // Verify agent ID matches
    if (agentId !== this.config.agentId) {
      return false;
    }

    // Verify signature
    return this.verifySignature(body, timestamp, signature);
  }

  /**
   * Health check for AfyaLink connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.config.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      logger.error('AfyaLink health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}

export const afyaLinkClient = new AfyaLinkClient();