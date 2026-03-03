import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors({
    origin: (origin, callback) => {
        // 在 Electron 环境或开发环境下允许常见的本地端口
        if (!origin || origin.startsWith('http://localhost') || origin.startsWith('file://')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
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
    return new GoogleGenAI(apiKey);
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
        const modelInstance = ai.getGenerativeModel({
            model: model || 'gemini-3-flash-preview'
        });

        const result = await modelInstance.generateContent({
            contents,
            ...config
        });

        res.json({
            text: result.response.text() || '',
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

// 在生产环境下提供静态文件
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// 处理 SPA 路由
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`🚀 代理服务器运行在 http://localhost:${PORT}`);
});
