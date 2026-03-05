import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { Ollama } from 'ollama';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { decrypt } from './crypto.js';

// 兼容 ESM 和 CJS 的 __dirname 获取方式
const currentDir = typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(currentDir, '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件配置
app.use(cors({
    origin: (origin, callback) => {
        // 允许所有来源（桌面应用内部通信）
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json({ limit: '100mb' })); // 支持大型请求体（视频帧）

// 初始化 Gemini 客户端
const getClient = () => {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY 环境变量未设置');
    }
    if (apiKey.includes(':')) {
        try {
            apiKey = decrypt(apiKey);
        } catch (error) {
            console.error('API Key 解密失败，尝试使用原始值');
        }
    }
    return new GoogleGenAI({ apiKey });
};

// 初始化 Ollama 客户端
const getOllamaClient = () => {
    const baseUrl = process.env.QWEN_BASE_URL || 'http://localhost:11434';
    return new Ollama({ host: baseUrl });
};

// 健康检查接口
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Claude API 兼容接口（用于 OpenClaw 等工具）
app.post('/v1/messages', async (req, res) => {
    try {
        const { model, messages, max_tokens, stream } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: { message: '缺少 messages 参数' } });
        }

        const ollama = getOllamaClient();
        const qwenModel = process.env.QWEN_MODEL || 'qwen2.5:14b';

        // 转换 Claude 格式到 Ollama 格式
        const ollamaMessages = messages.map((m: any) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : m.content.map((c: any) => c.text || '').join('\n')
        }));

        const response = await ollama.chat({
            model: qwenModel,
            messages: ollamaMessages,
            stream: false
        });

        // 返回 Claude API 格式
        res.json({
            id: `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: response.message.content }],
            model: qwenModel,
            stop_reason: 'end_turn',
            usage: { input_tokens: 0, output_tokens: 0 }
        });
    } catch (error: any) {
        console.error('[Claude API Error]', error.message);
        res.status(500).json({
            error: { message: error.message || 'Internal server error' }
        });
    }
});

// 文档生成代理接口
app.post('/api/generate', async (req, res) => {
    try {
        const { model, contents, config, useQwen } = req.body;

        if (!contents) {
            return res.status(400).json({ error: '缺少 contents 参数' });
        }

        const qwenEnabled = process.env.QWEN_ENABLED === 'true';
        const shouldUseQwen = useQwen || false;

        if (shouldUseQwen && qwenEnabled) {
            // 使用本地 Qwen 模型
            const ollama = getOllamaClient();
            const qwenModel = process.env.QWEN_MODEL || 'qwen2.5:14b';

            // 转换 Gemini 格式到 Ollama 格式
            const messages = contents.map((c: any) => ({
                role: c.role === 'user' ? 'user' : 'assistant',
                content: c.parts.map((p: any) => p.text || '').join('\n')
            }));

            const response = await ollama.chat({
                model: qwenModel,
                messages,
                stream: false
            });

            res.json({
                text: response.message.content || '',
                success: true,
                usedModel: 'qwen'
            });
        } else {
            // 使用 Gemini API
            const ai = getClient();

            const response = await ai.models.generateContent({
                model: model || 'gemini-3-flash-preview',
                contents,
                config: config || {}
            });

            // 提取图片数据
            const imageFrames: string[] = [];
            contents.forEach((content: any) => {
                content.parts.forEach((part: any) => {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                        imageFrames.push(part.inlineData.data);
                    }
                });
            });

            // 替换{{IMAGE_X}}标签为实际的Markdown图片
            let finalText = response.text || '';
            imageFrames.forEach((base64Data, index) => {
                const placeholder = `{{IMAGE_${index}}}`;
                const markdownImage = `![图${index + 1}](data:image/jpeg;base64,${base64Data})`;
                finalText = finalText.replace(new RegExp(placeholder, 'g'), markdownImage);
            });

            res.json({
                text: finalText,
                success: true,
                usedModel: 'gemini'
            });
        }
    } catch (error: any) {
        console.error('[API Error]', error.message);
        res.status(500).json({
            error: error.message || '生成文档时发生错误',
            success: false
        });
    }
});

// 在打包环境下提供前端静态文件
// Electron 的 file:// 协议不支持 ES Module，因此前端必须通过 http:// 伺服
const distPath = path.resolve(currentDir, '..', 'dist');
app.use(express.static(distPath));

// SPA 兜底路由：所有非 API 请求都返回 index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`🚀 代理服务器运行在 http://localhost:${PORT}`);
});
