import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 自定义 Vite 插件：移除 HTML 中的 crossorigin 属性
 * 原因：Electron 使用 file:// 协议加载页面，crossorigin 属性会导致
 * Chromium 对本地文件发起 CORS 预检请求，从而阻止 JS 执行
 */
function removeCrossorigin() {
  return {
    name: 'remove-crossorigin',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      return html.replace(/ crossorigin/g, '');
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // 使用相对路径，确保 file:// 协议下能正确加载资源
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      tailwindcss(),
      react(),
      removeCrossorigin(),
    ],
    build: {
      // 禁用 modulePreload，避免在 file:// 下触发无效的预加载请求
      modulePreload: false,
    },
    define: {
      // API Key 已移至后端服务，前端不再需要
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
