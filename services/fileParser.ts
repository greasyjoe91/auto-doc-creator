import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { FileData } from '../types';

const MAX_SIZE_MB = 100; // Increased limit to allow video uploads
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
const extractKeyFrames = async (file: File, frameCount: number = 20): Promise<string[]> => {
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
      const interval = duration / (frameCount + 1); // Avoid exact start/end
      
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
        if (index >= frameCount) {
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

export const parseFile = async (file: File): Promise<FileData> => {
  const error = validateFile(file);
  if (error) throw new Error(error);

  const fileType = file.name.toLowerCase().split('.').pop();
  
  // Video Case
  if (['mp4', 'mov', 'webm'].includes(fileType || '')) {
     // Extract 20 frames for better "pool" selection
     const frames = await extractKeyFrames(file, 20); 
     return {
       type: 'file',
       mimeType: file.type,
       content: "（这是一段视频输入，已提取高清关键帧用于分析）", 
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

// --- Google Sheet Utils ---

export const isGoogleSheetUrl = (text: string): boolean => {
  return text.trim().includes('docs.google.com/spreadsheets');
};

export const fetchGoogleSheetContent = async (url: string): Promise<string> => {
  // 1. Extract Sheet ID
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error("无效的 Google Sheet 链接格式");
  }
  const sheetId = idMatch[1];

  // Helper validation
  const validateContent = (text: string) => {
     if (text.includes('<!DOCTYPE html>') || text.includes('google.com/accounts')) {
       throw new Error("内容似乎是登录页面，请检查权限");
    }
    return text;
  };

  // Strategy 1: GVIZ API (Often has better CORS for published sheets)
  // tqx=out:csv returns CSV format
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  
  // Strategy 2: Standard Export URL (via Proxy)
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  // Using a public CORS proxy as fallback for client-side fetching
  const proxyUrl = `https://corsproxy.io/?` + encodeURIComponent(exportUrl);

  try {
    try {
      // Attempt 1: Direct Fetch (GVIZ)
      const response = await fetch(gvizUrl);
      if (response.ok) {
        const text = await response.text();
        return `--- 来自 Google Sheet (${sheetId}) ---\n${validateContent(text)}`;
      }
    } catch (e) {
      console.warn("Direct fetch failed, attempting proxy fallback...", e);
    }

    // Attempt 2: Proxy Fetch
    const proxyResponse = await fetch(proxyUrl);
    if (!proxyResponse.ok) {
       throw new Error(`Proxy Error: ${proxyResponse.status}`);
    }
    const proxyText = await proxyResponse.text();
    return `--- 来自 Google Sheet (${sheetId}) ---\n${validateContent(proxyText)}`;

  } catch (err: any) {
    console.error("Sheet Fetch Error:", err);
    throw new Error(
      `无法读取 Google Sheet。\n\n` +
      `请尝试以下解决方案：\n` +
      `1. 确保表格已“发布到网络” (文件 > 分享 > 发布到网络)。\n` +
      `2. 确保权限设置为“知道链接的任何人”可查看。\n` +
      `3. 如果仍然失败，请手动将表格下载为 .csv 或 .xlsx 文件并上传。`
    );
  }
};