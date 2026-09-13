export const config = {
  runtime: 'edge',
};

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

    const modelsToTry = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini-1.0-pro'
    ];

    let response;
    let errText = '';

    for (const model of modelsToTry) {
      const isLegacy = model.includes('1.0') || model === 'gemini-pro';
      
      const requestBody = JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: isLegacy ? `${systemPrompt}\n\nUser Request: ${prompt}` : prompt }]
          }
        ],
        ...(isLegacy ? {} : {
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });

      if (response.ok) {
        break; // Success!
      } else {
        errText = await response.text();
        console.warn(`Model ${model} failed:`, errText);
        // If it's a 400 about systemInstruction not supported in gemini-pro, we might need a further fallback, 
        // but 404 is what we are catching primarily.
        if (response.status !== 404 && response.status !== 400) {
          break;
        }
      }
    }

    if (!response || !response.ok) {
      console.error('Final Gemini API Error:', errText);
      return new Response(JSON.stringify({ error: `Gemini API Error: ${errText}` }), { status: response?.status || 500 });
    }

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
       return new Response(JSON.stringify({ error: 'Empty response from Gemini' }), { status: 500 });
    }

    // Sanitize in case older models wrapped it in markdown
    textOutput = textOutput.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();

    // Gemini guarantees JSON due to responseMimeType (or we sanitized it for legacy models)
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
