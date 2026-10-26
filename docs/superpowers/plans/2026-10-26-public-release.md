# VITALS 单人公开版实施计划

> 执行方式：当前会话按 executing-plans 顺序实施，使用独立发布目录；原目录不是 Git 仓库，不创建 worktree，不提交或发布真实数据。

**Goal:** 从 GitHub 地址和安装指令复现单人健康记录工作流。

**Architecture:** 原生面板 + Python 标准库共享存储 + CLI + 项目级健康 Skill。运行时数据不进入发行包，图片识别使用 WorkBuddy。

**Tech Stack:** Python 3.10+、HTML/CSS/JavaScript、unittest、Node 内置测试、GitHub Actions。

## 1. 存储与安装
- [x] tests/test_core.py 先验证初始化无预置个人信息、重复初始化不丢数据、错误结构拒绝、修订冲突拒绝、多进程写入、备份保留、附件去重。
- [x] 创建 storage.py、tools/setup.py；默认路径 data，测试通过 VITALS_DATA_DIR 隔离。
- [x] 命令：python3 -B -m unittest discover -s tests -v，先观察缺失功能失败再实施并运行通过。

## 2. 对话录入
- [x] tests/test_cli.py 通过 subprocess 验证 record/list/update/delete、旧命令兼容、sourceKey 去重、营养汇总同步、非法数值拒绝。
- [x] tools/log.py 复用共享存储；新增 JSON 输入；附件存放 data/attachments；明确日期/时段。
- [x] 临时目录完成一餐、一次运动、一条体成分、纠错和删除的闭环；查询结果与保存回执一致。

## 3. 服务与前端
- [x] tests/test_http.py 验证来源/Host 校验、冲突 409、只公开面板资源、不公开备份与图片。
- [x] tests/frontend.test.cjs 验证 CSV 不删除睡前读数、不将活动消耗当总消耗。
- [x] 修改 server.py 和 assets/app.js；共享存储，API 实际加载，保存失败保留待保存状态；拒绝覆盖冲突。
- [x] 命令：node --test tests/frontend.test.cjs；node --check assets/app.js；Python 全套测试。

## 4. 分发
- [x] 编写 .codebuddy/skills/health-record/SKILL.md、CODEBUDDY.md、INSTALL.md、README.md、隐私/更新说明。
- [x] 创建启动.bat、保留启动.command，setup 提供 --doctor，CI 覆盖两个 OS。
- [x] tools/package_release.py 按白名单生成 ZIP；测试包中无运行时数据/个人记忆，解压后可初始化。
- [x] 校验所有文档引用与技能元信息。写入实际验证结果及 Windows/WorkBuddy 待验收项。

## 5. 完成验证
- [x] 临时数据跑全套测试，浏览器验证六个视图、主题、保存及冲突。
- [x] 对照原项目文件哈希确认个人数据和源码未改变。
- [x] 输出干净源码目录、ZIP、安装提示词与验收限制；用户提供目标仓库后再执行 GitHub 发布。


## 执行结果

各本地实施步骤已完成。本地发行包已完成，公开发布和 CI 状态以 GitHub 仓库为准。Windows 实机和 WorkBuddy 真实手机链路不在当前电脑上可验证，已作为验收缺口记录在 docs/验证记录.md；CI 配置不冒充运行结果。原项目不是 Git 仓库，本次仅在独立发布目录初始化 Git，未初始化原目录或提交个人数据。
