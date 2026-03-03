import React, { useState, useRef, useEffect } from 'react';
import { DocStatus, DocType, GeneratedDoc, FileData } from './types';
import { generateDocument } from './services/geminiService';
import { parseFile } from './services/fileParser';
import { Button } from './components/Button';
import { StatusBadge } from './components/StatusBadge';
import { FileText, Wand2, Download, Copy, BookOpen, Sparkles, Layout, UploadCloud, X, FileSpreadsheet, Paperclip, ChevronDown, ChevronRight, Play, AlertCircle, Link as LinkIcon, FileVideo, Video, Image as ImageIcon, Sun, Moon, Trash2 } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { exportToWord } from './services/wordExporter';

const INITIAL_DOCS: Record<DocType, GeneratedDoc> = {
  [DocType.TECH_SPEC]: { type: DocType.TECH_SPEC, title: '1. 软件参数规格书', content: '', status: DocStatus.IDLE },
  [DocType.MARKETING]: { type: DocType.MARKETING, title: '2. 软件产品介绍', content: '', status: DocStatus.IDLE },
  [DocType.USER_MANUAL]: { type: DocType.USER_MANUAL, title: '3. 软件用户操作手册', content: '', status: DocStatus.IDLE }
};

type Theme = 'light' | 'dark';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.TECH_SPEC]: '规格书模版',
  [DocType.MARKETING]: '产品介绍模版',
  [DocType.USER_MANUAL]: '操作手册模版'
};

