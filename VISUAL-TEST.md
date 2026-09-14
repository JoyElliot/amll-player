# Windows 视觉测试版

`codex/visual-test` 合入了 PR #73 至 #78，方便一次检查目前拆出的六项更新。

推送这个分支会自动构建 Windows x64 测试版，也可以在 Actions 页面手动运行「构建 PR 视觉测试版」。构建会先检查前端类型、专项测试和音频解码器回归测试，再通过 Tauri 构建可直接运行的 EXE。

在对应 Actions 运行页面下载 `AMLL-Player-visual-windows-x64-...` Artifact，解压整个下载包，然后运行 `amll-player.exe`。电脑需要已安装 WebView2 Runtime。包内的 `build-info.json` 记录版本、源代码提交和构建链接，`SHA256SUMS.txt` 提供文件校验值。

测试版使用 `net.stevexmh.amllplayer.visualtest` 作为应用标识，数据库、封面、设置和 WebView 存储与正式版分开。首次使用需要重新导入测试歌曲；后续这个分支的测试版会复用这份测试数据。

可重点检查：

- 音频初始化和开始播放。
- 歌曲文件信息读取与封面。
- 歌词中字母下伸部分的显示。
- 文件和封面选择窗口的交互。
- 暂停时拖动进度，再恢复播放。
- 全屏下鼠标操作与键盘导航的焦点样式。

工作流只上传未签名的 Actions Artifact，保留 14 天；不生成安装包、不发布 Release，也不提供自动更新。测试配置在构建时临时生成，这些工作流调整只保留在测试分支中。
