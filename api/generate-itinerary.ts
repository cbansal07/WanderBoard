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

    let targetModel = '';
    let errText = '';
    let availableModelNames: string[] = [];

    // 1. Dynamically discover a supported model using the API key
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const models = listData.models || [];
        
        const generateModels = models.filter((m: any) => 
          m.supportedGenerationMethods?.includes('generateContent')
        );
        
        availableModelNames = generateModels.map((m: any) => m.name);

        if (generateModels.length > 0) {
          // Prefer flash models, otherwise just take the first one
          const preferred = generateModels.find((m: any) => m.name.includes('gemini-1.5-flash')) 
                         || generateModels.find((m: any) => m.name.includes('gemini-1.5'))
                         || generateModels[0];
          
          // m.name is returned as "models/gemini-1.5-flash", we just want the part after models/
          targetModel = preferred.name.split('/').pop() || '';
        }
      }
    } catch (e) {
      console.error('Failed to list models:', e);
    }

    if (!targetModel) {
      targetModel = 'gemini-1.5-flash'; // absolute fallback
    }

    const isLegacy = targetModel.includes('1.0') || targetModel === 'gemini-pro';
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    });

    if (!response.ok) {
      errText = await response.text();
      console.error(`Model ${targetModel} failed:`, errText);
      return new Response(JSON.stringify({ 
        error: `Gemini API Error with model ${targetModel}: ${errText}. Available models for your key: ${availableModelNames.join(', ')}` 
      }), { status: response.status });
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
