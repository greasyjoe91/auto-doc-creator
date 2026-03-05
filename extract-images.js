import mammoth from 'mammoth';
import fs from 'fs';

const docxPath = '2._软件产品介绍.docx';

mammoth.convertToHtml({ path: docxPath }, {
    convertImage: mammoth.images.imgElement(function(image) {
        return image.read("base64").then(function(imageBuffer) {
            return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
            };
        });
    })
}).then(result => {
    const html = result.value;

    // 提取所有图片的 base64 数据
    const imgRegex = /<img[^>]+src="data:([^"]+)"/g;
    const images = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
        images.push(match[1]);
    }

    console.log(`找到 ${images.length} 张图片`);

    // 保存图片信息到文件
    fs.writeFileSync('extracted-images.json', JSON.stringify(images, null, 2));
    console.log('✅ 图片数据已保存到 extracted-images.json');
}).catch(err => {
    console.error('提取失败:', err);
});
