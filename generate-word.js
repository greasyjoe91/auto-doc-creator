import fs from 'fs';
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
    AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle
} from 'docx';

const markdown = fs.readFileSync('优化后_软件产品介绍.md', 'utf8');
const images = JSON.parse(fs.readFileSync('extracted-images.json', 'utf8'));

const lines = markdown.split('\n');
const docChildren = [];
let inTable = false;
let tableRows = [];
let currentSection = ''; // 跟踪当前章节
let imageIndex = 0; // 图片索引计数器

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('|')) {
        if (!inTable) inTable = true;
        const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        if (!cells.every(c => c.match(/^-+$/))) {
            tableRows.push(cells);
        }
        continue;
    } else if (inTable) {
        if (tableRows.length > 0) {
            docChildren.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                alignment: AlignmentType.CENTER,
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' },
                    left: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' },
                    right: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' },
                    insideVertical: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF' },
                },
                rows: tableRows.map((row, idx) => {
                    const isHeader = idx === 0;
                    return new TableRow({
                        children: row.map(cell => new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: cell,
                                    font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                                    size: 24,
                                    bold: isHeader,
                                    color: isHeader ? '0066CC' : '000000'
                                })],
                                alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                                spacing: { line: 360 }
                            })]
                        }))
                    });
                })
            }));
        }
        inTable = false;
        tableRows = [];
    }

    if (line.startsWith('# ')) {
        // 主标题保持微软雅黑
        docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({
                text: line.replace('# ', ''),
                font: { ascii: 'Microsoft YaHei', eastAsia: 'Microsoft YaHei' },
                size: 48,
                bold: true,
                color: '0066CC'
            })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240, line: 360 }
        }));
    } else if (line === '### 产品简介') {
        docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({
                text: '产品简介',
                font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                size: 28,
                bold: true,
                color: '4D4D4D'
            })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 120, line: 360 }
        }));
    } else if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '');
        docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({
                text: currentSection,
                font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                size: 32,
                bold: true,
                color: '0066CC'
            })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 180, line: 360 }
        }));
    } else if (line.startsWith('### ')) {
        docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({
                text: line.replace('### ', ''),
                font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                size: 28,
                bold: true,
                color: '4D4D4D'
            })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 200, after: 120, line: 360 }
        }));
    } else if (line.startsWith('**图') && line.includes('：')) {
        const match = line.match(/图\s*(\d+)/);
        // 只在"二、核心功能模块"且不是"4. 全能考核评估模块"时插入图片
        const shouldInsertImage = currentSection.includes('二、核心功能模块') &&
                                  !line.includes('全能考核') &&
                                  match && imageIndex < 3;

        if (shouldInsertImage) {
            const imgIdx = parseInt(match[1]) - 1;
            if (imgIdx >= 0 && imgIdx < images.length) {
                const imgData = images[imgIdx];
                const [mimeType, base64Data] = imgData.split(';base64,');
                const imageBuffer = Buffer.from(base64Data, 'base64');
                docChildren.push(new Paragraph({
                    children: [new ImageRun({
                        data: imageBuffer,
                        transformation: { width: 550, height: 310 }
                    })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 120, after: 60 }
                }));

                // 插入重新编号的说明文字
                const text = line.replace(/\*\*/g, '').replace(/图\s*\d+/, `图${imageIndex + 1}`);
                docChildren.push(new Paragraph({
                    children: [new TextRun({
                        text: text,
                        font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                        size: 24,
                        bold: true,
                        color: '000000'
                    })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 120, line: 360 }
                }));

                imageIndex++;
            }
        }
    } else if (line.startsWith('•') || line.startsWith('✓')) {
        const text = line.substring(1).trim();
        docChildren.push(new Paragraph({
            children: [new TextRun({
                text: text,
                font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                size: 24,
                color: '000000'
            })],
            bullet: { level: 0 },
            spacing: { after: 120, line: 360 }
        }));
    } else {
        docChildren.push(new Paragraph({
            children: [new TextRun({
                text: line,
                font: { ascii: 'SimSun', eastAsia: 'SimSun' },
                size: 24,
                color: '000000'
            })],
            alignment: AlignmentType.LEFT,
            indent: { firstLine: 420 },
            spacing: { after: 0, line: 360 }
        }));
    }
}

const doc = new Document({
    sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: docChildren,
    }],
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync('优化后_软件产品介绍.docx', buffer);
    console.log('✅ Word 文档已生成：优化后_软件产品介绍.docx（包含图片）');
});
