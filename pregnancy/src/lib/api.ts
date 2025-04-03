// src/lib/api.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// Access the environment variable using Vite's import.meta.env
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export const sendToGemini = async (input: string): Promise<string> => {
  try {
    const result = await model.generateContent(input);
    const response = result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};