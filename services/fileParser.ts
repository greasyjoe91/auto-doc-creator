import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { FileData } from '../types';

const MAX_SIZE_MB = 200; // Increased limit for larger/multiple videos
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

export const validateFile = (file: File): string | null => {
  if (file.size > MAX_BYTES) {
    return `文件大小超过限制 (${MAX_SIZE_MB}MB)。当前大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
  }
  return null;
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Video Extraction Logic ---
const extractKeyFrames = async (file: File, frameCount: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];
    const url = URL.createObjectURL(file);

    video.src = url;
    video.muted = true;
    video.playsInline = true;

    // Wait for metadata to know duration
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      // Ensure we extract at least 1 frame, avoiding division by zero if frameCount is weird
      const safeFrameCount = Math.max(1, Math.floor(frameCount));
      const interval = duration / (safeFrameCount + 1); 
      
      // Resolution Strategy: Maintain aspect ratio, max width 1920 (1080p source friendly)
      const maxWidth = 1920;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }

      canvas.width = width;
      canvas.height = height;

      const captureFrame = async (index: number) => {
        if (index >= safeFrameCount) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }

        const time = interval * (index + 1);
        video.currentTime = time;
      };

      video.onseeked = () => {
        if (ctx) {
          // Draw full resolution
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height); 
          
          // Use JPEG 0.85 for good balance of high quality vs payload size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          frames.push(dataUrl.split(',')[1]);
        }
        captureFrame(frames.length); // Next frame
      };
      
      // Start capturing
      captureFrame(0);
    };

    video.onerror = (e) => {
      reject("视频加载失败，可能是格式不支持。");
    };
  });
};

const readExcel = (buffer: ArrayBuffer): string => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  let text = "";
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    text += `--- Sheet: ${sheetName} ---\n`;
    text += XLSX.utils.sheet_to_csv(sheet);
    text += "\n\n";
  });
  return text;
};

const readDocx = async (buffer: ArrayBuffer): Promise<string> => {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
};

const readText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export interface ParseOptions {
  videoFrameCount?: number;
}

export const parseFile = async (file: File, options: ParseOptions = {}): Promise<FileData> => {
  const error = validateFile(file);
  if (error) throw new Error(error);

  const fileType = file.name.toLowerCase().split('.').pop();
  
  // Video Case
  if (['mp4', 'mov', 'webm'].includes(fileType || '')) {
     // Default to 10 if not specified, but this should be controlled by caller
     const framesToExtract = options.videoFrameCount || 10;
     const frames = await extractKeyFrames(file, framesToExtract); 
     return {
       type: 'file',
       mimeType: file.type,
       content: `（视频文件：${file.name}，已提取 ${frames.length} 帧）`, 
       fileName: file.name,
       isPdf: false,
       videoFrames: frames
     };
  }

  // PDF Case
  if (file.type === 'application/pdf' || fileType === 'pdf') {
    const base64 = await readFileAsBase64(file);
    return {
      type: 'file',
      mimeType: 'application/pdf',
      content: base64,
      fileName: file.name,
      isPdf: true
    };
  }

  // Other formats: Extract text
  let extractedText = "";
  const buffer = await readFileAsArrayBuffer(file);

  if (['xlsx', 'xls', 'csv'].includes(fileType || '')) {
    extractedText = readExcel(buffer);
  } else if (['docx', 'doc'].includes(fileType || '')) {
    extractedText = await readDocx(buffer);
  } else {
    extractedText = await readText(file);
  }

  return {
    type: 'text',
    content: extractedText,
    fileName: file.name,
    isPdf: false
  };
};

export const fetchGoogleSheetContent = async (url: string): Promise<string> => {
    // Kept for compatibility if we re-enable links later, or for internal utility
    // ... (same implementation as before)
    return ""; 
};
export const isGoogleSheetUrl = (text: string) => false;
