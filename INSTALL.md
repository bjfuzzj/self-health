# 安装说明：给用户和 WorkBuddy

## 1. 取得独立项目目录

使用用户提供的仓库地址。先读取本文件，再下载源码。Git 可用时克隆到一个不存在的新目录；没有 Git 时可从该仓库下载源码 ZIP 并解压。不猜测仓库所有者或分支，不执行来历不明的远程脚本。

若目录已存在，先检查是不是已有 康记 安装。已有 data/health-data.json 时绝不重置、覆盖或切换到演示数据。更新按 docs/维护与备份.md 执行。

把解压后的实际项目根目录加入桌面 WorkBuddy 工作空间；根目录须包含 server.py、CODEBUDDY.md 和 .codebuddy/skills/health-record/SKILL.md。不要把源码上一级目录或 ZIP 当项目。

## 2. 检查 Python

需要 Python 3.10+，没有额外第三方运行依赖。

- macOS：尝试 `python3 --version`。
- Windows：先尝试 `py -3 --version`；不可用时尝试 `python --version`、`python3 --version`，排除只有 Microsoft Store 跳转提示的别名。
- 缺少 Python 或版本过低时，向用户说明实际问题，引导使用 [Python 官方下载](https://www.python.org/downloads/)；Windows 安装时启用 Python Launcher / PATH。安装后重新打开终端或 WorkBuddy，再检查。不要未经授权修改系统策略或安装全局工具。

下文 PY 表示已验证可用的命令，macOS 通常为 python3，Windows 通常为 py -3；不要直接执行字面量 PY。

## 3. 初始化和只读检查

在项目根目录执行：

```text
PY tools/setup.py
PY tools/setup.py --doctor
```

两个命令必须成功退出并返回 `ok: true`。核对 doctor 的实际 dataFile 和 skillPresent。初始化是幂等的，已有数据不变；doctor 不修复也不修改数据。

查看 CODEBUDDY.md 和 `.codebuddy/skills/health-record/SKILL.md`。项目技能通过 WorkBuddy 项目机制加载；若当前版本未发现，在项目新开对话，或明确要求助手读取上述技能文件。不把“文件存在”当成“技能已启用”的证据。菜单名称随版本变化；必要时按 WorkBuddy 官方说明导入技能包。

参考：[项目](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)、[技能](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)。

## 4. 建立个人档案

说明一次：文件在本机；识别图片使用 WorkBuddy 服务；本安装只管理一人。先问称呼和希望“仅记录”还是主动设置目标，其他信息可逐步补充，允许跳过。

CLI 例子（只有用户实际提供后才能填入）：

```text
PY tools/log.py profile --name "用户提供的称呼" --goal record_only
```

性别、生日、身高等通过 profile 可选参数写入。未知不猜、不从演示数据复制。不预设减脂，不把目标速率当成实测预测。

## 5. 面板检查

需要看图表时执行 `PY server.py`，或使用系统启动脚本。服务只监听 127.0.0.1，实际端口以输出为准。确认 /api/ping 返回 ok、首页可打开。不要把本机地址发给手机并宣称手机能直接打开。

没有个人记录的首次安装，不为了演示往真实档案写测试数据。可通过 `?demo=1` 看虚构示例。自动测试在临时目录进行，运行后不会进入个人档案。

## 6. 手机使用

在桌面 WorkBuddy 开启移动连接，手机使用该使用者自己的同一账号，连接这台在线电脑，进入 康记 项目。电脑需联网并允许后台运行；锁屏运行按 WorkBuddy 官方设置处理。

参考：[官方多端协同](https://www.codebuddy.cn/docs/workbuddyapp/features/Multidevice)。

完成时报告实际安装目录、Python 版本、初始化/doctor 结果、是否亲自验证面板及手机链路。未测过的项目明确写“待验证”，不要笼统说全部安装成功。
