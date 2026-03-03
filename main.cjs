const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;

function startServer() {
    console.log('正在启动后端服务器...');
    const serverPath = isDev
        ? path.join(__dirname, 'server', 'index.ts')
        : path.join(process.resourcesPath, 'server', 'index.js');

    // 在开发模式下使用 tsx 启动，打包后使用 node 启动
    if (isDev) {
        serverProcess = spawn('npx', ['tsx', serverPath], {
            shell: true,
            env: { ...process.env, NODE_ENV: 'development' }
        });
    } else {
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, NODE_ENV: 'production' }
        });
    }

    serverProcess.stdout.on('data', (data) => {
        console.log(`Server: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data}`);
    });
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
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    startServer();
    // 等待服务器启动（简单处理，后续可优化为健康检查）
    setTimeout(createWindow, 2000);
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

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
