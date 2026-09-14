# PR #73 Windows 视觉测试版

对应更新：fix(player): 等待音频事件监听就绪后发送命令。

`codex/visual-pr-73` 从该 PR 的源提交 `abcc0e73affd552f4225734969a863949a7bb5c0` 创建，产品文件与该 PR 保持一致。新增的测试工作流和本说明只保留在测试分支。

推送测试分支会自动触发独立的 CI。构建会检查源代码边界、前端类型，执行该 PR 已有的专项测试，再生成 Windows x64 EXE。也可以从 Actions 的现有构建入口选择此分支手动运行。

在对应运行页面下载 `AMLL-Player-PR-73-windows-x64-...` Artifact，解压整个包后运行 `amll-player.exe`。包内 `build-info.json` 记录 PR 源提交及构建提交，`SHA256SUMS.txt` 提供文件校验值。

应用名称为 `AMLL Player PR 73`，标识为 `net.stevexmh.amllplayer.visualtest.pr73`。数据与正式版及其他 PR 测试版分开，首次打开需导入测试歌曲。电脑需要 WebView2 Runtime。

测试包保留 14 天，不生成安装包、不发布 Release，也不提供自动更新。
