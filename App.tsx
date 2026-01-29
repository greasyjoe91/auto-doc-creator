import React, { useState, useRef, useEffect } from 'react';
import { DocStatus, DocType, GeneratedDoc, FileData } from './types';
import { generateDocument } from './services/geminiService';
import { parseFile, isGoogleSheetUrl, fetchGoogleSheetContent } from './services/fileParser';
import { Button } from './components/Button';
import { StatusBadge } from './components/StatusBadge';
import { FileText, Wand2, Download, Copy, BookOpen, Sparkles, Layout, UploadCloud, X, FileSpreadsheet, Paperclip, ChevronDown, ChevronRight, Play, AlertCircle, Link as LinkIcon, FileVideo, Video, Image as ImageIcon } from 'lucide-react';
import { marked } from 'marked';

const INITIAL_DOCS: Record<DocType, GeneratedDoc> = {
  [DocType.TECH_SPEC]: { type: DocType.TECH_SPEC, title: '1. 软件参数规格书', content: '', status: DocStatus.IDLE },
  [DocType.MARKETING]: { type: DocType.MARKETING, title: '2. 软件产品介绍', content: '', status: DocStatus.IDLE },
  [DocType.USER_MANUAL]: { type: DocType.USER_MANUAL, title: '3. 软件用户操作手册', content: '', status: DocStatus.IDLE }
};

type InputMode = 'text' | 'file';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.TECH_SPEC]: '规格书模版',
  [DocType.MARKETING]: '产品介绍模版',
  [DocType.USER_MANUAL]: '操作手册模版'
};

