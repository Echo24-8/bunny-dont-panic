# 兔兔别慌

一个原生 Canvas 2D 浏览器小游戏：第一关是 30 秒轻松教学，第二关突然切换为 60 秒高密度弹幕挑战。

## 运行

```powershell
npm test
npm run dev -- --host 0.0.0.0 --port 4173
```

桌面浏览器打开 `http://localhost:4173`。同一局域网内的手机可以使用终端输出的 `Network` 地址。

电脑使用方向键或 WASD 移动，数字键 1–3 选择升级；手机触摸战斗画面下半部分即可生成浮动摇杆。角色会自动瞄准并射击。

## 素材

项目不依赖第三方运行库或外部素材。毛绒水彩 PNG 和原创合成音频可通过以下命令重新生成：

```powershell
npm run generate:art
npm run generate:audio
```

`generate:audio` 使用本机 `ffmpeg` 将原创 PCM 配乐编码为 MP3。

## 结构

- `src/core/`：状态、对象池、升级、弹幕与世界模拟。
- `src/platform/`：浏览器输入、音频、存储和生命周期适配。
- `src/render/`：Canvas 场景与界面绘制。
- `assets/`：游戏实际加载的 PNG、MP3 和 WAV。
- `tests/`：Node 内置测试运行的纯逻辑用例。

当前版本不包含微信小游戏入口、广告、排行榜、账号或云存档。

