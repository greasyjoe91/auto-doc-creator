import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 兼容 ESM 和 CJS 的 __dirname 获取方式
const currentDir = typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(currentDir, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY 环境变量未设置');
    }
    return new GoogleGenAI({ apiKey });
};

// 健康检查接口
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 文档生成代理接口
app.post('/api/generate', async (req, res) => {
    try {
        const { model, contents, config } = req.body;

        if (!contents) {
            return res.status(400).json({ error: '缺少 contents 参数' });
        }

        const ai = getClient();

        const response = await ai.models.generateContent({
            model: model || 'gemini-3-flash-preview',
            contents,
            config: config || {}
        });

        res.json({
            text: response.text || '',
            success: true
        });
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
