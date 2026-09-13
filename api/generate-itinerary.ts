export const config = {
  runtime: 'edge',
};

// Ordered by preference. "gemini-flash-latest" is an alias Google keeps
// pointed at their current recommended fast model, so it's the safest
// first try — it should keep working even as pinned versions below get
// deprecated out from under us. gemini-2.x models are excluded entirely:
// Google has started blocking them for newer API keys/projects (404
// "no longer available to new users") even while still listing them
// in ListModels, so they're not a reliable fallback anymore.
const MODEL_CANDIDATES = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-pro-latest',
];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { prompt, destination, startDate, endDate } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Vercel.' }),
        { status: 500 }
      );
    }

    const systemPrompt = `You are an expert travel planner. The user is traveling to ${destination} from ${startDate} to ${endDate}.
Generate a structured itinerary based on their prompt.
Return EXACTLY a JSON object with this exact structure (no markdown, no backticks, just raw JSON):
{
  "activities": [
    {
      "title": "Visit the Eiffel Tower",
      "description": "A classic morning visit.",
      "location": "Eiffel Tower, Paris",
      "date": "YYYY-MM-DD",
      "startTime": "09:00",
      "durationMinutes": 120
    }
  ]
}
Distribute activities reasonably across the given dates. Use realistic times (e.g., 09:00, 14:30) and durations.`;

    const requestBody = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    let response: Response | null = null;
    let lastErrText = '';
    let lastModelTried = '';

    // Try each candidate model in order, falling through to the next one
    // on a 404 (model not found / not supported) so a single deprecation
    // doesn't take the whole endpoint down.
    for (const model of MODEL_CANDIDATES) {
      lastModelTried = model;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      if (res.ok) {
        response = res;
        break;
      }

      lastErrText = await res.text();
      console.error(`Model ${model} failed (${res.status}):`, lastErrText);

      // Only keep trying other models if this one was unavailable/not-found.
      // Any other error (bad request, quota, auth) is very unlikely to be
      // fixed by switching models, so bail out immediately with that error.
      if (res.status !== 404 && res.status !== 503 && res.status !== 429) {
        return new Response(
          JSON.stringify({ error: `Gemini API Error with model ${model}: ${lastErrText}` }),
          { status: res.status }
        );
      }
    }

    if (!response) {
      return new Response(
        JSON.stringify({
          error: `All candidate Gemini models failed. Last tried "${lastModelTried}": ${lastErrText}`
        }),
        { status: 502 }
      );
    }

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return new Response(JSON.stringify({ error: 'Empty response from Gemini' }), { status: 500 });
    }

    // Sanitize in case a model wrapped it in markdown despite responseMimeType
    textOutput = textOutput.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(textOutput);
    } catch (e: any) {
      console.error('Failed to parse JSON:', textOutput);
      return new Response(JSON.stringify({ error: 'Gemini returned invalid JSON', details: textOutput }), { status: 500 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating itinerary:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