export default function App() {
  // Input State
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [textInput, setTextInput] = useState('');
  const [fileInput, setFileInput] = useState<FileData | null>(null);
  
  // Video Input State (New)
  const [videoInput, setVideoInput] = useState<FileData | null>(null);
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

  const [docs, setDocs] = useState<Record<DocType, GeneratedDoc>>(INITIAL_DOCS);
  const [activeTab, setActiveTab] = useState<DocType>(DocType.TECH_SPEC);

  const updateDoc = (type: DocType, updates: Partial<GeneratedDoc>) => {
    setDocs(prev => ({ ...prev, [type]: { ...prev[type], ...updates } }));
  };

  // --- SOP File Handling ---
  const handleSopFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsing(true);
    setUploadError(null);
    try {
      const parsedData = await parseFile(file);
      // Validate that it's not a video file in the SOP slot (though accept attr handles most)
      if (parsedData.videoFrames) {
        throw new Error("请在下方“视频素材”区域上传视频文件。");
      }
      setFileInput(parsedData);
    } catch (err: any) {
      setUploadError(err.message);
      setFileInput(null);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Video File Handling ---
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVideoParsing(true);
    setVideoError(null);
    try {
      const parsedData = await parseFile(file);
      if (!parsedData.videoFrames) {
         throw new Error("未能识别视频内容，请上传有效的 MP4/MOV 文件。");
      }
      setVideoInput(parsedData);
    } catch (err: any) {
      setVideoError(err.message);
      setVideoInput(null);
    } finally {
      setIsVideoParsing(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
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

  const handleRemoveSopFile = () => {
    setFileInput(null);
    setUploadError(null);
  };

  const handleRemoveVideo = () => {
    setVideoInput(null);
    setVideoError(null);
  }

  const getSopData = (): FileData => {
    if (inputMode === 'file' && fileInput) return fileInput;
    return {
      type: 'text',
      content: textInput,
      isPdf: false
    };
  };

  // --- Generation Logic ---
  const canGenerate = (type: DocType): { allowed: boolean; reason?: string } => {
    const sopReady = !!getSopData().content;
    const techSpecReady = !!docs[DocType.TECH_SPEC].content;
    const isGeneratingAny = Object.values(docs).some((d: GeneratedDoc) => d.status === DocStatus.GENERATING);

    if (isGeneratingAny) return { allowed: false, reason: "正在生成其他文档" };

    switch (type) {
      case DocType.TECH_SPEC:
        return sopReady 
          ? { allowed: true } 
          : { allowed: false, reason: "请先输入 SOP 数据" };
      case DocType.MARKETING:
        return techSpecReady 
          ? { allowed: true } 
          : { allowed: false, reason: "需先生成技术规格书" };
      case DocType.USER_MANUAL:
        if (!sopReady) return { allowed: false, reason: "请先输入 SOP 数据" };
        if (!techSpecReady) return { allowed: false, reason: "需先生成技术规格书" };
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

    let sopData = getSopData();
    
    // Merge Video Frames into SOP Data if available
    // NOTE: GeminiService will filter this out for TECH_SPEC, but we pass it here generally
    if (videoInput?.videoFrames) {
       sopData = {
         ...sopData,
         videoFrames: videoInput.videoFrames
       };
    }

    updateDoc(type, { status: DocStatus.GENERATING, error: undefined });

    // Handle Google Sheet URL Fetching
    if (sopData.type === 'text' && isGoogleSheetUrl(sopData.content)) {
      try {
        const sheetContent = await fetchGoogleSheetContent(sopData.content);
        sopData = { ...sopData, content: sheetContent };
      } catch (fetchErr: any) {
        updateDoc(type, { status: DocStatus.ERROR, error: fetchErr.message });
        return; // Stop generation
      }
    }

    try {
      let inputs: any = { 
        sop: sopData, 
        template: templates[type] 
      };

      // Dependencies
      if (type === DocType.MARKETING || type === DocType.USER_MANUAL) {
         inputs.techSpec = docs[DocType.TECH_SPEC].content;
      }

      const content = await generateDocument(type, inputs);
      updateDoc(type, { content, status: DocStatus.COMPLETED });
    } catch (error: any) {
      console.error(`Failed to generate ${type}`, error);
      updateDoc(type, { status: DocStatus.ERROR, error: error.message });
    }
  };

  // --- Render & Export Utils ---
  
  // Post-process markdown to replace {{IMAGE_X}} with actual data URIs
  const getRenderedContent = (markdown: string, videoFrames?: string[]) => {
    if (!videoFrames || videoFrames.length === 0) return markdown;
    
    // Replace {{IMAGE_X}} with standard markdown image
    return markdown.replace(/\{\{IMAGE_(\d+)\}\}/g, (match, index) => {
      const frameIndex = parseInt(index, 10);
      if (videoFrames[frameIndex]) {
        return `\n\n![自动提取的视频截图 (Index: ${index})](data:image/jpeg;base64,${videoFrames[frameIndex]})\n\n`;
      }
      return match; // Return original if index not found
    });
  };

  const getHtmlContent = (markdown: string, title: string, videoFrames?: string[]) => {
    const processedMarkdown = getRenderedContent(markdown, videoFrames);
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
    // Use video frames from videoInput if available
    const activeVideoFrames = videoInput?.videoFrames;
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
    const activeVideoFrames = videoInput?.videoFrames;
    const content = getHtmlContent(doc.content, doc.title, activeVideoFrames);
    const file = new Blob([content], {type: 'text/html'});
    const element = document.createElement("a");
    element.href = URL.createObjectURL(file);
    element.download = `${doc.title.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Render logic for main area
  const currentDoc = docs[activeTab];
  const generationCheck = canGenerate(activeTab);
  
  // Combine video frames for display rendering
  const activeVideoFrames = videoInput?.videoFrames;
  const displayContent = getRenderedContent(currentDoc.content, activeVideoFrames);
  
  // Helper to check if current text input is a URL for UI Hint
  const isSheetLink = inputMode === 'text' && isGoogleSheetUrl(textInput);
  const hasVideo = !!activeVideoFrames && activeVideoFrames.length > 0;
  // Tech spec does not support video
  const showVideoBadge = hasVideo && activeTab !== DocType.TECH_SPEC;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-slate-950 border-r border-slate-800 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">AutoDoc Flow</h1>
          </div>
          <p className="text-xs text-slate-500">SOP 文档自动化生成工具</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* SOP Input Section */}
          <div className="flex flex-col">
             <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <FileText size={12} /> SOP 输入数据 (必须)
            </label>
            
            <div className="flex bg-slate-900 p-1 rounded-md mb-3 border border-slate-800">
              <button 
                onClick={() => setInputMode('text')}
                className={`flex-1 py-1.5 text-xs font-medium rounded ${inputMode === 'text' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                文本 / 链接
              </button>
              <button 
                onClick={() => setInputMode('file')}
                className={`flex-1 py-1.5 text-xs font-medium rounded ${inputMode === 'file' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                文档上传
              </button>
            </div>

            {inputMode === 'text' ? (
              <div className="relative">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="在此粘贴您的 CSV 内容、SOP 原始文本或 Google Sheet 链接..."
                  className="w-full min-h-[120px] bg-slate-900 border border-slate-800 rounded-md p-3 text-xs font-mono text-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none resize-y"
                />
                {isSheetLink && (
                  <div className="absolute bottom-2 right-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
                    <LinkIcon size={10} />
                    <span>自动读取</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div 
                  className={`
                    border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 text-center transition-all
                    ${fileInput ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800 hover:border-slate-600 bg-slate-900'}
                  `}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if(e.dataTransfer.files?.[0]) {
                       const event = { target: { files: e.dataTransfer.files } } as any;
                       handleSopFileChange(event);
                    }
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={handleSopFileChange}
                  />
                  
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                      <span className="text-xs text-slate-400">文档解析中...</span>
                    </div>
                  ) : fileInput ? (
                    <div className="w-full relative">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center shrink-0">
                          {fileInput.isPdf ? <FileText size={16}/> : <FileSpreadsheet size={16}/>}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{fileInput.fileName}</p>
                          <p className="text-[10px] text-slate-500">{fileInput.isPdf ? 'PDF' : 'Text Extracted'}</p>
                        </div>
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleRemoveSopFile(); }}
                           className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cursor-pointer py-2" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud size={20} className="mx-auto text-slate-500 mb-2" />
                      <p className="text-xs font-medium text-slate-300">上传 SOP 文档</p>
                      <p className="text-[10px] text-slate-600 mt-1">PDF, Excel, Word, Txt</p>
                    </div>
                  )}
                </div>
                {uploadError && <p className="text-[10px] text-red-400">{uploadError}</p>}
              </div>
            )}
          </div>

          {/* Video Input Section (New) */}
          <div className="border-t border-slate-800 pt-4">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Video size={12} /> 软件录屏 / 配图 (可选)
            </label>
            
            <div className="flex flex-col gap-2">
               {!videoInput ? (
                 <div 
                   className="border-2 border-dashed border-slate-800 hover:border-slate-600 bg-slate-900 rounded-lg p-3 text-center cursor-pointer transition-all"
                   onClick={() => videoInputRef.current?.click()}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => {
                     e.preventDefault();
                     if(e.dataTransfer.files?.[0]) {
                        const event = { target: { files: e.dataTransfer.files } } as any;
                        handleVideoFileChange(event);
                     }
                   }}
                 >
                   <input 
                      type="file" 
                      ref={videoInputRef}
                      className="hidden" 
                      accept=".mp4,.mov,.webm"
                      onChange={handleVideoFileChange}
                    />
                   {isVideoParsing ? (
                      <div className="flex items-center justify-center gap-2">
                         <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin"/>
                         <span className="text-xs text-slate-400">提取高清关键帧...</span>
                      </div>
                   ) : (
                      <div className="flex items-center justify-center gap-2">
                        <FileVideo size={16} className="text-slate-500" />
                        <span className="text-xs text-slate-400">上传视频 (.mp4)</span>
                      </div>
                   )}
                 </div>
               ) : (
                 <div className="bg-slate-900 rounded-md border border-slate-800 p-2">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <FileVideo size={14} className="text-purple-400 shrink-0" />
                           <span className="text-xs text-slate-300 truncate">{videoInput.fileName}</span>
                        </div>
                        <button onClick={handleRemoveVideo} className="text-slate-500 hover:text-red-400">
                           <X size={14} />
                        </button>
                    </div>
                    {/* Thumbnails Grid */}
                    <div className="grid grid-cols-4 gap-1">
                      {videoInput.videoFrames?.slice(0, 4).map((frame, i) => (
                        <div key={i} className="aspect-video relative rounded-sm overflow-hidden bg-black">
                           <img src={`data:image/jpeg;base64,${frame}`} className="w-full h-full object-cover opacity-80" />
                        </div>
                      ))}
                      {videoInput.videoFrames && videoInput.videoFrames.length > 4 && (
                        <div className="aspect-video bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 rounded-sm">
                           +{videoInput.videoFrames.length - 4}
                        </div>
                      )}
                    </div>
                 </div>
               )}
               {videoError && <p className="text-[10px] text-red-400">{videoError}</p>}
            </div>
          </div>

          {/* Reference Templates Section */}
          <div className="border-t border-slate-800 pt-4">
             <button 
               onClick={() => setShowTemplates(!showTemplates)}
               className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 hover:text-white"
             >
               <span className="flex items-center gap-2"><Paperclip size={12} /> 参考模版 (可选)</span>
               {showTemplates ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
             </button>
             
             {showTemplates && (
               <div className="space-y-3 pl-1">
                 {[DocType.TECH_SPEC, DocType.MARKETING, DocType.USER_MANUAL].map((type) => (
                   <div key={type} className="bg-slate-900 rounded-md border border-slate-800 p-2">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-xs text-slate-300 font-medium">{DOC_TYPE_LABELS[type]}</span>
                       {templates[type] && (
                         <button 
                           onClick={() => removeTemplate(type)}
                           className="text-[10px] text-red-400 hover:text-red-300"
                         >
                           移除
                         </button>
                       )}
                     </div>
                     
                     {templates[type] ? (
                       <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded border border-slate-800/50">
                         <FileText size={12} className="text-blue-400" />
                         <span className="text-[10px] text-slate-400 truncate flex-1">{templates[type]?.fileName}</span>
                       </div>
                     ) : (
                       <label className="flex items-center justify-center gap-2 w-full h-8 border border-dashed border-slate-700 rounded cursor-pointer hover:bg-slate-800 transition-colors">
                         {parsingTemplate === type ? (
                           <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin"/>
                         ) : (
                           <>
                             <UploadCloud size={12} className="text-slate-500" />
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-900">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[DocType.TECH_SPEC, DocType.MARKETING, DocType.USER_MANUAL].map((type) => (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2
                  ${activeTab === type ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}
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
          
          <div className="flex items-center gap-3">
             <StatusBadge status={currentDoc.status} />
          </div>
        </header>

        {/* Toolbar & Viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
            
            {/* Toolbar */}
            <div className="px-8 pt-6 pb-2 flex items-center justify-between shrink-0">
                 <div>
                    <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                       {currentDoc.title}
                       {showVideoBadge && (
                         <span className="flex items-center gap-1 text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                            <ImageIcon size={10} /> 包含截图
                         </span>
                       )}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {currentDoc.status === DocStatus.COMPLETED ? '生成完毕' : '等待生成'}
                    </p>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    {/* Generate Button */}
                    <Button 
                      onClick={() => handleGenerateSingle(activeTab)}
                      isLoading={currentDoc.status === DocStatus.GENERATING}
                      disabled={!generationCheck.allowed || currentDoc.status === DocStatus.GENERATING}
                      className={currentDoc.status === DocStatus.COMPLETED ? "bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/30" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"}
                    >
                       <Wand2 size={16} />
                       {currentDoc.status === DocStatus.COMPLETED ? '重新生成' : '开始生成'}
                    </Button>

                    <div className="h-6 w-px bg-slate-800 mx-1"></div>

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
                      <Download size={14} /> 导出
                    </Button>
                 </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 pt-4 scroll-smooth">
              <div className="max-w-4xl mx-auto pb-10">
                {currentDoc.error ? (
                   <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-3">
                      <AlertCircle size={20} />
                      <div>
                        <p className="font-medium">生成失败</p>
                        <p className="text-sm opacity-80 whitespace-pre-wrap">{currentDoc.error}</p>
                      </div>
                   </div>
                ) : displayContent ? (
                  <div className="prose prose-invert prose-slate max-w-none whitespace-pre-wrap leading-relaxed text-slate-300">
                    {/* Render the content with images injected */}
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(displayContent) as string }} />
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                     {currentDoc.status === DocStatus.GENERATING ? (
                       <div className="text-center animate-pulse">
                         <div className="w-16 h-16 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                           <Wand2 size={32} className="text-blue-500 animate-spin-slow" />
                         </div>
                         <h3 className="text-lg font-medium text-slate-300">正在生成内容...</h3>
                         <p className="text-sm text-slate-500 mt-2">Gemini 正在撰写文档</p>
                         {showVideoBadge && <p className="text-xs text-purple-400 mt-1">正在分析视频素材库并匹配插图...</p>}
                       </div>
                     ) : (
                       <div className="text-center max-w-sm">
                         <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FileText size={32} className={generationCheck.allowed ? "text-slate-400" : "text-slate-600"} />
                         </div>
                         <p className="text-slate-300 font-medium mb-1">暂无内容</p>
                         
                         {generationCheck.allowed ? (
                            <div className="space-y-3">
                               <p className="text-sm text-slate-500">点击上方按钮开始生成</p>
                            </div>
                         ) : (
                            <p className="text-sm text-orange-400/80 bg-orange-400/10 px-3 py-1.5 rounded border border-orange-400/20 inline-block">
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