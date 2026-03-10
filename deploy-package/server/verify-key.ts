import { decrypt } from './crypto.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(currentDir, '.env') });

const encryptedKey = process.env.GEMINI_API_KEY;

if (!encryptedKey) {
  console.log('❌ 未找到 GEMINI_API_KEY');
  process.exit(1);
}

if (encryptedKey.includes(':')) {
  try {
    const decrypted = decrypt(encryptedKey);
    console.log('✅ 解密后的 API Key:', decrypted);
  } catch (error) {
    console.log('❌ 解密失败:', error);
  }
} else {
  console.log('✅ API Key (未加密):', encryptedKey);
}
