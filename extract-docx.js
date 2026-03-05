import mammoth from 'mammoth';
import fs from 'fs';

const docxPath = process.argv[2] || '2._软件产品介绍.docx';

mammoth.extractRawText({ path: docxPath })
  .then(result => {
    console.log(result.value);
  })
  .catch(err => {
    console.error('Error:', err);
  });
