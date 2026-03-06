import { DocType, FileData } from '../types';

const MODEL_NAME = 'gemini-3-flash-preview';

// 后端代理服务地址（使用相对路径，自动适配当前访问地址）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Helper to construct parts
const buildContentParts = (
  type: DocType,
  inputs: { sopFiles: FileData[]; videoFiles: FileData[]; techSpec?: string; template?: FileData; specFile?: FileData }
): any[] => {
  const parts: any[] = [];
  const { sopFiles, videoFiles, techSpec, template, specFile } = inputs;

  // RULE 1: Tech Spec DOES NOT use video.
  const allowVideo = type !== DocType.TECH_SPEC;

  // Aggregate all frames from all video files
  let allVideoFrames: string[] = [];
  if (allowVideo) {
    videoFiles.forEach(vf => {
      if (vf.videoFrames) {
        allVideoFrames = [...allVideoFrames, ...vf.videoFrames];
      }
    });
  }
  const hasVideoFrames = allVideoFrames.length > 0;

  // SYSTEM INSTRUCTION / ROLE DEFINITION
  let roleText = "";
  let requirements = "";

  const templateInstruction = template ? "【绝对指令】已提供参考模版。你必须百分之百遵守模版的物理结构、标题格式、行文语调。将模版视为一份带有占位符的‘填空题’，只允许将新数据填入对应的位置，严禁发明任何不在模版中的新板块或更改原有的叙述节奏。" : "";

  const videoInstruction = hasVideoFrames
    ? `\n\n【图片选配指令 - 重要】\n我为你提供了一个包含 ${allVideoFrames.length} 张高清截图的“视觉素材库”（Image 0 到 Image ${allVideoFrames.length - 1}）。这些图片来自软件的不同功能模块录屏。\n\n**你的工作流如下：**\n1. 首先，专注于根据文本需求撰写高质量的文档内容。\n2. 当你写到某个核心功能、亮点或操作步骤时，请**回顾**素材库中的图片。\n3. **挑选**一张最能匹配你当前描述内容的图片。\n4. 使用标签 \`{{IMAGE_索引}}\` 插入图片。\n\n注意：**不要**为了用图而用图。必须是内容需要展示界面时，才从库中“调取”最合适的那一张。如果素材库中没有匹配的，则不插入。`
    : "";

  switch (type) {
    case DocType.TECH_SPEC:
      roleText = `角色：资深技术架构师\n任务：深度分析提供的多个“SOP / 软件脚本”文件，并严格按照提供的【参考模版】生成一份《软件参数规格书》。${templateInstruction}`;
      requirements = `
        要求：
        1. **结构克隆**：如果模版有“交互模型”章节，即使 SOP 中不明显，你也要根据逻辑推断并按照模版的深度进行撰写。
        2. **格式一致性**：表格、列表、标注块的样式必须与模版完全一致。
        3. **全局归纳**：汇总所有 SOP 模块文件，建立完整的系统视图。
        4. 输出格式：Markdown。
        ${template ? "5. **严禁偏离**：你不允许自行决定文档的结构。模版有什么标题，你就有什么标题。模版是什么语调，你就用什么语调。" : ""}
        (注意：本步骤纯文本分析，不涉及视频画面参考)
      `;
      break;

    case DocType.MARKETING:
      roleText = `角色：顶尖产品营销专家\n任务：将《软件参数规格书》转化为一份《软件产品介绍》。${templateInstruction}`;
      requirements = `
          要求：
          1. **严格遵循以下文档结构**：
             # [产品名称]
             ### 产品简介
             ## 一、产品概述
             [2段描述性文字]

             ## 二、核心功能模块
             ### 1. [模块名称]
             • [功能点1]
             • [功能点2]
             • [功能点3]
             {{IMAGE_0}}
             **图1：[界面说明]**

             ### 2. [模块名称]
             • [功能点]
             {{IMAGE_1}}
             **图2：[界面说明]**

             ### 3. [模块名称]
             • [功能点]
             {{IMAGE_2}}
             **图3：[界面说明]**

             ### 4. [模块名称]
             • [功能点]（不插入图片）

             ## 三、技术优势
             | 技术特点 | 具体优势 |
             | --- | --- |
             | [特点1] | [优势描述] |

             ## 四、教学优势与应用效果
             ✓ [优势1]
             ✓ [优势2]

             ## 五、适用专业与课程
             适用专业：[专业列表]
             主要课程：
             • 《[课程名]》- [说明]

          2. **图片插入规则（严格遵守）**：
             - 只在"二、核心功能模块"的前3个小节（1. 2. 3.）插入图片
             - 图片格式：先插入 {{IMAGE_X}}，下一行插入说明文字 **图X：说明**
             - 第4小节"全能考核评估模块"不插入图片
             - 其他所有章节（一、三、四、五）都不插入图片
             - 从素材库选择最匹配的图片

          3. **格式要求**：
             - 主标题用 #，一级章节用 ##，二级章节用 ###
             - 图片说明格式：**图X：说明文字**
             - 技术优势必须用表格，分隔符 | --- | --- |
             - 列表用 • 符号，优势用 ✓ 符号
          ${template ? "\n4. **模版优先**：如提供模版，以模版结构为准，但保持上述格式规范。" : ""}
          ${videoInstruction}
       `;
      break;

    case DocType.USER_MANUAL:
      roleText = `角色：资深技术文档工程师\n任务：基于 SOP 细节和技术规格书，编写一份《软件用户操作手册》。必须展现出与模版一致的专业感和指引逻辑。${templateInstruction}`;
      requirements = `
        要求：
        1. **操作流复刻**：模版如何描述一个‘点击’动作，你就如何描述。模版如何展示‘注意事项’，你就用同样的格式。
        2. **深度模仿**：目录深度、分步指引的细碎程度必须与模版对齐。
        3. ${hasVideoFrames ? "配图逻辑：在模版中对应的截图位置，从素材库中寻找最优截图填充。" : "在每个主要步骤处预留截图占位符。"}
        4. 输出格式：整洁的 Markdown 格式。
        ${template ? "5. **强制执行**：模版的页眉、页脚（如果在文中体现）、免责声明等固定板块必须按模版样式保留并将主体内容替换为本项目内容。" : ""}
        ${videoInstruction}
      `;
      break;
  }

  // 1. Role & Task
  parts.push({ text: roleText });

  // 2. Data Sources
  if (type === DocType.MARKETING || type === DocType.USER_MANUAL) {
    if (specFile) {
      parts.push({ text: `\n--- 输入数据 (现有参数说明书) ---\n` });
      if (specFile.isPdf && specFile.content) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: specFile.content } });
      } else {
        parts.push({ text: specFile.content || "(无数据)" });
      }
    } else if (techSpec) {
      parts.push({ text: `\n--- 输入数据 (生成的规格书草案) ---\n${techSpec}\n` });
    }

    if (type === DocType.USER_MANUAL && sopFiles.length > 0) {
      parts.push({ text: "\n--- 输入数据 (SOP 原始文件集) 开始 ---\n" });
      sopFiles.forEach((file, idx) => {
        parts.push({ text: `\n>>>>> 模块文件 ${idx + 1}: ${file.fileName} <<<<<\n` });
        if (file.isPdf && file.content) {
          parts.push({ inlineData: { mimeType: 'application/pdf', data: file.content } });
        } else {
          parts.push({ text: file.content || "(无数据)" });
        }
      });
      parts.push({ text: "\n--- 输入数据 (SOP) 结束 ---\n" });
    }
  } else if (type === DocType.TECH_SPEC) {
    parts.push({ text: "\n--- 输入数据 (SOP 原始文件集) 开始 ---\n" });
    sopFiles.forEach((file, idx) => {
      parts.push({ text: `\n>>>>> 模块文件 ${idx + 1}: ${file.fileName} <<<<<\n` });
      if (file.isPdf && file.content) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: file.content } });
      } else {
        parts.push({ text: file.content || "(无数据)" });
      }
    });
    parts.push({ text: "\n--- 输入数据 (SOP) 结束 ---\n" });
  }

  // 2.5 Inject Video Frames (Global Library)
  if (hasVideoFrames) {
    parts.push({ text: "\n--- 视频截图素材库 (Image Asset Library) ---\n" });
    allVideoFrames.forEach((frameBase64, index) => {
      parts.push({ text: `Image ${index}:` });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: frameBase64 } });
    });
    parts.push({ text: "\n--- 素材库结束 ---\n" });
  }

  // 3. Reference Template
  if (template && template.content) {
    parts.push({ text: `\n--- 参考模版 (${type}) 开始 ---\n` });
    parts.push({
      text: `
【绝对强制指令：视觉样式克隆 & 像素级对齐】
你现在不仅要生成文字，还要充当视觉设计师。你必须在生成结果的**第一行**（没有任何前言）输出一个样式元数据块。

1. **样式分析 (Style Analysis)**：
   - 深度观察模版（尤其是 PDF 模版）的视觉特征。
   - **必须**包含如下格式的 <style_config> 标签块：
     <style_config>
     {
       "fontFamily": "模版主字体真实名称(如: 'Microsoft YaHei', 'SimSun')",
       "fontSize": "正文字号(数字+pt, 如: 12pt)",
       "lineSpacing": { "type": "multiple/fixed", "value": "1.5 或 28pt" },
       "colors": {
          "primary": "主品牌色十六进制",
          "text": "正文色十六进制",
          "tableHeaderBg": "表头背景色十六进制"
       },
       "h1": { "fontSize": "18pt", "bold": true, "alignment": "center", "color": "#1A5FB4" },
       "h2": { "fontSize": "15pt", "bold": true, "alignment": "left", "color": "#4A4A4A" },
       "h3": { "fontSize": "12pt", "bold": true, "alignment": "left", "color": "text" },
       "paragraph": { "alignment": "left/justify", "spacingAfter": "120", "color": "通常用 text" },
       "table": { "borderColor": "#CCCCCC", "headerColor": "#FFFFFF" }
     }
     </style_config>
   - **层级色彩独立**：不同层级的标题（H1/H2/H3）通常有细微色差。**严禁**全部映射为 'primary'。请为每个层级识别独立的十六进制色值或使用 'text'。

2. **内容生成**：
   - 在样式块之后，开始生成正常的生成结果。
   - **结构复刻**：完全对齐模版的标题层级。
   - **文风克隆**：语气、用词习惯必须与模版一致。
   - **跨软件映射**：将输入数据（软件 A）完美融入模版（软件 B）框架，确保叙事逻辑顺畅。

以下是模版内容（请务必深度分析其排版样式）：
` });

    if (template.isPdf) {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: template.content } });
    } else {
      parts.push({ text: template.content });
    }
    parts.push({ text: "\n--- 参考模版 结束 ---\n" });
  }

  // 4. Requirements
  parts.push({ text: requirements });

  return parts;
};

