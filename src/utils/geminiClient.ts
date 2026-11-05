import { GoogleGenAI, Type } from '@google/genai';

export interface AiAssessmentResult {
  hasRamp: boolean | null;
  rampWidthAdequate: boolean | null;
  hasSteps: boolean | null;
  doorWidth: 'wide' | 'narrow' | 'unknown';
  confidence: number;
  recommendations: string[];
  assessedAt: string;
}

/**
 * Run Gemini accessibility assessment directly in the browser.
 * Used on GitHub Pages (static deploy) where there is no backend.
 * Requires VITE_GEMINI_API_KEY to be set in the Vite environment.
 */
export async function assessImageInBrowser(
  file: File,
): Promise<AiAssessmentResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'AI assessment requires a GEMINI_API_KEY. Add VITE_GEMINI_API_KEY to your environment variables.',
    );
  }

  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:<mime>;base64," prefix
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || 'image/jpeg';

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Analyze this entrance/building photo for physical accessibility for people with disabilities (wheelchair users, visually impaired, mobility aids).
Assess:
1. Is a wheelchair accessible ramp visible? Answer yes, no, or unknown if the entrance area is not clearly shown.
2. Is the ramp width visibly adequate (at least 900mm / 3 feet)? Answer unknown without a reliable visual scale.
3. Are steps or stairs visible without an alternative level/ramp path? Answer unknown if the entrance area is not clearly shown.
4. Is the entrance door width visibly 'wide' (>= 800mm clear opening) or 'narrow'? Answer unknown without a reliable visual reference.
5. Confidence rating between 0.0 and 1.0, reflecting only what can be seen in this image.
6. Actionable recommendations based only on visible barriers. Do not claim that unseen features are present or absent.
Return ONLY valid JSON matching the schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hasRamp: {
            type: Type.STRING,
            enum: ['yes', 'no', 'unknown'],
            description: 'Whether an accessible ramp is visibly present.',
          },
          rampWidthAdequate: {
            type: Type.STRING,
            enum: ['yes', 'no', 'unknown'],
            description: 'Whether the ramp width meets wheelchair needs.',
          },
          hasSteps: {
            type: Type.STRING,
            enum: ['yes', 'no', 'unknown'],
            description: 'Whether obstructing steps are visible.',
          },
          doorWidth: {
            type: Type.STRING,
            enum: ['wide', 'narrow', 'unknown'],
            description: 'Visible door clearance.',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence rating between 0 and 1.',
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of practical accessibility improvement recommendations.',
          },
        },
        required: ['hasRamp', 'rampWidthAdequate', 'hasSteps', 'doorWidth', 'confidence', 'recommendations'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const toBool = (v: unknown) => (v === 'yes' ? true : v === 'no' ? false : null);

  return {
    hasRamp: toBool(parsed.hasRamp),
    rampWidthAdequate: toBool(parsed.rampWidthAdequate),
    hasSteps: toBool(parsed.hasSteps),
    doorWidth: (parsed.doorWidth as 'wide' | 'narrow' | 'unknown') ?? 'unknown',
    confidence: Math.round(Math.max(0, Math.min(1, Number(parsed.confidence))) * 100) / 100,
    recommendations: Array.isArray(parsed.recommendations) ? (parsed.recommendations as string[]) : [],
    assessedAt: new Date().toISOString(),
  };
}
