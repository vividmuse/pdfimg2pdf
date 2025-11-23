import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateStampSuggestion = async (description: string): Promise<{ text: string; subText: string }> => {
  try {
    const model = "gemini-2.5-flash";
    const prompt = `Generate a short, traditional or professional stamp/seal text (max 4-6 characters) based on this user description: "${description}". Also provide a very short date or role string (max 8 chars) for a sub-line. Return JSON.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "The main text for the stamp (e.g., 'Approved', 'Li Family', 'Confidential')",
            },
            subText: {
              type: Type.STRING,
              description: "A small subtitle like a date or 'Manager' (optional)",
            },
          },
          required: ["text"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate stamp text.");
  }
};
