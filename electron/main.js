const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net, shell, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");

const isDev = process.env.ELECTRON_DEV === "1";
const DEV_URL = "http://localhost:3123";
const OUT_DIR = path.join(__dirname, "..", "out");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow;

// ── Appearance (persisted so the window opens with the right colours) ──
const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");
const BG = { light: "#f6f6f8", dark: "#0a0b0f" };
const appearance = { mode: "system", accent: "violet", accents: [] };

function loadAppearance() {
  try {
    const data = JSON.parse(require("node:fs").readFileSync(SETTINGS_FILE(), "utf8"));
    if (["system", "light", "dark"].includes(data.mode)) appearance.mode = data.mode;
    if (typeof data.accent === "string") appearance.accent = data.accent;
  } catch {}
  nativeTheme.themeSource = appearance.mode;
}

function saveAppearance() {
  fs.writeFile(SETTINGS_FILE(), JSON.stringify({ mode: appearance.mode, accent: appearance.accent })).catch(() => {});
}

const currentBg = () => (nativeTheme.shouldUseDarkColors ? BG.dark : BG.light);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Automata Studio",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: currentBg(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(isDev ? DEV_URL : "app://local/index.html");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function send(channel) {
  if (mainWindow) mainWindow.webContents.send("menu", channel);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Arquivo",
      submenu: [
        { label: "Novo…", accelerator: "CmdOrCtrl+N", click: () => send("new") },
        { label: "Abrir…", accelerator: "CmdOrCtrl+O", click: () => send("open") },
        { type: "separator" },
        { label: "Salvar", accelerator: "CmdOrCtrl+S", click: () => send("save") },
        { label: "Salvar como…", accelerator: "CmdOrCtrl+Shift+S", click: () => send("saveAs") },
        { label: "Exportar como .jff (JFLAP)…", click: () => send("exportJff") },
        { label: "Exportar imagem SVG…", click: () => send("exportSvg") },
        { type: "separator" },
        { label: "Fechar aba", accelerator: "CmdOrCtrl+W", click: () => send("closeTab") },
        ...(isMac ? [] : [{ role: "quit", label: "Sair" }]),
      ],
    },
    {
      label: "Editar",
      submenu: [
        { label: "Desfazer", accelerator: "CmdOrCtrl+Z", click: () => send("undo") },
        { label: "Refazer", accelerator: "CmdOrCtrl+Shift+Z", click: () => send("redo") },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar tudo" },
      ],
    },
    {
      label: "Visualizar",
      submenu: [
        {
          label: "Aparência",
          submenu: [
            ...[
              ["system", "Seguir o sistema"],
              ["light", "Claro"],
              ["dark", "Escuro"],
            ].map(([mode, label]) => ({
              label,
              type: "radio",
              checked: appearance.mode === mode,
              click: () => send(`mode:${mode}`),
            })),
            { type: "separator" },
            { label: "Alternar claro/escuro", accelerator: "CmdOrCtrl+Shift+L", click: () => send("toggleTheme") },
          ],
        },
        ...(appearance.accents.length
          ? [
              {
                label: "Tema de cor",
                submenu: appearance.accents.map((a) => ({
                  label: a.name,
                  type: "radio",
                  checked: appearance.accent === a.id,
                  click: () => send(`accent:${a.id}`),
                })),
              },
            ]
          : []),
        { label: "Ajustar à tela", accelerator: "CmdOrCtrl+0", click: () => send("fit") },
        { type: "separator" },
        { role: "reload", label: "Recarregar" },
        { role: "toggleDevTools", label: "Ferramentas de desenvolvedor" },
        { role: "togglefullscreen", label: "Tela cheia" },
      ],
    },
    { role: "windowMenu", label: "Janela" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const FILTERS = [
  { name: "Autômatos", extensions: ["automata", "jff", "json"] },
  { name: "JFLAP", extensions: ["jff"] },
  { name: "Todos os arquivos", extensions: ["*"] },
];

ipcMain.handle("file:open", async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], filters: FILTERS });
  if (res.canceled || !res.filePaths[0]) return null;
  const filePath = res.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  return { filePath, name: path.basename(filePath), content };
});

ipcMain.handle("file:save", async (_e, { filePath, defaultName, content, filters }) => {
  let target = filePath;
  if (!target) {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: filters || FILTERS,
    });
    if (res.canceled || !res.filePath) return null;
    target = res.filePath;
  }
  await fs.writeFile(target, content, "utf8");
  return { filePath: target, name: path.basename(target) };
});

ipcMain.handle("theme:set", (_e, { mode, accent, accents }) => {
  const changed = mode !== appearance.mode || accent !== appearance.accent || !appearance.accents.length;
  if (["system", "light", "dark"].includes(mode)) appearance.mode = mode;
  if (typeof accent === "string") appearance.accent = accent;
  if (Array.isArray(accents)) appearance.accents = accents;
  nativeTheme.themeSource = appearance.mode;
  if (mainWindow) mainWindow.setBackgroundColor(currentBg());
  if (changed) {
    saveAppearance();
    buildMenu();
  }
  return nativeTheme.shouldUseDarkColors;
});

nativeTheme.on("updated", () => {
  if (mainWindow) mainWindow.setBackgroundColor(currentBg());
});

app.whenReady().then(() => {
  loadAppearance();
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const filePath = path.normalize(path.join(OUT_DIR, rel));
    if (!filePath.startsWith(OUT_DIR)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(filePath).toString());
  });

  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