export default function App() {
  // Theme State (Default Light)
  const [theme, setTheme] = useState<Theme>('light');

  // Multi-File State for SOPs
  const [sopFiles, setSopFiles] = useState<FileData[]>([]);

  // Multi-File State for Videos
  const [videoFiles, setVideoFiles] = useState<FileData[]>([]);
  const [isVideoParsing, setIsVideoParsing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Template State
  const [templates, setTemplates] = useState<Record<DocType, FileData | null>>({
    [DocType.TECH_SPEC]: null,
    [DocType.MARKETING]: null,
    [DocType.USER_MANUAL]: null
  });
  const [showTemplates, setShowTemplates] = useState(false);

  // Processing State
  const [isParsing, setIsParsing] = useState(false);
  const [parsingTemplate, setParsingTemplate] = useState<DocType | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direct Specification State
  const [specFile, setSpecFile] = useState<FileData | null>(null);
  const specInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<Record<DocType, GeneratedDoc>>(INITIAL_DOCS);
  const [activeTab, setActiveTab] = useState<DocType>(DocType.TECH_SPEC);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const updateDoc = (type: DocType, updates: Partial<GeneratedDoc>) => {
    setDocs(prev => ({ ...prev, [type]: { ...prev[type], ...updates } }));
  };

  // --- SOP File Handling (Multi) ---
  const handleSopFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setUploadError(null);
    const newFiles: FileData[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const parsedData = await parseFile(files[i]);
        if (parsedData.videoFrames) {
          throw new Error(`文件 ${files[i].name} 似乎是视频，请在下方“视频素材”区域上传。`);
        }
        newFiles.push(parsedData);
      }
      setSopFiles(prev => [...prev, ...newFiles]);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeSopFile = (index: number) => {
    setSopFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Direct Specification Handling ---
  const handleSpecFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setUploadError(null);

    try {
      const parsedData = await parseFile(file);
      setSpecFile(parsedData);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsParsing(false);
      if (specInputRef.current) specInputRef.current.value = '';
    }
  };

  const removeSpecFile = () => {
    setSpecFile(null);
  };

  // --- Video File Handling (Multi & Dynamic Frames) ---
  const handleVideoFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsVideoParsing(true);
    setVideoError(null);

    // Logic: Calculate total expected videos to determine frame budget
    // We consider existing videos + new videos for the budget of *new* videos (simplification)
    // Or we stick to a robust heuristic:
    // If uploading 1 video -> 30 frames.
    // If uploading 5 videos -> 6 frames each.
    // Total budget: 60 frames.

    const TOTAL_FRAME_BUDGET = 60;
    const countOfNewFiles = files.length;

    // We calculate density based on the batch being uploaded. 
    // This allows user to upload 1 "Main" video (high detail) then 5 "Small" videos (low detail) in separate batches if they want.
    const framesPerVideo = Math.max(4, Math.floor(TOTAL_FRAME_BUDGET / countOfNewFiles));

    const newVideos: FileData[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const parsedData = await parseFile(file, { videoFrameCount: framesPerVideo });
        if (!parsedData.videoFrames) {
          throw new Error(`文件 ${file.name} 无法解析为视频。`);
        }
        newVideos.push(parsedData);
      }
      setVideoFiles(prev => [...prev, ...newVideos]);
    } catch (err: any) {
      setVideoError(err.message);
    } finally {
      setIsVideoParsing(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removeVideoFile = (index: number) => {
    setVideoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTemplateUpload = async (type: DocType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingTemplate(type);
    try {
      const parsedData = await parseFile(file);
      setTemplates(prev => ({ ...prev, [type]: parsedData }));
    } catch (err: any) {
      alert(`模版上传失败: ${err.message}`);
    } finally {
      setParsingTemplate(null);
      e.target.value = ''; // Reset input
    }
  };

  const removeTemplate = (type: DocType) => {
    setTemplates(prev => ({ ...prev, [type]: null }));
  };

  // --- Generation Logic ---
  const canGenerate = (type: DocType): { allowed: boolean; reason?: string } => {
    const sopReady = sopFiles.length > 0;
    const specReady = !!specFile || !!docs[DocType.TECH_SPEC].content;
    const isGeneratingAny = Object.values(docs).some((d: GeneratedDoc) => d.status === DocStatus.GENERATING);

    if (isGeneratingAny) return { allowed: false, reason: "正在生成其他文档" };

    switch (type) {
      case DocType.TECH_SPEC:
        return sopReady
          ? { allowed: true }
          : { allowed: false, reason: "请先上传 SOP 文件" };
      case DocType.MARKETING:
        return specReady
          ? { allowed: true }
          : { allowed: false, reason: "需先提供或生成参数规格书" };
      case DocType.USER_MANUAL:
        if (!sopReady && !specReady) return { allowed: false, reason: "请先上传 SOP 或参数规格书" };
        if (!specReady) return { allowed: false, reason: "需先提供或生成参数规格书" };
        return { allowed: true };
      default:
        return { allowed: false };
    }
  };

  const handleGenerateSingle = async (type: DocType) => {
    const check = canGenerate(type);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }

    updateDoc(type, { status: DocStatus.GENERATING, error: undefined });

    try {
      let inputs: any = {
        sopFiles: sopFiles,
        videoFiles: videoFiles,
        template: templates[type],
        specFile: specFile // Pass the directly uploaded spec file
      };

      if (type === DocType.MARKETING || type === DocType.USER_MANUAL) {
        inputs.techSpec = docs[DocType.TECH_SPEC].content;
      }

      const content = await generateDocument(type, inputs);
      updateDoc(type, { content, status: DocStatus.COMPLETED });

      // 自动触发 Word 导出，确保样式标签未被过滤
      const activeVideoFrames = getAllVideoFrames();
      const finalContent = getRenderedContent(content, activeVideoFrames, true); // true 表示保留样式标签
      await exportToWord(finalContent, docs[type].title);
    } catch (error: any) {
      console.error(`Failed to generate ${type}`, error);
      updateDoc(type, { status: DocStatus.ERROR, error: error.message });
    }
  };

  // --- Render & Export Utils ---

  // Combine all video frames from all files into a single linear array for rendering index matching
  const getAllVideoFrames = (): string[] => {
    let all: string[] = [];
    videoFiles.forEach(v => {
      if (v.videoFrames) all = [...all, ...v.videoFrames];
    });
    return all;
  };

  const getRenderedContent = (markdown: string, frames: string[], keepStyleConfig = false) => {
    // 移除样式配置块，避免在预览中显示 (除非 keepStyleConfig 为 true)
    const cleanMarkdown = keepStyleConfig
      ? markdown
      : markdown.replace(/<style_config>[\s\S]*?<\/style_config>/, '').trim();

    if (!frames || frames.length === 0) return cleanMarkdown;

    return cleanMarkdown.replace(/\{\{IMAGE_(\d+)\}\}/g, (match, index) => {
      const frameIndex = parseInt(index, 10);
      if (frames[frameIndex]) {
        return `\n\n![自动提取的视频截图 (Index: ${index})](data:image/jpeg;base64,${frames[frameIndex]})\n\n`;
      }
      return match;
    });
  };

  const getHtmlContent = (markdown: string, title: string, frames: string[]) => {
    const processedMarkdown = getRenderedContent(markdown, frames);
    const htmlBody = marked.parse(processedMarkdown);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
          h1, h2, h3 { color: #111; }
          img { max-width: 100%; border-radius: 8px; margin: 15px 0; border: 1px solid #ddd; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
          code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
          table { border-collapse: collapse; width: 100%; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          blockquote { border-left: 4px solid #ccc; margin: 10px 0; padding-left: 10px; color: #666; }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
      </html>
    `;
  };

  const copyToClipboard = async (doc: GeneratedDoc) => {
    if (!doc.content) return;
    const activeVideoFrames = getAllVideoFrames();
    const finalContent = getRenderedContent(doc.content, activeVideoFrames);

    try {
      const htmlContent = marked.parse(finalContent) as string;
      const blobHtml = new Blob([htmlContent], { type: "text/html" });
      const blobText = new Blob([finalContent], { type: "text/plain" });
      const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
      await navigator.clipboard.write(data);
      alert("已复制！您可以直接粘贴到 Google Docs 中。");
    } catch (err) {
      navigator.clipboard.writeText(finalContent);
      alert("已复制纯文本。");
    }
  };

  const downloadAsDoc = (doc: GeneratedDoc) => {
    const activeVideoFrames = getAllVideoFrames();
    const content = getHtmlContent(doc.content, doc.title, activeVideoFrames);
    const file = new Blob([content], { type: 'text/html' });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(file);
    element.download = `${doc.title.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportWord = async (doc: GeneratedDoc) => {
    const activeVideoFrames = getAllVideoFrames();
    // 导出时必须保留样式配置标签，以便 wordExporter 解析
    const finalContent = getRenderedContent(doc.content, activeVideoFrames, true);
    await exportToWord(finalContent, doc.title);
  };

  const currentDoc = docs[activeTab];
  const generationCheck = canGenerate(activeTab);
  const activeVideoFrames = getAllVideoFrames();
  const displayContent = getRenderedContent(currentDoc.content, activeVideoFrames);

  const hasVideo = activeVideoFrames.length > 0;
  const showVideoBadge = hasVideo && activeTab !== DocType.TECH_SPEC;

  return (
    <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 flex flex-col md:flex-row font-sans">

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 transition-colors duration-300">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">AutoDoc Flow</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">SOP 文档自动化生成工具</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">

          {/* SOP Input Section (Multi-File) */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <FileText size={12} /> SOP 输入数据 (必须)
            </label>

            <div className="flex flex-col gap-2">
              <div
                className={`
                  border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer
                  border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900
                `}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length > 0) {
                    const event = { target: { files: e.dataTransfer.files } } as any;
                    handleSopFilesChange(event);
                  }
                }}
              >
                <input
                  type="file"
                  multiple // Allow multiple
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleSopFilesChange}
                />

                {isParsing ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">正在解析文件...</span>
                  </div>
                ) : (
                  <div className="py-2">
                    <UploadCloud size={20} className="mx-auto text-slate-400 dark:text-slate-500 mb-2" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">点击上传 / 拖入多个 SOP</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1">支持 PDF, Word, Excel, Txt</p>
                  </div>
                )}
              </div>

              {/* File List */}
              {sopFiles.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {sopFiles.map((file, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-2 rounded-md border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-sm">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded flex items-center justify-center shrink-0">
                        {file.isPdf ? <FileText size={12} /> : <FileSpreadsheet size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{file.fileName}</p>
                      </div>
                      <button
                        onClick={() => removeSopFile(idx)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 text-right px-1">共 {sopFiles.length} 个模块文件</p>
                </div>
              )}

              {uploadError && <p className="text-[10px] text-red-500 dark:text-red-400">{uploadError}</p>}
            </div>
          </div>

          {/* Direct Specification Input Section */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Sparkles size={12} /> 现有参数说明书 (可选)
            </label>

            <div className="flex flex-col gap-2">
              <div
                className={`
                  border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer
                  border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900
                `}
                onClick={() => specInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length > 0) {
                    const event = { target: { files: e.dataTransfer.files } } as any;
                    handleSpecFileChange(event);
                  }
                }}
              >
                <input
                  type="file"
                  ref={specInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleSpecFileChange}
                />

                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">上传参数说明书</span>
                </div>
              </div>

              {/* Single Spec File Display */}
              {specFile && (
                <div className="bg-white dark:bg-slate-900 p-2 rounded-md border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-sm">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 rounded flex items-center justify-center shrink-0">
                    <FileText size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{specFile.fileName}</p>
                  </div>
                  <button
                    onClick={removeSpecFile}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Video Input Section (Multi-File) */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Video size={12} /> 软件录屏 / 配图 (可选)
            </label>

            <div className="flex flex-col gap-2">
              <div
                className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-center cursor-pointer transition-all"
                onClick={() => videoInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length > 0) {
                    const event = { target: { files: e.dataTransfer.files } } as any;
                    handleVideoFilesChange(event);
                  }
                }}
              >
                <input
                  type="file"
                  multiple // Allow multiple
                  ref={videoInputRef}
                  className="hidden"
                  accept=".mp4,.mov,.webm"
                  onChange={handleVideoFilesChange}
                />
                {isVideoParsing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">正在按智能策略提取帧...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <FileVideo size={16} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">拖入多个视频 (.mp4)</span>
                  </div>
                )}
              </div>

              {/* Video List */}
              {videoFiles.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {videoFiles.map((v, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-2 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileVideo size={12} className="text-purple-500 dark:text-purple-400 shrink-0" />
                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{v.fileName}</span>
                        </div>
                        <button onClick={() => removeVideoFile(idx)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {/* Mini Grid for this video */}
                      <div className="flex gap-0.5 overflow-hidden h-8 rounded opacity-80">
                        {v.videoFrames?.slice(0, 5).map((f, fi) => (
                          <img key={fi} src={`data:image/jpeg;base64,${f}`} className="w-auto h-full object-cover" />
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 text-right px-1">共 {videoFiles.length} 个视频，总计 {getAllVideoFrames().length} 张截图</p>
                </div>
              )}

              {videoError && <p className="text-[10px] text-red-500 dark:text-red-400">{videoError}</p>}
            </div>
          </div>

          {/* Reference Templates Section */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2"><Paperclip size={12} /> 参考模版 (可选)</span>
              {showTemplates ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showTemplates && (
              <div className="space-y-3 pl-1">
                {[DocType.TECH_SPEC, DocType.MARKETING, DocType.USER_MANUAL].map((type) => (
                  <div key={type} className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{DOC_TYPE_LABELS[type]}</span>
                      {templates[type] && (
                        <button
                          onClick={() => removeTemplate(type)}
                          className="text-[10px] text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          移除
                        </button>
                      )}
                    </div>

                    {templates[type] ? (
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800/50">
                        <FileText size={12} className="text-blue-500 dark:text-blue-400" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate flex-1">{templates[type]?.fileName}</span>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 w-full h-8 border border-dashed border-slate-300 dark:border-slate-700 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {parsingTemplate === type ? (
                          <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <UploadCloud size={12} className="text-slate-400 dark:text-slate-500" />
                            <span className="text-[10px] text-slate-500">上传</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                          onChange={(e) => handleTemplateUpload(type, e)}
                          disabled={parsingTemplate === type}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-300">

        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-md flex items-center px-6 justify-between shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {[DocType.TECH_SPEC, DocType.MARKETING, DocType.USER_MANUAL].map((type) => (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2
                  ${activeTab === type ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'}
                `}
              >
                {type === DocType.TECH_SPEC && <Layout size={14} />}
                {type === DocType.MARKETING && <Sparkles size={14} />}
                {type === DocType.USER_MANUAL && <BookOpen size={14} />}
                <span className="hidden sm:inline">{docs[type].title.split('. ')[1]}</span>
                {docs[type].status === DocStatus.COMPLETED && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <StatusBadge status={currentDoc.status} />
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700"></div>
            <button
              onClick={toggleTheme}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              title="切换主题"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Toolbar & Viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Toolbar */}
          <div className="px-8 pt-6 pb-2 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                {currentDoc.title}
                {showVideoBadge && (
                  <span className="flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/30">
                    <ImageIcon size={10} /> 包含截图
                  </span>
                )}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {currentDoc.status === DocStatus.COMPLETED ? '生成完毕' : '等待生成'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Generate Button */}
              <Button
                onClick={() => handleGenerateSingle(activeTab)}
                isLoading={currentDoc.status === DocStatus.GENERATING}
                disabled={!generationCheck.allowed || currentDoc.status === DocStatus.GENERATING}
                className={currentDoc.status === DocStatus.COMPLETED ? "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-600/10 dark:hover:bg-blue-600/20 dark:text-blue-400 dark:border-blue-600/30" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20"}
              >
                <Wand2 size={16} />
                {currentDoc.status === DocStatus.COMPLETED ? '重新生成' : '开始生成'}
              </Button>

              <div className="h-6 w-px bg-slate-300 dark:bg-slate-800 mx-1"></div>

              <Button
                variant="secondary"
                onClick={() => copyToClipboard(currentDoc)}
                disabled={!currentDoc.content}
                className="text-xs"
              >
                <Copy size={14} /> 复制
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadAsDoc(currentDoc)}
                disabled={!currentDoc.content}
                className="text-xs"
              >
                <Download size={14} /> HTML
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleExportWord(currentDoc)}
                disabled={!currentDoc.content}
                className="text-xs"
              >
                <FileText size={14} /> Word
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 pt-4 scroll-smooth">
            <div className="max-w-4xl mx-auto pb-10">
              {currentDoc.error ? (
                <div className="p-4 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 flex items-center gap-3">
                  <AlertCircle size={20} />
                  <div>
                    <p className="font-medium">生成失败</p>
                    <p className="text-sm opacity-80 whitespace-pre-wrap">{currentDoc.error}</p>
                  </div>
                </div>
              ) : displayContent ? (
                <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-300">
                  {/* Render the content with images injected */}
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(displayContent) as string) }} />
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-slate-500 dark:text-slate-600 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50">
                  {currentDoc.status === DocStatus.GENERATING ? (
                    <div className="text-center animate-pulse">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Wand2 size={32} className="text-blue-500 animate-spin-slow" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">正在生成内容...</h3>
                      <p className="text-sm text-slate-500 mt-2">Gemini 正在撰写文档</p>
                      {showVideoBadge && <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">正在分析 {videoFiles.length} 个视频文件并匹配插图...</p>}
                    </div>
                  ) : (
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <FileText size={32} className={generationCheck.allowed ? "text-slate-400 dark:text-slate-400" : "text-slate-300 dark:text-slate-600"} />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">暂无内容</p>

                      {generationCheck.allowed ? (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-500">点击上方按钮开始生成</p>
                        </div>
                      ) : (
                        <p className="text-sm text-orange-600/80 bg-orange-50 border border-orange-200 dark:text-orange-400/80 dark:bg-orange-400/10 px-3 py-1.5 rounded dark:border-orange-400/20 inline-block">
                          {generationCheck.reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}