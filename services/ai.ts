// AI Service — NVIDIA API Integration for FarmSense AI
// Uses z-ai/glm4.7 model via NVIDIA Integrate API

const NVIDIA_API_KEY = process.env.EXPO_PUBLIC_NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// ─────────────────────────────────────────────
// Chat Query — Text-based AI farming assistant
// ─────────────────────────────────────────────
export async function sendChatQuery(
  message: string,
  language: string = 'English',
  sensorContext?: { soilMoisture?: number; temperature?: number; humidity?: number }
): Promise<string> {
  try {
    // Build a context-aware prompt
    let systemPrompt = `You are FarmSense AI, an expert agricultural assistant for farmers in India. 
You provide advice on crop health, irrigation, pest control, and farming best practices.
Always respond in ${language}.
Keep responses concise and actionable (under 200 words).`;

    if (sensorContext) {
      systemPrompt += `\n\nCurrent farm sensor data:
- Soil Moisture: ${sensorContext.soilMoisture ?? 'N/A'}%
- Temperature: ${sensorContext.temperature ?? 'N/A'}°C
- Humidity: ${sensorContext.humidity ?? 'N/A'}%`;
    }

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct', // Use a high-availability, stable model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NVIDIA API Error status:', response.status, errorText);
      return 'AI service is temporarily unavailable. Please try again later.';
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content || 'Sorry, I could not generate a response.';
    }

    return 'Sorry, I could not process your query. Please try again.';
  } catch (error) {
    console.error('AI Chat Error:', error);
    return 'Connection error. Please check your internet and try again.';
  }
}

// ─────────────────────────────────────────────
// Image Analysis — Disease detection using VISION model
// Uses multimodal format so the AI can actually SEE the image
// ─────────────────────────────────────────────
export async function analyzeImage(
  imageBase64: string,
  language: string = 'English'
): Promise<{
  diseaseName: string;
  confidence: number;
  recommendation: string;
}> {
  try {
    // Truncate very large images to avoid API limits (keep first ~2MB of base64)
    const maxBase64Length = 2000000;
    const trimmedBase64 = imageBase64.length > maxBase64Length
      ? imageBase64.substring(0, maxBase64Length)
      : imageBase64;

    const systemPrompt = `You are an expert agricultural plant pathologist and crop disease detection specialist.
Analyze the provided crop/plant image carefully and identify any visible diseases, deficiencies, or pest damage.

IMPORTANT: You MUST respond in EXACTLY this format (no extra text before or after):
DISEASE: [disease name or "Healthy" if plant looks healthy]
CONFIDENCE: [number between 0-100]%
RECOMMENDATION: [2-3 sentences of actionable treatment advice]

Respond in ${language}.`;

    // Use vision-capable model with multimodal content format
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.2-11b-vision-instruct', // Switch to a stable, highly reliable vision model
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${trimmedBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 512,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NVIDIA Vision API Error:', response.status, errorText);
      
      // If we get an "Internal Server Error" or similar, use the fallback
      if (response.status >= 500 || errorText.includes('Internal Server Error')) {
         throw new Error('AI Server side error');
      }
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    console.log('Vision AI raw response:', text);

    // Parse the structured response (more robust regex that looks ahead for labels)
    const diseaseMatch = text.match(/DISEASE:\s*(.+?)(?=\s*CONFIDENCE:|\s*RECOMMENDATION:|\n|$)/i);
    const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
    const recMatch = text.match(/RECOMMENDATION:\s*(.+)/is);

    let disease = diseaseMatch?.[1]?.trim() || 'Unknown';
    // Remove trailing artifacts from disease name if patterns like 'CONFIDENCE:' leaked in
    disease = disease.split(/CONFIDENCE:|RECOMMENDATION:/i)[0].trim();
    
    const confidence = parseInt(confidenceMatch?.[1] || '50');
    const recommendation = recMatch?.[1]?.trim() || text || 'Please consult a local agricultural expert for detailed analysis.';

    return { diseaseName: disease, confidence, recommendation };
  } catch (error) {
    console.error('Image Analysis Error:', error);

    // Fallback: use text model to give generic advice if vision fails
    try {
      const fallbackResponse = await sendChatQuery(
        'A farmer has sent a photo of their crop that appears to have some discoloration or damage. Without seeing the specific image, what are the most common crop diseases in Indian agriculture and what should the farmer check for? Give practical advice.',
        language
      );
      return {
        diseaseName: 'Unable to detect — see advice below',
        confidence: 0,
        recommendation: fallbackResponse,
      };
    } catch {
      return {
        diseaseName: 'Analysis Failed',
        confidence: 0,
        recommendation: 'Could not analyze. Please ensure you have a stable internet connection and try again.',
      };
    }
  }
}

// ─────────────────────────────────────────────
// Quick AI recommendations based on sensor data
// ─────────────────────────────────────────────
export async function getSmartRecommendation(
  soilMoisture: number,
  temperature: number,
  humidity: number,
  weatherCondition: string
): Promise<string> {
  const message = `Based on these conditions:
- Soil Moisture: ${soilMoisture}%
- Temperature: ${temperature}°C
- Humidity: ${humidity}%
- Weather: ${weatherCondition}

Give me 2-3 brief actionable farming tips for today. Keep it under 100 words.`;

  return sendChatQuery(message, 'English', { soilMoisture, temperature, humidity });
}

// ─────────────────────────────────────────────
// Dedicated Text Translation using Google Translate API (Free)
// ─────────────────────────────────────────────
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const langCodeMap: Record<string, string> = {
    'Hindi': 'hi',
    'Punjabi': 'pa',
    'English': 'en'
  };

  const targetCode = langCodeMap[targetLanguage];
  
  if (!targetCode || targetLanguage === 'English') {
    // If English or unknown, just use AI to ensure proper English structure
    return sendChatQuery(`Refine this text into proper English: "${text}"`, 'English');
  }

  try {
    // Using the free tier Google Translate API (gtx client)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Parse Google Translate response format: [[["नमस्ते","Hello",null,null,1]],null,"en",null,null,null,1,[],[["en"],...]
    if (data && Array.isArray(data[0])) {
      const translatedText = data[0].map((item: any) => item[0]).join('');
      return translatedText;
    }
    
    // Fallback if API fails to parse
    return sendChatQuery(`Translate the following text to ${targetLanguage}. Only return the translated text:\n\n"${text}"`, targetLanguage);
    
  } catch (error) {
    console.error('Translation error:', error);
    // Fallback to AI
    return sendChatQuery(`Translate the following text to ${targetLanguage}. Only return the translated text:\n\n"${text}"`, targetLanguage);
  }
}
