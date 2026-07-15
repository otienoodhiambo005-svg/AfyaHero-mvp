import { callWithCascade } from '../ai-providers';

describe('callWithCascade provider ordering', () => {
  const originalFetch = global.fetch;
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
    jest.restoreAllMocks();
  });

  it('preserves the explicit provider order supplied by the caller', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const fetchMock = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'gemini response' }] } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'openrouter response' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    global.fetch = fetchMock;

    const response = await callWithCascade({
      providers: ['gemini', 'openrouter'],
      prompt: 'Summarize this clinical note.',
    });

    expect(response.provider).toBe('gemini');
    expect(response.text).toBe('gemini response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });
});
