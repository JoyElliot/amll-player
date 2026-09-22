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
- 点击“长歌曲信息”后运行，检查长标题和两位歌手；点击“多人及自定义字体”后运行，检查三位歌手与自定义字体。
- 检查底栏、移动中与全屏的字号、字体族、字重、字距、行高、颜色、透明度和歌手伪元素分隔符一致，并在展开/收起交接瞬间分别取样对比。
- 手动观察底栏分隔线上移、卡片材质渐变、封面位移、歌曲信息从源位置直接平移到目标位置、按钮上浮/下拉，以及阴影、沉浸遮罩和视频画面交接；Tab/Shift+Tab 不应进入非活动页面，Escape 收起。

断言读取真实 DOM 几何、焦点、公开元素属性和媒体状态；不检查 dist 文本、CSS 哈希或源码正则。几何交接用例在真实 `hidePopover()` 调用前和清理后的微任务中取样，以免把歌词库仍在进行的独立布局动画误判为交接跳变。

## 实现边界

`isLyricPageOpenedAtom` 是唯一请求状态。底栏和歌词页位于同一张卡片，卡片固定为全视口高度，通过 `translateY` 从底栏分隔线向上覆盖页面；歌词内容随卡片上移，底栏反向平移保持在视口下方。背景页面保留顶部锚点缩小效果，独立遮暗层仅改变透明度。同一个真实 Cover 仅在移动时进入浏览器 top layer，保持布局尺寸，通过位移和缩放移动，原布局容器继续提供目标几何。

借鉴 develop 旧版的 transform / Web Animations 路径，卡片、封面、背景和文字共用浏览器动画时钟。控制器在开始或重定向时测量目标，不再用每帧 JavaScript 更新卡片高度、封面尺寸和继承 CSS 变量。文字曲线预采样为 61 个关键帧，保留慢起步的视觉效果；文字容器宽高仍会产生局部布局开销，封面滤镜和沉浸遮罩也不是纯合成动画。

整体时长为 500ms，卡片和封面使用 `cubic-bezier(.32,.72,.35,1)`。展开文字继续对局部进度 `p` 取平方，沿直线慢起步。收起时纵向按 `1-(1-p)²` 先回位，横向单独基于原始时间使用 `cubic-bezier(.25,.1,.25,1)`，容器尺寸随横向进度变化。这样横向在后段仍有可见移动，两个方向都在同一个 500ms 终点到位。按钮上浮淡出仍为 160ms，收起仍在 320–500ms 下拉显现；卡片材质、分隔线和歌词页透明度保持原先时长及延时。

底栏直接复用全屏 `MusicInfo`，以 `showMenuButton={false}` 隐藏底栏不需要的菜单，文字 ref 仍挂在内层信息容器。歌曲名、歌手的字重、透明度、字距与多人分隔均使用库原有样式；字体设置一致继承。初始、布局锚点变化或窗口 resize 时，读取活动全屏布局字号供底栏复用，避免复制横竖屏的字号公式。过渡仅改变容器位置和宽高，不再插值字体样式或在交接时改变歌手格式。

背景保留顶部缩放锚点及底栏封面按钮透明底色修复。卡片祖先使用 `overflow: clip`，避免视口外的卡片被焦点或 `scrollIntoView` 意外滚动。底栏的同一组歌曲名/歌手在 top layer 中从源位置移动到全屏文字位置；回程允许横纵分速，形成自然的纵向先行、横向跟进。不添加空间控制点、绕行或碰撞避让，也不改为源文字淡出后另一处文字淡入。公开的 `musicInfoProps` 提供当前布局目标，不改 TextMarquee 内部动画。

真实 DOM 检查分别验证展开共线、回程两轴单调且不越界；另检查回程初段纵向领先横向、400ms 横向仍有剩余行程、正常布局下文字在 500ms 交接，以及卡片和封面的布局尺寸在移动期间保持不变。中途反向、窗口变化或布局锚点更换时读取当前姿态并接续，原始时间重新从 0 开始；不保证重定向时速度连续。尺寸事件合并为一次 rAF；仅在终点复核目标，若库内布局弹簧仍在移动，最多追加四段 120ms 校正再交接，不逐帧追踪。共享文字移动期间停用目标文字自带的延迟滑入，交接时恢复原生规则。

全屏视频在打开时播放、收起时暂停；收起末尾保持真实 Cover 可见，等底栏视频定位到同一帧后交接。反向操作、换源、组件卸载会清理这段媒体事件等待。缺少 Popover API 或减少动态效果时直接切换终态。

交接不设重试或超时：若解码长期停滞且浏览器既不报告就绪也不报告错误，真实 Cover 会停在底栏位置等待，直到媒体事件或下一次操作使其结束。

横竖布局重建 Cover/video 是歌词库现有行为，控制器跟随公开 ref 接续几何；本任务不承诺跨布局重建后的视频播放时间连续，也不改封面解码就绪策略。

浏览器 fixture 不等同于 Tauri/WebView 桌面验收。原生窗口、真实音频服务、系统快捷键及打包后启动应在独立桌面测试中验证。
