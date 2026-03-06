import { encrypt } from './crypto.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(currentDir, '.env') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ 未找到 GEMINI_API_KEY');
  process.exit(1);
}

if (apiKey.includes(':')) {
  console.log('✅ API Key 已经是加密格式');
  process.exit(0);
}

const encrypted = encrypt(apiKey);
const envPath = path.join(currentDir, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const newContent = envContent.replace(
  /GEMINI_API_KEY=.*/,
  `GEMINI_API_KEY=${encrypted}`
);

fs.writeFileSync(envPath, newContent);
console.log('✅ API Key 已加密并保存到 .env 文件');
