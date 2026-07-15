import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  requireRoles,
} from '@/lib/api-security';
import { logAIInteraction } from '@/lib/ai-audit';
import { callWithCascade, type CascadeOptions, type ProviderName } from '@/lib/ai-providers';
import logger from '@/lib/logger';

/**
 * General-purpose AI chat endpoint with file/image upload support.
 * 
 * Supports:
 * - Text-only conversations
 * - Image analysis (Gemini Vision, GPT-4 Vision)
 * - Document analysis (PDF, TXT via text extraction)
 * - Multi-turn conversation history
 * - Vision-capable models for image understanding
 */

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ChatRequest {
  message: string;
  systemPrompt?: string;
  conversationHistory?: ChatMessage[];
  files?: Array<{
    name: string;
    type: string;
    size: number;
    base64?: string; // For images
    text?: string;   // For documents
  }>;
}

interface ChatResponse {
  message: string;
  provider?: ProviderName;
  model?: string;
  latencyMs?: number;
  cached?: boolean;
  error?: string;
}

/**
 * Extract text from form data files (base64 for images)
 */
async function processUploadedFiles(files: File[]): Promise<ChatRequest['files']> {
  const processedFiles: ChatRequest['files'] = [];
  
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      continue; // Skip oversized files
    }

    const fileInfo = {
      name: file.name,
      type: file.type,
      size: file.size,
    };

    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      // Convert image to base64 for vision models
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      processedFiles.push({
        ...fileInfo,
        base64,
      });
    } else if (ALLOWED_DOC_TYPES.includes(file.type)) {
      // Extract text from documents
      const text = await file.text();
      processedFiles.push({
        ...fileInfo,
        text,
      });
    }
  }

  return processedFiles;
}

/**
 * Build prompt with file context
 */
function buildPromptWithFiles(message: string, files: ChatRequest['files'], systemPrompt?: string): string {
  let prompt = '';
  
  if (systemPrompt) {
    prompt += `System: ${systemPrompt}\n\n`;
  }

  if (files && files.length > 0) {
    prompt += '[Attached Files]\n';
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        prompt += `- Image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n`;
      } else if (file.text) {
        prompt += `- Document: ${file.name}\nContent:\n${file.text.slice(0, 4000)}\n`;
      }
    }
    prompt += '\n';
  }

  prompt += `User: ${message}`;
  
  return prompt;
}

/**
 * Main chat handler with provider cascade
 */
async function generateResponse(
  message: string,
  files: ChatRequest['files'],
  systemPrompt?: string,
  conversationHistory?: ChatMessage[]
): Promise<{ text: string; provider: ProviderName; model: string; latencyMs: number }> {
  // Include conversation history in prompt
  let fullPrompt = message;
  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .slice(-6) // Last 6 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    fullPrompt = `Previous conversation:\n${historyText}\n\nCurrent message: ${message}`;
  }

  // Include file context in prompt
  if (files && files.length > 0) {
    fullPrompt = buildPromptWithFiles(fullPrompt, files);
  }

  const cascadeOptions: CascadeOptions = {
    providers: ['gemini', 'openai', 'vertex'],
    prompt: fullPrompt,
    systemInstruction: systemPrompt,
    maxTokens: 2048,
    temperature: 0.7,
  };

  const result = await callWithCascade(cascadeOptions);

  if (!result.success || !result.text) {
    throw new Error(`All AI providers failed: ${result.error || 'Unknown error'}`);
  }

  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Security checks
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    const rateLimit = await enforceApiRateLimit(request, 'api:ai:chat');
    if (rateLimit) return rateLimit;

    // Authentication - allow all authenticated roles
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse request - handle both JSON and multipart
    const contentType = request.headers.get('content-type') || '';
    let message: string;
    let systemPrompt: string | undefined;
    let conversationHistory: ChatMessage[] | undefined;
    let files: ChatRequest['files'] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = formData.get('message') as string;
      systemPrompt = formData.get('systemPrompt') as string;
      
      try {
        conversationHistory = JSON.parse(formData.get('conversationHistory') as string || '[]');
      } catch {
        conversationHistory = [];
      }
      
      const uploadedFiles = formData.getAll('files') as File[];
      files = await processUploadedFiles(uploadedFiles);
    } else {
      const body = await request.json();
      message = body.message;
      systemPrompt = body.systemPrompt;
      conversationHistory = body.conversationHistory;
      
      // Handle base64 files in JSON body
      if (body.files && Array.isArray(body.files)) {
        files = body.files;
      }
    }

    // Validation
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message too long (max 10000 characters)' },
        { status: 400 }
      );
    }

    // Generate response
    const result = await generateResponse(message, files, systemPrompt, conversationHistory);

    // Log interaction (use 'analytics' as the closest type since 'chat' isn't in AIAnalysisType)
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'analytics',
      providerUsed: result.provider,
      modelUsed: result.model,
      latencyMs: result.latencyMs,
      success: true,
      inputSummary: message.slice(0, 200),
      outputSummary: result.text.slice(0, 200),
    });

    const response: ChatResponse = {
      message: result.text,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Chat API error', { error: error instanceof Error ? error.message : String(error) });

    // Log failed interaction
    try {
      const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
      if (!(session instanceof NextResponse)) {
        void logAIInteraction({
          userRole: session.role,
          userSubrole: session.subrole,
          userName: session.name,
          hospitalId: session.hospitalId,
          aiType: 'analytics',
          providerUsed: 'gemini' as ProviderName,
          modelUsed: 'unknown',
          latencyMs: Date.now() - startTime,
          success: false,
          errorMessage,
          inputSummary: '',
          outputSummary: '',
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        message: 'AI service temporarily unavailable. Please try again.'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'AfyaHero AI Chat API',
    version: '1.0.0',
    capabilities: [
      'text-chat',
      'image-analysis',
      'document-analysis',
      'multi-turn-conversation',
      'vision-support',
    ],
    limits: {
      maxMessageLength: 10000,
      maxFileSizeMB: MAX_FILE_SIZE_MB,
      allowedImageTypes: ALLOWED_IMAGE_TYPES,
      allowedDocTypes: ALLOWED_DOC_TYPES,
    },
  });
}