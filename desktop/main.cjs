const { app, BrowserWindow, shell, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
let server;
let origin;
app.setName('Zoderise 3D Map');
app.setAppUserModelId('com.zoderise.map3d');
if (process.env.ZODERISE_SMOKE_TEST) app.setPath('userData', path.resolve(process.env.ZODERISE_SMOKE_TEST, 'test-settings'));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { w.restore(); w.focus(); } });
  app.whenReady().then(async () => {
    const runtime = path.join(__dirname, 'runtime');
    const settings = app.getPath('userData');
    fs.mkdirSync(settings, { recursive: true });
    process.chdir(settings);
    const { parseEnv } = require('node:util');
    // Desktop users configure their own providers in POWER UP.
    const envPath = path.join(settings, '.env');
    if (fs.existsSync(envPath)) Object.assign(process.env, parseEnv(fs.readFileSync(envPath, 'utf8')));
    const load = p => import(pathToFileURL(path.join(runtime, p)).href);
    const [{ localProviderPlugins }, { keySetupEndpoint }, { BROWSER_HEADERS }, { default: connect }, { default: sirv }, http] = await Promise.all([
      load('server/providers/local.js'), load('server/standalone/key-setup.js'), load('headers.js'), import('connect'), import('sirv'), import('node:http')
    ]);
    const middleware = connect();
    server = http.createServer(middleware);
    middleware.use((req, res, next) => {
      if (!['127.0.0.1', 'localhost'].includes((req.headers.host || '').split(':')[0])) { res.writeHead(403); res.end(); return; }
      for (const [k,v] of Object.entries(BROWSER_HEADERS)) res.setHeader(k, v);
      next();
    });
    const host = { middlewares: middleware, httpServer: server, restart: async () => { for (const w of BrowserWindow.getAllWindows()) w.webContents.reload(); } };
    const { standaloneVoiceTools } = await load('server/standalone/voiceTools.js');
    for (const plugin of localProviderPlugins({ realtime: { tools: standaloneVoiceTools() } })) {
      if (plugin.name !== 'gev-key-setup') await plugin.configureServer?.(host);
    }
    keySetupEndpoint({ sourceRoot: settings }).configureServer(host);
    middleware.use('/api', (req, res) => { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"Unknown API route"}'); });
    middleware.use((req, res, next) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!/^\/assets\/[\w.-]+\.js$/.test(pathname)) return next();
      const file = path.join(runtime, 'dist', pathname);
      if (!fs.existsSync(file)) return next();
      let text = fs.readFileSync(file, 'utf8');
      if (!text.includes('__ZODERISE_')) return next();
      text = text.replaceAll('"__ZODERISE_GOOGLE_KEY__"', JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || '')).replaceAll('"__ZODERISE_CESIUM_TOKEN__"', JSON.stringify(process.env.CESIUM_ION_TOKEN || ''));
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(text);
    });
    middleware.use(sirv(path.join(runtime, 'dist'), { single: true }));
    await new Promise((resolve, reject) => {
      server.once('error', error => {
        if (error.code === 'EADDRINUSE') { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }
        else reject(error);
      });
      server.listen(17473, '127.0.0.1', resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    const workArea = screen.getPrimaryDisplay().workArea;
    const window = new BrowserWindow({ show: false, width: Math.min(1440, workArea.width), height: Math.min(960, workArea.height), title: 'Zoderise 3D Map', icon: path.join(__dirname, 'icon.png'), backgroundColor: '#070d18', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: !process.env.ZODERISE_SMOKE_TEST } });
    window.setMenu(null);
    window.maximize();
    window.webContents.setZoomFactor(1);
    window.webContents.on('did-finish-load', () => window.webContents.setZoomFactor(1));
    if (!process.env.ZODERISE_SMOKE_TEST) window.show();
    window.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) { event.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); } });
    await window.loadURL(origin);
    await window.webContents.setVisualZoomLevelLimits(1, 1);
    if (process.env.ZODERISE_SMOKE_TEST) {
      await new Promise(resolve => setTimeout(resolve, 15000));
      let viewport;
      if (process.env.ZODERISE_VIEWPORT_TEST) {
        await window.webContents.executeJavaScript(`(async () => { for (let i = 0; i < 150; i++) { if (document.querySelector('#loading-screen')?.classList.contains('hidden')) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('Map startup did not finish'); })()`);
        await window.webContents.executeJavaScript(`document.querySelector('[data-first-run-choice="explore"]')?.click(); document.querySelector('#reset-globe-view')?.click();`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        viewport = await window.webContents.executeJavaScript(`(() => { const c = document.querySelector('#cesiumContainer canvas'); const r = c.getBoundingClientRect(); return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, canvas: { x: r.x, y: r.y, width: r.width, height: r.height, pixelsWidth: c.width, pixelsHeight: c.height }, hud: document.querySelector('#intel-hud')?.textContent }; })()`);
        viewport.windowBounds = window.getBounds();
        viewport.workArea = screen.getDisplayMatching(window.getBounds()).workArea;
        viewport.zoom = window.webContents.getZoomFactor();
        const altitude = () => window.webContents.executeJavaScript(`Number(document.querySelector('#intel-hud')?.textContent.match(/ALT:\\s*(\\d+)m/)?.[1])`);
        const x = Math.floor(viewport.width / 2);
        const y = Math.floor(viewport.height / 2);
        viewport.wheel = { before: await altitude() };
        const wheel = (deltaY, ctrlKey = false) => window.webContents.executeJavaScript(`document.querySelector('#cesiumContainer canvas').dispatchEvent(new WheelEvent('wheel', { clientX: ${x}, clientY: ${y}, deltaY: ${deltaY}, ctrlKey: ${ctrlKey}, deltaMode: 0, bubbles: true, cancelable: true }))`);
        await wheel(-120);
        await new Promise(resolve => setTimeout(resolve, 2000));
        viewport.wheel.afterIn = await altitude();
        await wheel(120);
        await new Promise(resolve => setTimeout(resolve, 2000));
        viewport.wheel.afterOut = await altitude();
        viewport.wheel.pageZoomAfter = window.webContents.getZoomFactor();
        viewport.pinch = { before: await altitude() };
        await wheel(-3, true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        viewport.pinch.afterIn = await altitude();
        await wheel(3, true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        viewport.pinch.afterOut = await altitude();
        viewport.pinch.pageZoomAfter = window.webContents.getZoomFactor();
      }
      const result = await window.webContents.executeJavaScript(`(async () => ({ title: document.title, heading: document.querySelector('#title-bar h1')?.textContent, credits: document.querySelector('#title-bar .subtitle')?.textContent, canvas: !!document.querySelector('#cesiumContainer canvas'), loading: document.querySelector('#loading-screen')?.className, status: await fetch('/api/setup/status').then(r => ({ ok: r.ok, status: r.status })), nodeExposed: typeof window.require !== 'undefined' }))()`);
      if (viewport) result.viewport = viewport;
      fs.mkdirSync(process.env.ZODERISE_SMOKE_TEST, { recursive: true });
      fs.writeFileSync(path.join(process.env.ZODERISE_SMOKE_TEST, 'smoke-result.json'), JSON.stringify(result, null, 2));
      fs.writeFileSync(path.join(process.env.ZODERISE_SMOKE_TEST, 'screenshot.png'), (await window.webContents.capturePage()).toPNG());
      if (process.env.ZODERISE_DOC_SCREENSHOTS) {
        await window.webContents.executeJavaScript(`document.querySelector('[data-style="thermal"]')?.click()`);
        await new Promise(resolve => setTimeout(resolve, 2500));
        fs.writeFileSync(path.join(process.env.ZODERISE_SMOKE_TEST, 'thermal.png'), (await window.webContents.capturePage()).toPNG());
      }
      app.quit();
    }
  }).catch(error => {
    if (process.env.ZODERISE_SMOKE_TEST) {
      fs.mkdirSync(process.env.ZODERISE_SMOKE_TEST, { recursive: true });
      fs.writeFileSync(path.join(process.env.ZODERISE_SMOKE_TEST, 'smoke-error.txt'), error.stack || String(error));
    } else dialog.showErrorBox('Zoderise 3D Map could not start', error.stack || String(error));
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { server?.close(); server?.closeAllConnections(); });
}