export const generateDocument = async (
  type: DocType,
  inputs: { sopFiles: FileData[]; videoFiles: FileData[]; techSpec?: string; template?: FileData | null; specFile?: FileData | null }
): Promise<string> => {
  // Validate inputs
  if (type === DocType.TECH_SPEC && inputs.sopFiles.length === 0) throw new Error("生成技术规格书至少需要一个 SOP 文件");

  const specReady = !!inputs.specFile || !!inputs.techSpec;

  if (type === DocType.MARKETING && !specReady) throw new Error("生成营销文档需要参数规格书（上传或生成）");
  if (type === DocType.USER_MANUAL && !specReady) throw new Error("生成用户手册需要参数规格书（上传或生成）");

  const safeInputs = {
    ...inputs,
    template: inputs.template || undefined,
    specFile: inputs.specFile || undefined
  };

  const parts = buildContentParts(type, safeInputs);

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        contents: [{ role: 'user', parts }],
        config: {
          thinkingConfig: { includeThoughts: true }
        },
        useQwen: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP 错误: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "未能生成内容。";
  } catch (error: any) {
    console.error(`生成 ${type} 时出错:`, error);

    // Gemini 失败时自动切换到 Qwen
    console.log('尝试使用本地 Qwen 模型...');
    try {
      const qwenResponse = await fetch(`${API_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts }],
          useQwen: true
        })
      });

      if (!qwenResponse.ok) {
        throw new Error('Qwen 模型也失败了');
      }

      const qwenData = await qwenResponse.json();
      console.log('已切换到 Qwen 模型');
      return qwenData.text || "未能生成内容。";
    } catch (qwenError: any) {
      throw new Error(`Gemini 和 Qwen 均失败: ${error.message}`);
    }
  }
};