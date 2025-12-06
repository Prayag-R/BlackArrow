export interface Stakeholder {
  name: string;
  role: string;
  perspective: string;
  coreValue: string;
}

export interface TensionPoint {
  valueA: string;
  valueB: string;
  description: string;
  score: number; // 0 to 100, representing the intensity of the clash
}

export interface DilemmaAnalysis {
  title: string;
  summary: string;
  stakeholders: Stakeholder[];
  tensions: TensionPoint[];
  ethicalDimensions: {
    label: string;
    score: number; // 0-100
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface HistoricalFigure {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  era: string;
  systemInstruction: string;
}

export interface FileData {
  mimeType: string;
  data: string; // Base64
  name: string;
}