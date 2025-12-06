import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DilemmaAnalysis, FileData } from "../types";

// Helper to get client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export const analyzeDilemma = async (
  textPrompt: string,
  files: FileData[]
): Promise<DilemmaAnalysis> => {
  const client = getClient();
  
  const fileParts = files.map(f => ({
    inlineData: {
      mimeType: f.mimeType,
      data: f.data
    }
  }));

  const systemInstruction = `
    You are an expert ethical analyst. Your job is to analyze complex situations, identify the key stakeholders involved, understand their genuine, conflicting perspectives, and map the underlying value tensions.
    
    Output strictly in JSON.
    Analyze the provided user dilemma (text, images, or video).
    
    1. Summarize the dilemma.
    2. Identify 4-6 key stakeholders. For each, give a 'perspective' (what they want/think) and their 'coreValue' (e.g. Loyalty, Profit, Safety).
    3. Identify 2-3 major 'tensions'. A tension is a clash between two values (e.g. Truth vs. Kindness). Score the intensity (0-100).
    4. Provide quantitative scores (0-100) for these 5 dimensions for the *overall* dilemma: 'Individualism', 'Collectivism', 'Pragmatism', 'Idealism', 'Risk'.
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A short, catchy title for the dilemma" },
      summary: { type: Type.STRING, description: "A 2-sentence summary of the core conflict" },
      stakeholders: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            perspective: { type: Type.STRING, description: "First-person reasoning from their POV" },
            coreValue: { type: Type.STRING },
          },
          required: ["name", "role", "perspective", "coreValue"],
        }
      },
      tensions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            valueA: { type: Type.STRING },
            valueB: { type: Type.STRING },
            description: { type: Type.STRING, description: "Why these values clash here" },
            score: { type: Type.NUMBER, description: "Intensity 0-100" },
          },
          required: ["valueA", "valueB", "description", "score"],
        }
      },
      ethicalDimensions: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING },
                score: { type: Type.NUMBER }
            }
        }
      }
    },
    required: ["title", "summary", "stakeholders", "tensions", "ethicalDimensions"],
  };

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      role: 'user',
      parts: [
        { text: textPrompt },
        ...fileParts
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.4, // Lower temperature for more analytical/structured output
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  return JSON.parse(text) as DilemmaAnalysis;
};

export const getStakeholderRebuttal = async (
  stakeholderName: string,
  stakeholderPerspective: string,
  userArgument: string,
  dilemmaSummary: string
): Promise<string> => {
  const client = getClient();
  
  const systemInstruction = `
    You are roleplaying as a stakeholder in an ethical dilemma.
    Your Name: ${stakeholderName}
    Your Original Stance: ${stakeholderPerspective}
    Dilemma: ${dilemmaSummary}
    
    The user is arguing against your view. Defend your position authentically. 
    Do not be purely defensive; explain *why* your value matters more in this specific context.
    Keep it concise (under 100 words) but impactful.
  `;

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
        parts: [{ text: userArgument }]
    },
    config: {
      systemInstruction,
      temperature: 0.7,
    }
  });

  return response.text || "I have nothing further to add.";
};

export const createFigureChat = (
  figureName: string,
  figureInstruction: string,
  dilemmaContext: string
) => {
  const client = getClient();
  
  const fullSystemInstruction = `
    ${figureInstruction}
    
    CONTEXT OF THE DILEMMA:
    ${dilemmaContext}
    
    Your goal is to help the user grapple with this specific dilemma using your philosophical framework.
    Do not just give a lecture. Engage in a dialogue. Challenge the user.
    Keep responses conversational but intellectually rigorous.
  `;

  return client.chats.create({
    model: 'gemini-2.5-flash', // Using flash for speed, but instructed deeply
    config: {
      systemInstruction: fullSystemInstruction,
      temperature: 0.8,
    },
  });
};