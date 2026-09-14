# 候选 08：播放暂停按钮旋转切换动画

产品分支：`codex/pr-08-play-pause-animation`  
产品提交：`4b19a8d3384f47fcde9423e4f0d18632c63316e8`  
包含前置：PR #75、候选 07

本分支用于构建 Windows x64 视觉测试包，产品代码与上述提交完全一致。构建配置仅存在于此测试分支。

每个候选使用独立的数据目录。下载 Actions 产物并完整解压后，运行 `amll-player.exe`。需要 Windows WebView2 Runtime。

构建使用独立应用标识，不提供安装包和自动更新。`build-info.json` 记录源提交、前置改动、版本和构建链接，`SHA256SUMS.txt` 可核对下载内容。
