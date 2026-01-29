import { GoogleGenAI } from "@google/genai";
import { DocType, FileData } from '../types';

const MODEL_NAME = 'gemini-3-pro-preview';

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to construct parts
const buildContentParts = (
  type: DocType,
  inputs: { sop: FileData; techSpec?: string; template?: FileData }
): any[] => {
  const parts: any[] = [];
  const { sop, techSpec, template } = inputs;

  // RULE 1: Tech Spec DOES NOT use video.
  const allowVideo = type !== DocType.TECH_SPEC;
  const hasVideoFrames = allowVideo && sop.videoFrames && sop.videoFrames.length > 0;

  // SYSTEM INSTRUCTION / ROLE DEFINITION
  let roleText = "";
  let requirements = "";
  
  // Common instruction for template adherence
  const templateInstruction = template ? "注意：已提供参考模版，请务必严格遵循模版的格式、结构和文风进行输出，严禁随意发挥。" : "";
  
  // Video Frame Instruction (Updated Logic)
  const videoInstruction = hasVideoFrames 
    ? `\n\n【图片选配指令 - 重要】\n我为你提供了一个包含 ${sop.videoFrames!.length} 张高清截图的“视觉素材库”（Image 0 到 Image ${sop.videoFrames!.length - 1}）。\n\n**你的工作流如下：**\n1. 首先，专注于根据文本需求撰写高质量的文档内容。\n2. 当你写到某个核心功能、亮点或操作步骤时，请**回顾**素材库中的图片。\n3. **挑选**一张最能匹配你当前描述内容的图片。\n4. 使用标签 \`{{IMAGE_索引}}\` 插入图片。\n\n注意：**不要**为了用图而用图。必须是内容需要展示界面时，才从库中“调取”最合适的那一张。如果素材库中没有匹配的，则不插入。`
    : "";

  switch (type) {
    case DocType.TECH_SPEC:
      roleText = `角色：技术架构师\n任务：分析提供的“SOP / 软件脚本”，并生成一份严谨的《软件参数规格书》。${templateInstruction}`;
      requirements = `
        要求：
        1. 提取所有“交互逻辑”、“模型列表”和“功能描述”。
        2. 创建一个“技术参数表”，汇总：
           - 实验步骤总数。
           - 交互点数量。
           - 硬件配置要求（如有必要请根据内容推断）。
        3. 输出格式：Markdown。
        4. 语气：专业、精准、技术导向。
        ${template ? "5. **最高优先级**：严格模仿参考模版的结构、标题层级和用词风格，不要更改模版的框架。" : ""}
        (注意：本步骤纯文本分析，不涉及视频画面参考)
      `;
      break;

    case DocType.MARKETING:
       roleText = `角色：产品营销经理\n任务：将以下《软件参数规格书》转化为一份《软件产品介绍》。${templateInstruction}`;
       requirements = `
          要求：
          1. 重点突出“教学价值”和“应用场景”。
          2. 将技术参数转化为“核心功能”和“产品亮点/卖点”。
          3. 输出格式：极具说服力的 Markdown 格式。
          4. 语气：激动人心、专业且通俗易懂。
          5. **视觉增强**：请充分利用提供的视频截图库。**先确定你要写的卖点是什么，然后去截图库里找证据**。例如，当你介绍“高精度模型”时，请从库中选一张展示模型细节的图。
          ${template ? "6. **最高优先级**：严格模仿参考模版的排版布局、营销话术风格和情感色彩。" : ""}
          ${videoInstruction}
       `;
       break;

    case DocType.USER_MANUAL:
      roleText = `角色：技术文档工程师\n任务：基于 SOP 细节和技术规格书，编写一份《软件用户操作手册》。${templateInstruction}`;
      requirements = `
        要求：
        1. 提供分步骤的操作指南。
        2. ${hasVideoFrames ? "配图逻辑：对于每一个关键操作步骤，请在素材库中寻找对应的界面截图（{{IMAGE_X}}）并插入。如果某个步骤在素材库中找不到对应的图，则不插图。" : "在每个主要步骤处预留截图占位符，格式如：“[占位符：此处插入步骤 X 的截图]”。"}
        3. 语言清晰、具有指导性。
        4. 输出格式：整洁的 Markdown 格式。
        ${template ? "5. **最高优先级**：严格模仿参考模版的目录结构、步骤描述方式和注意事项的标注方式。" : ""}
        ${videoInstruction}
      `;
      break;
  }

  // 1. Role & Task
  parts.push({ text: roleText });

  // 2. Data Sources
  if (type === DocType.MARKETING) {
      // Marketing mainly relies on Tech Spec
      parts.push({ text: `\n--- 输入数据 (技术规格书) ---\n${techSpec}\n` });
  } else if (type === DocType.USER_MANUAL) {
      // Manual relies on both
      parts.push({ text: `\n--- 输入数据 (技术规格书) ---\n${techSpec}\n` });
      parts.push({ text: "\n--- 输入数据 (SOP) 开始 ---\n" });
      if (sop.isPdf && sop.content) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: sop.content } });
      } else {
        parts.push({ text: sop.content || "(无数据)" });
      }
      parts.push({ text: "\n--- 输入数据 (SOP) 结束 ---\n" });
  } else if (type === DocType.TECH_SPEC) {
      // Tech Spec relies on SOP
      parts.push({ text: "\n--- 输入数据 (SOP) 开始 ---\n" });
      if (sop.isPdf && sop.content) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: sop.content } });
      } else {
        parts.push({ text: sop.content || "(无数据)" });
      }
      parts.push({ text: "\n--- 输入数据 (SOP) 结束 ---\n" });
  }

  // 2.5 Inject Video Frames (ONLY if allowed, i.e., NOT Tech Spec)
  if (hasVideoFrames) {
    parts.push({ text: "\n--- 视频截图素材库 (Image Asset Library) ---\n" });
    sop.videoFrames?.forEach((frameBase64, index) => {
       parts.push({ text: `Image ${index}:` });
       parts.push({ inlineData: { mimeType: 'image/jpeg', data: frameBase64 } });
    });
    parts.push({ text: "\n--- 素材库结束 ---\n" });
  }

  // 3. Reference Template (Optional)
  if (template && template.content) {
    parts.push({ text: `\n--- 参考模版 (${type}) 开始 ---\n` });
    
    // Stronger instruction for style mimicry
    parts.push({ text: `
【重要指令：深度模仿】
你必须把这个参考模版当作唯一的格式标准。
1. **结构复刻**：完全照搬模版的标题层级（H1/H2/H3）、段落布局、列表样式。如果模版有前言、结语或特定声明，请尽量保留（并根据新内容调整）。
2. **文风克隆**：分析模版的语调（是严肃的、亲切的、还是极简的？）。如果是营销文案，模仿它的感叹词和形容词使用习惯；如果是技术文档，模仿它的客观陈述方式。
3. **不要发散**：不要添加模版中不存在的章节，也不要使用模版中没有的格式风格（除非为了清晰展示输入数据所必须）。
4. **内容替换**：保留模版的“骨架”，将模版中的具体“血肉”（旧数据）替换为前文提供的【输入数据】。

以下是模版内容：
` });
    
    if (template.isPdf) {
       parts.push({ inlineData: { mimeType: 'application/pdf', data: template.content } });
    } else {
       parts.push({ text: template.content });
    }
    parts.push({ text: `\n--- 参考模版 结束 ---\n` });
  }

  // 4. Requirements
  parts.push({ text: requirements });

  return parts;
};

export const generateDocument = async (
  type: DocType,
  inputs: { sop: FileData; techSpec?: string; template?: FileData | null }
): Promise<string> => {
  const ai = getClient();
  
  // Validate inputs
  if (type === DocType.TECH_SPEC && !inputs.sop.content) throw new Error("生成技术规格书需要 SOP 输入");
  if (type === DocType.MARKETING && !inputs.techSpec) throw new Error("生成营销文档需要技术规格书");
  if (type === DocType.USER_MANUAL && (!inputs.sop.content || !inputs.techSpec)) throw new Error("生成用户手册需要 SOP 和技术规格书");

  // Filter null templates
  const safeInputs = { ...inputs, template: inputs.template || undefined };
  
  const parts = buildContentParts(type, safeInputs);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts }, 
      config: {
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    return response.text || "未能生成内容。";
  } catch (error: any) {
    console.error(`生成 ${type} 时出错:`, error);
    throw new Error(error.message || "未知的 Gemini API 错误");
  }
};