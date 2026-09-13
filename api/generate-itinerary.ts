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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'Gemini API Error', details: err }), { status: response.status });
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
       return new Response(JSON.stringify({ error: 'Empty response from Gemini' }), { status: 500 });
    }

    // Gemini guarantees JSON due to responseMimeType
    const parsed = JSON.parse(textOutput);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating itinerary:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
