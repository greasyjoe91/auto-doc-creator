const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const isDev = !app.isPackaged;

let mainWindow;
let serverProcess; // 仅开发模式使用

const SERVER_PORT = 3001;

/**
 * 轮询等待后端服务器就绪
 */
function waitForServer(retries = 30) {
    return new Promise((resolve, reject) => {
        const check = (attempt) => {
            http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
                resolve();
            }).on('error', () => {
                if (attempt >= retries) {
                    reject(new Error('后端服务器启动超时'));
                } else {
                    setTimeout(() => check(attempt + 1), 500);
                }
            });
        };
        check(0);
    });
}

function startServer() {
    console.log('正在启动后端服务器...');

    if (isDev) {
        // 开发模式：用 tsx 运行 TypeScript 源码
        const { spawn } = require('child_process');
        serverProcess = spawn('npx', ['tsx', path.join(__dirname, 'server', 'index.ts')], {
            shell: true,
            env: { ...process.env, NODE_ENV: 'development' }
        });
        serverProcess.stdout.on('data', (data) => console.log(`Server: ${data}`));
        serverProcess.stderr.on('data', (data) => console.error(`Server Error: ${data}`));
    } else {
        // 生产模式：直接 require() 已编译的 CJS 服务器模块
        // 不能用 fork()，因为 Electron 的 fork 会使用 Electron 二进制而非 Node.js
        const serverPath = path.join(process.resourcesPath, 'server', 'index.cjs');
        console.log('加载服务器模块:', serverPath);
        require(serverPath);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "AutoDoc Flow",
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // 通过 http:// 加载前端（file:// 不支持 ES Module）
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', async () => {
    startServer();
    try {
        await waitForServer();
        console.log('后端服务器已就绪，正在打开窗口...');
        createWindow();
    } catch (err) {
        const { dialog } = require('electron');
        dialog.showErrorBox('启动失败', '后端服务器未能在规定时间内启动。\n' + err.message);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

app.on('activate', async () => {
    if (mainWindow === null) {
        try {
            await waitForServer(5);
            createWindow();
        } catch {
            createWindow();
        }
    }
});
