import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
    AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType
} from 'docx';
import { saveAs } from 'file-saver';

// 字体映射表
const FONT_MAP: Record<string, string> = {
    "微软雅黑": "Microsoft YaHei",
    "宋体": "SimSun",
    "黑体": "SimHei",
    "楷体": "KaiTi",
    "仿宋": "FangSong",
    "Arial": "Arial",
    "Times New Roman": "Times New Roman"
};

const mapFont = (f: string) => {
    if (!f) return "Microsoft YaHei";
    const clean = f.replace(/['"]/g, '').trim();
    return FONT_MAP[clean] || clean;
};

const mapAlignment = (a: string) => {
    if (!a) return AlignmentType.LEFT;
    switch (a.toLowerCase()) {
        case 'center': return AlignmentType.CENTER;
        case 'justify': return AlignmentType.JUSTIFIED;
        case 'right': return AlignmentType.RIGHT;
        default: return AlignmentType.LEFT;
    }
};

// 默认样式常量
const DEFAULT_STYLES = {
    fontFamily: "Microsoft YaHei",
    fontSize: 24, // 默认 12pt (24/2)
    lineSpacing: 360,
    colors: {
        primary: "000000",
        text: "000000",
        tableHeaderBg: "F0F4F8"
    },
    h1: { fontSize: 36, bold: true, alignment: AlignmentType.CENTER, color: "000000" },
    h2: { fontSize: 32, bold: true, alignment: AlignmentType.LEFT, color: "000000" },
    h3: { fontSize: 28, bold: true, alignment: AlignmentType.LEFT, color: "000000" },
    paragraph: { alignment: AlignmentType.JUSTIFIED, spacingAfter: 240, color: "000000" },
    table: { borderColor: "CCCCCC", headerColor: "000000" }
};

/**
 * 简单的 Markdown 行内解析：目前仅支持 **加粗**
 */
const parseInlineText = (text: string, baseOptions: any): TextRun[] => {
    if (!text) return [];
    const parts = text.split(/(\*\*.*?\*\*)/g);
    const runs: TextRun[] = [];

    parts.forEach(part => {
        if (!part) return;
        if (part.startsWith('**') && part.endsWith('**')) {
            const content = part.slice(2, -2);
            if (content) {
                runs.push(new TextRun({
                    ...baseOptions,
                    text: content,
                    bold: true
                }));
            }
        } else {
            runs.push(new TextRun({
                ...baseOptions,
                text: part
            }));
        }
    });
    return runs;
};

/**
 * 将 Markdown 内容转换为 Word 文档并下载
 */
export const exportToWord = async (markdown: string, title: string) => {
    // 1. 提取并移除动态样式元数据
    let activeStyles = JSON.parse(JSON.stringify(DEFAULT_STYLES));
    const styleConfigRegex = /<style_config>([\s\S]*?)<\/style_config>/g;
    const styleMatches = [...markdown.matchAll(styleConfigRegex)];

    let cleanMarkdown = markdown.replace(styleConfigRegex, '').trim();

    if (styleMatches.length > 0) {
        try {
            const lastMatch = styleMatches[styleMatches.length - 1];
            const configText = lastMatch[1].trim();
            const jsonMatch = configText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const parseSize = (s: any) => {
                    if (typeof s === 'number') return s * 2;
                    const num = parseInt(s);
                    return isNaN(num) ? undefined : num * 2;
                };
                const parseColor = (c: any): string | undefined => {
                    if (!c || typeof c !== 'string') return undefined;
                    if (c.toLowerCase().includes('primary')) return activeStyles.colors.primary;
                    if (c.toLowerCase().includes('text')) return activeStyles.colors.text;
                    const hexMatch = c.match(/#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/);
                    if (hexMatch) {
                        let hex = hexMatch[1];
                        return hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
                    }
                    return undefined;
                };

                if (parsed.colors) {
                    if (parsed.colors.primary) activeStyles.colors.primary = parseColor(parsed.colors.primary) || activeStyles.colors.primary;
                    if (parsed.colors.text) activeStyles.colors.text = parseColor(parsed.colors.text) || activeStyles.colors.text;
                    if (parsed.colors.tableHeaderBg) activeStyles.colors.tableHeaderBg = parseColor(parsed.colors.tableHeaderBg) || activeStyles.colors.tableHeaderBg;
                }

                if (parsed.fontFamily) {
                    const fonts = parsed.fontFamily.split(/[,，]/);
                    activeStyles.fontFamily = mapFont(fonts[0].trim());
                }
                if (parsed.fontSize) activeStyles.fontSize = parseSize(parsed.fontSize) || activeStyles.fontSize;

                if (parsed.lineSpacing) {
                    const val = typeof parsed.lineSpacing === 'object' ? parseFloat(parsed.lineSpacing.value) : parseFloat(parsed.lineSpacing);
                    const isFixed = typeof parsed.lineSpacing === 'object' && (parsed.lineSpacing.type?.includes('固定') || parsed.lineSpacing.type?.includes('fixed'));
                    activeStyles.lineSpacing = isFixed ? Math.round(val * 20) : Math.round(val * 240);
                }

                const applyHeading = (h: any, target: any) => {
                    if (h.fontSize) target.fontSize = parseSize(h.fontSize) || target.fontSize;
                    if (h.alignment) target.alignment = mapAlignment(h.alignment);
                    if (h.color) {
                        const c = parseColor(h.color);
                        if (c) target.color = c;
                    }
                };

                if (parsed.h1) applyHeading(parsed.h1, activeStyles.h1);
                if (parsed.h2) applyHeading(parsed.h2, activeStyles.h2);
                if (parsed.h3) applyHeading(parsed.h3, activeStyles.h3);

                if (parsed.paragraph) {
                    if (parsed.paragraph.alignment) activeStyles.paragraph.alignment = mapAlignment(parsed.paragraph.alignment);
                    if (parsed.paragraph.color) activeStyles.paragraph.color = parseColor(parsed.paragraph.color) || activeStyles.colors.text;
                    if (parsed.paragraph.spacingAfter) activeStyles.paragraph.spacingAfter = parseInt(parsed.paragraph.spacingAfter) || 240;
                }
                if (parsed.table) {
                    activeStyles.table.borderColor = parseColor(parsed.table.borderColor) || activeStyles.table.borderColor;
                    activeStyles.table.headerColor = parseColor(parsed.table.headerColor) || activeStyles.table.headerColor;
                }
            }
        } catch (e) {
            console.warn("样式配置解析异常", e);
        }
    }

    // 2. 将 Markdown 转换为 docx 子元素
    // 合并连续空行并过滤掉头部尾部空行
    const filteredLines = cleanMarkdown.split('\n')
        .map(l => l.trim())
        .filter((line, index, arr) => line !== '' || (arr[index - 1] !== '' && index > 0));

    const docChildren: any[] = [];
    let currentTableRows: string[][] = [];

    const flushTable = () => {
        if (currentTableRows.length === 0) return;
        const dataRows = currentTableRows.filter(row => !row.every(cell => cell.trim().match(/^-+$/)));
        if (dataRows.length > 0) {
            docChildren.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: activeStyles.table.borderColor },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: activeStyles.table.borderColor },
                    left: { style: BorderStyle.SINGLE, size: 1, color: activeStyles.table.borderColor },
                    right: { style: BorderStyle.SINGLE, size: 1, color: activeStyles.table.borderColor },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: activeStyles.table.borderColor },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: activeStyles.table.borderColor },
                },
                rows: dataRows.map((rowData, rowIndex) => {
                    const isHeader = rowIndex === 0;
                    return new TableRow({
                        children: rowData.map(cellText => new TableCell({
                            children: [new Paragraph({
                                children: parseInlineText(cellText.trim(), {
                                    bold: isHeader,
                                    color: isHeader ? activeStyles.table.headerColor : activeStyles.colors.text,
                                    font: { ascii: activeStyles.fontFamily, eastAsia: activeStyles.fontFamily },
                                    size: activeStyles.fontSize
                                }),
                                alignment: AlignmentType.CENTER
                            })],
                            shading: isHeader ? { fill: activeStyles.colors.tableHeaderBg, type: ShadingType.CLEAR, color: "auto" } : undefined,
                            verticalAlign: AlignmentType.CENTER
                        }))
                    });
                })
            }));
        }
        currentTableRows = [];
    };

    for (const line of filteredLines) {
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            currentTableRows.push(cells);
            continue;
        } else {
            flushTable();
        }

        if (!line) {
            // 只有当显式存在空行时才补一个极窄的间距
            docChildren.push(new Paragraph({ spacing: { after: 100 } }));
            continue;
        }

        const imageMatch = line.match(/!\[.*?\]\(data:image\/(png|jpeg|jpg);base64,(.*?)\)/);
        if (imageMatch) {
            const base64Data = imageMatch[2];
            try {
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                docChildren.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 120, after: 120 },
                    children: [new ImageRun({ data: imageBuffer, transformation: { width: 550, height: 310 }, type: 'jpg' } as any)],
                }));
            } catch (e) { console.error('图片下载失败', e); }
            continue;
        }

        const commonFont = { ascii: activeStyles.fontFamily, eastAsia: activeStyles.fontFamily };

        if (line.startsWith('# ')) {
            docChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: parseInlineText(line.replace('# ', ''), { size: activeStyles.h1.fontSize, color: activeStyles.h1.color, font: commonFont, bold: true }),
                alignment: activeStyles.h1.alignment,
                spacing: { before: 400, after: 240 }
            }));
        } else if (line.startsWith('## ')) {
            docChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: parseInlineText(line.replace('## ', ''), { size: activeStyles.h2.fontSize, color: activeStyles.h2.color, font: commonFont, bold: true }),
                alignment: activeStyles.h2.alignment,
                spacing: { before: 320, after: 180 }
            }));
        } else if (line.startsWith('### ')) {
            const h3Text = line.replace('### ', '');
            // 副标题（如"产品简介"）居中显示
            const isSubtitle = h3Text.includes('产品简介') || h3Text.includes('简介');
            docChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: parseInlineText(h3Text, { size: activeStyles.h3.fontSize, color: activeStyles.h3.color, font: commonFont, bold: true }),
                alignment: isSubtitle ? AlignmentType.CENTER : activeStyles.h3.alignment,
                spacing: { before: 240, after: 120 }
            }));
        } else if (line.startsWith('* ') || line.startsWith('- ')) {
            docChildren.push(new Paragraph({
                children: parseInlineText(line.substring(2), { size: activeStyles.fontSize, color: activeStyles.paragraph.color, font: commonFont }),
                bullet: { level: 0 },
                spacing: { line: activeStyles.lineSpacing, after: 120 }
            }));
        } else if (/^\d+\.\s/.test(line)) {
            docChildren.push(new Paragraph({
                children: parseInlineText(line.replace(/^\d+\.\s/, ''), { size: activeStyles.fontSize, color: activeStyles.paragraph.color, font: commonFont }),
                numbering: { reference: 'main-numbering', level: 0 },
                spacing: { line: activeStyles.lineSpacing, after: 120 }
            }));
        } else {
            // 检测图片说明文字（格式：**图X：说明** 或 图X：说明）
            const isFigureCaption = /^(\*\*)?图\s*\d+[：:]/i.test(line);

            docChildren.push(new Paragraph({
                children: parseInlineText(line, { size: activeStyles.fontSize, color: activeStyles.paragraph.color, font: commonFont }),
                alignment: isFigureCaption ? AlignmentType.CENTER : activeStyles.paragraph.alignment,
                spacing: { line: activeStyles.lineSpacing, after: activeStyles.paragraph.spacingAfter },
            }));
        }
    }
    flushTable();

    // 3. 定义文档样式与保存
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: { ascii: activeStyles.fontFamily, eastAsia: activeStyles.fontFamily }, size: activeStyles.fontSize, color: activeStyles.colors.text },
                    paragraph: { alignment: activeStyles.paragraph.alignment }
                },
                heading1: {
                    run: { size: activeStyles.h1.fontSize, bold: true, font: { ascii: activeStyles.fontFamily, eastAsia: activeStyles.fontFamily }, color: activeStyles.h1.color },
                    paragraph: { spacing: { before: 400, after: 240 }, alignment: activeStyles.h1.alignment }
                },
                heading2: {
                    run: { size: activeStyles.h2.fontSize, bold: true, font: { ascii: activeStyles.fontFamily, eastAsia: activeStyles.fontFamily }, color: activeStyles.h2.color },
                    paragraph: { spacing: { before: 320, after: 180 }, alignment: activeStyles.h2.alignment }
                },
                heading3: {
                    run: { size: activeStyles.h3.fontSize, bold: true, font: { ascii: activeStyles.fontFamily, eastAsia: activeStyles.fontFamily }, color: activeStyles.h3.color },
                    paragraph: { spacing: { before: 240, after: 120 }, alignment: activeStyles.h3.alignment }
                }
            }
        },
        sections: [{
            properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
            children: docChildren,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title.replace(/\s+/g, '_')}.docx`);
};
