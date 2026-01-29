
export enum DocStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum DocType {
  TECH_SPEC = 'TECH_SPEC',
  MARKETING = 'MARKETING',
  USER_MANUAL = 'USER_MANUAL'
}

export interface GeneratedDoc {
  type: DocType;
  title: string;
  content: string;
  status: DocStatus;
  error?: string;
}

export interface FileData {
  type: 'text' | 'file';
  mimeType?: string; 
  content: string; // text string OR base64 string
  fileName?: string;
  isPdf?: boolean;
  videoFrames?: string[]; // Array of base64 strings (screenshots)
}

export interface AppState {
  apiKey: string;
  sopData: FileData;
  templates: Record<DocType, FileData | null>;
  docs: Record<DocType, GeneratedDoc>;
}
