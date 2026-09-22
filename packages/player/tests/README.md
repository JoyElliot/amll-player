# 播放页过渡验证

`transition.html` 挂载真实 `NowPlayingBar`、`AMLLWrapper`、`PlaybackTransition` 和歌词库组件，使用独立 Jotai store，不连接 Tauri 音频或文件服务。它不会进入生产构建入口。

## 两仓依赖

此分支依赖歌词库 `prebuilt-player-controls` 分支新增的公开接口。先合入并发布歌词库，再在 Player 中更新正式版本及 lockfile，最后合入 Player。仓库中保留原正式依赖版本，不提交本机路径或伪造未发布版本；直接从发布的旧库重新安装不能验证此分支。

本地联调使用 pack，避免 pnpm link 引入第二份 React/Jotai：

```powershell
# applemusic-like-lyrics 仓库根目录
pnpm install --frozen-lockfile
pnpm nx run '@applemusic-like-lyrics/react-full:build'
$amllTarball = Join-Path (Split-Path (Get-Location)) 'react-full-local.tgz'
pnpm --filter '@applemusic-like-lyrics/react-full' pack --out $amllTarball

# amll-player 仓库根目录
pnpm install --frozen-lockfile
$amllTarball = (Resolve-Path ../react-full-local.tgz).Path.Replace('\', '/')
pnpm --filter player add "@applemusic-like-lyrics/react-full@file:$amllTarball"
pnpm exec tsgo -p packages/player/tsconfig.json --noEmit
pnpm --filter player build
pnpm --filter player dev --host 127.0.0.1 --port 1427 --force
```

以上假定两个仓库位于同一父目录，临时 tarball 写到该父目录。每次重新打包后重新安装、重启 Vite 并加 `--force`，确保不会继续使用旧的依赖预构建缓存。完成联调后只还原本次本地依赖替换产生的 `packages/player/package.json` 和 `pnpm-lock.yaml` 差异，不覆盖其他人的修改。

pnpm 11 可能在运行命令前自动按 manifest 同步依赖；还原 manifest 后再次联调前，需重新执行本地包接入步骤。

## 浏览器步骤

打开 `http://127.0.0.1:1427/tests/transition.html`，点击“运行检查”。结果显示在页面右下角；失败会显示已通过的检查和具体断言。

- 在横屏 1280×720、竖屏 390×844 各运行一次。
- 开启系统/浏览器的 `prefers-reduced-motion: reduce` 后重新运行，确认直接进入终态、焦点及不可交互区域仍正确。
- 点击“视频封面”，等待本地测试视频生成，再运行。检查真实 video 节点保留、收起后两处视频暂停且时间一致，以及视频交接等待中 resize 不会写回已清理的文字临时样式。
- 点击“中途变更：关”启用中途变更再运行。用例在展开约 90ms 后暂停音乐并切到沉浸布局，检查交接瞬间几何连续。
- 点击“切换”后，在动画进行中改变窗口横竖方向，再收起。检查仅一个全屏封面、无残留 popover/临时几何、焦点回到入口。
- 点击“长歌曲信息”后运行，检查长标题和多位歌手的直线移动与清理。
- 手动观察底栏分隔线上移、卡片材质渐变、封面位移、歌曲信息从源位置直接平移到目标位置、按钮上浮/下拉，以及阴影、沉浸遮罩和视频画面交接；Tab/Shift+Tab 不应进入非活动页面，Escape 收起。

断言读取真实 DOM 几何、焦点、公开元素属性和媒体状态；不检查 dist 文本、CSS 哈希或源码正则。几何交接用例在真实 `hidePopover()` 调用前和清理后的微任务中取样，以免把歌词库仍在进行的独立布局动画误判为交接跳变。

## 实现边界

`isLyricPageOpenedAtom` 是唯一请求状态，控制器保存当前呈现进度以接续反向动画。底栏和歌词页位于同一张卡片，卡片从底栏分隔线向上扩展到整个视口；歌词内容随卡片上移，背景页面保留缩小效果。同一个真实 Cover 仅在移动时进入浏览器 top layer，原布局容器继续提供目标几何。暂停样式和尺寸变化会从当前画面更新目标。

整体时长恢复为 500ms，仅将时间缓动曲线改为 `cubic-bezier(.32,.72,.35,1)`，减轻起步过快。按钮上浮淡出仍为 160ms，收起仍在 320–500ms 下拉显现；卡片材质、分隔线和歌词页透明度恢复原先时长及延时。测试测量真实文字交接时间，区分缓动调整与延长总时长。

背景保留顶部缩放锚点及底栏封面按钮透明底色修复。底栏的同一组歌曲名/歌手在 top layer 中直接从源位置移动到全屏文字位置，横纵坐标使用同一个进度进行线性插值，字号、行高和样式同步过渡；关闭时直接返回。不添加控制点、绕行或封面避让，也不改为源文字淡出后另一处文字淡入。公开的 `musicInfoProps` 提供当前布局目标，不改 TextMarquee 内部动画。

直线检查逐帧读取真实 DOM，验证文字位置与起终点共线且不越出线段；不再用文字是否与封面矩形相交决定路径。中途反向、窗口变化或布局锚点更换时从当前姿态接续。

全屏视频在打开时播放、收起时暂停；收起末尾保持真实 Cover 可见，等底栏视频定位到同一帧后交接。反向操作、换源、组件卸载会清理这段媒体事件等待。缺少 Popover API 或减少动态效果时直接切换终态。

交接不设重试或超时：若解码长期停滞且浏览器既不报告就绪也不报告错误，真实 Cover 会停在底栏位置等待，直到媒体事件或下一次操作使其结束。

横竖布局重建 Cover/video 是歌词库现有行为，控制器跟随公开 ref 接续几何；本任务不承诺跨布局重建后的视频播放时间连续，也不改封面解码就绪策略。

浏览器 fixture 不等同于 Tauri/WebView 桌面验收。原生窗口、真实音频服务、系统快捷键及打包后启动应在独立桌面测试中验证。
