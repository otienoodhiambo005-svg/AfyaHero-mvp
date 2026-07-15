import { orchestrateAI } from '../ai-orchestrator';
import { getNetworkStatus, queueRequest } from '../network-utils';
import { logAIInteraction } from '../ai-audit';

jest.mock('../network-utils', () => ({
  getNetworkStatus: jest.fn(),
  queueRequest: jest.fn(),
}));

jest.mock('../ai-audit', () => ({
  logAIInteraction: jest.fn().mockResolvedValue('audit-1'),
}));

jest.mock('../ai-providers', () => ({
  callWithCascade: jest.fn(),
  callParallelConsensus: jest.fn(),
}));

const mockedGetNetworkStatus = jest.mocked(getNetworkStatus);
const mockedQueueRequest = jest.mocked(queueRequest);
const mockedLogAIInteraction = jest.mocked(logAIInteraction);

describe('orchestrateAI offline behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNetworkStatus.mockReturnValue('offline');
  });

  it('runs local offline triage when offlineAllowed is true', async () => {
    const response = await orchestrateAI({
      taskType: 'triage',
      prompt: 'Age 4 male with fever and cough',
      offlineAllowed: true,
      context: {
        symptoms: ['fever', 'cough'],
        vitals: {
          temperature: 39.5,
          respiratoryRate: 42,
        },
      },
      clinicianId: 'clinician-1',
      facilityId: 'hospital-1',
    });

    expect(response.success).toBe(true);
    expect(response.offline).toBe(true);
    expect(response.requiresReview).toBe(true);
    expect(response.provider).toBe('rule-based');
    expect(response.model).toBe('offline-clinical-rules-v1');
    expect(response.text).toContain('Offline AI result generated from local clinical rules.');
    expect(response.text).toContain('Human review required before clinical action.');
    expect(mockedQueueRequest).not.toHaveBeenCalled();
    expect(mockedLogAIInteraction).toHaveBeenCalledWith(expect.objectContaining({
      providerUsed: 'rule-based',
      modelUsed: 'offline-clinical-rules-v1',
      requiresReview: true,
    }));
  });

  it('queues cloud-only tasks when offlineAllowed is true but no local model exists', async () => {
    const request = {
      taskType: 'documentation' as const,
      prompt: 'Draft a SOAP note from this encounter transcript',
      offlineAllowed: true,
    };

    const response = await orchestrateAI(request);

    expect(response.success).toBe(false);
    expect(response.offline).toBe(true);
    expect(response.requiresReview).toBe(true);
    expect(response.error).toBe('Offline: cloud-only AI workflow queued');
    expect(mockedQueueRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/ai/orchestrate',
      body: request,
    });
  });

  it('queues all tasks when offlineAllowed is false', async () => {
    const request = {
      taskType: 'diagnosis' as const,
      prompt: 'Age 30 female with fever and headache',
      offlineAllowed: false,
    };

    const response = await orchestrateAI(request);

    expect(response.success).toBe(false);
    expect(response.offline).toBe(true);
    expect(response.requiresReview).toBe(false);
    expect(response.error).toBe('Offline: Request queued for later processing');
    expect(mockedQueueRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/ai/orchestrate',
      body: request,
    });
  });
});
