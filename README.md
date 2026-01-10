# .

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
1. 视觉反馈 (Visual Feedback)
入场/离场提示: 当有新用户通过分享链接加入时，在顶部或角落给出一个优雅的 Toast 提示 (e.g. "🎵 某人悄悄地进来了")。
点歌抛物线: 当用户点击“添加到播放列表”时，让歌曲封面做一个抛物线动画飞入底部的播放列表图标中，增加操作确认感。
黑胶唱针拟真: 在 FullPlayer 的黑胶模式下，暂停时让唱针（如果有的话）缓缓移开，播放时缓缓移回。
背景律动: 如果能分析音频（需要 Web Audio API），让背景的模糊光晕随着音乐节奏轻微缩放或变色。
2. 只有“听”不够 (Social & Interaction)
实时表情 (Emotes): 在播放器界面加几个表情按钮（比如 ❤️, 🔥, 😂）。点击后，所有人的屏幕上都会冒出对应的气泡动画。
在线用户墙: 在 PlayerBar 或 FullPlayer 的角落显示当前房间在线人数，甚至是用一组小头像展示谁在听。
正在点歌...: 当有人在搜索框输入时，提示其他人 "某人正在选歌..."，增加一种陪伴感。
3. 播放控制细节 (Control Detail)
切歌通知: 当歌曲被切掉（上一首/下一首/插队）时，显示是谁进行了操作 (e.g. "User A 切掉了这首歌")，防止由于网络延迟导致的“莫名其妙切歌”疑惑。
插队功能: 现在的播放列表是追加到末尾。可以增加一个 "下一首播放" (Play Next) 的功能，方便急着听的歌插队。
同步移除: 允许在播放列表中删除歌曲，并同步给所有人（目前只有追加）。
4. 歌词体验 (Lyrics Experience)
空行优化: 现在的歌词如果有大段间奏，会显示空白。可以解析 [inst] 标记，或者检测长时间无歌词时显示 "✨ 间奏 ✨" 或 "Music..."。
翻译/罗马音: 如果 API 支持，可以添加原文/译文的切换或并排显示。
5. 移动端适配
手势操作: 在 FullPlayer 支持下拉关闭、左右滑动切歌的手势，更符合移动端直觉。