import mammoth from 'mammoth';
import fs from 'fs';

const file1 = '2._软件产品介绍 (7).docx';
const file2 = '优化后_软件产品介绍.docx';

console.log('=== 测试生成文档样式 ===');
mammoth.convertToHtml({ path: file1 }).then(result => {
    const lines = result.value.split('\n').slice(0, 30);
    lines.forEach((line, i) => console.log(`${i+1}: ${line}`));
    
    console.log('\n=== 优化后文档样式 ===');
    return mammoth.convertToHtml({ path: file2 });
}).then(result => {
    const lines = result.value.split('\n').slice(0, 30);
    lines.forEach((line, i) => console.log(`${i+1}: ${line}`));
}).catch(err => console.error(err));
