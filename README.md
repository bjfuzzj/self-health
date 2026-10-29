# 康记 · WorkBuddy 个人健康记录助手

新增：手机 H5 与 MySQL 云端版，支持 WorkBuddy 和 H5 共用云端档案。默认本地安装方式仍保持独立；云端部署、迁移和验收边界见 [部署说明](cloud/DEPLOYMENT.md)。H5 演示数据与真实档案隔离，未配置模型时使用手动录入。

[![跨平台测试](https://github.com/bjfuzzj/self-health/actions/workflows/test.yml/badge.svg)](https://github.com/bjfuzzj/self-health/actions/workflows/test.yml)

把饮食照片、运动描述和体脂秤截图发给 WorkBuddy，形成可纠错、可备份的个人健康记录。支持 Windows 和 macOS 的运行入口；不需要单独购买或配置模型 API。

每次安装只管理一个人。每位使用者用自己的 WorkBuddy 账号连接自己的电脑。日常录入不要求本地面板服务一直开着，但电脑和 WorkBuddy 必须在线；看图表时再启动面板。

## 发给 WorkBuddy 的安装指令

将下面这段话直接发送给桌面端 WorkBuddy：

> 请安装这个 康记 健康记录项目：https://github.com/bjfuzzj/self-health 。先阅读仓库 INSTALL.md，再下载到独立目录，不覆盖已有安装或个人数据。检查 Python 环境，执行幂等初始化和 doctor，把该目录作为 WorkBuddy 项目，读取 CODEBUDDY.md 并启用 health-record 项目技能。默认仅记录，不替我设置减脂目标。完成后告诉我实际安装路径、检查结果，以及手机端该进入哪个项目。暂时不要写入测试健康记录。

GitHub 下载、Python 检查和操作权限可能需要用户配合；这是一套助手执行流程，不是 WorkBuddy 官方承诺的任意 GitHub 一键安装功能。安装失败时见 [安装说明](INSTALL.md)。

## 日常怎么用

在手机 WorkBuddy 中连接自己的电脑，进入 康记 项目对话。可以说：

- 发一张饭菜照片：“这是今天午饭，我吃了大约一半。”
- “昨天下午散步 30 分钟。”
- 发体脂秤截图：“今天早上空腹称的。”
- “刚才的米饭只吃了半碗，帮我修改。”
- “今天记了什么？”“这周体重有什么变化？”

助手会把识别结果交给本地录入工具，保存后回显日期、内容和记录 ID。照片份量与营养是估算，截图看不清的关键数值会先询问。重复附件会去重；纠错修改原记录。换新对话也应在同一项目下，并加载健康技能。

## 手动启动

需要 Python 3.10+，无第三方 Python 依赖。

macOS：

```bash
python3 tools/setup.py
python3 tools/setup.py --doctor
python3 server.py
```

Windows PowerShell：

```powershell
py -3 tools/setup.py
py -3 tools/setup.py --doctor
py -3 server.py
```

也可双击 `启动.command`（macOS）或 `启动.bat`（Windows）。浏览器打开终端输出的本机地址，默认 `http://127.0.0.1:8931/`。如果系统阻止脚本，使用上面的终端命令，无需关闭系统安全功能。

演示：启动服务后，在地址末尾加 `?demo=1`。演示数据完全虚构，不会写入个人档案。直接打开 index.html 仅能显示默认 data 目录中的只读快照；推荐通过服务访问。

## 保存在哪里

- `data/health-data.json`：唯一事实源。
- `data/health-data.js`：直接打开 HTML 时的只读副本。
- `data/attachments/`：通过 `--photo` 保存的原始图片，按内容摘要命名。
- `data/backups/`：最近 80 次保存前的 JSON 快照。

`tools/setup.py` 可重复运行，不重置档案。只有首次才从 `templates/empty-data.json` 创建空白数据。程序更新保留整个 data 目录，详见 [维护与备份](docs/维护与备份.md)。通过 `VITALS_DATA_DIR` 可指定其他本地数据目录，服务端与 CLI 必须设置为同一路径。

## 能力和边界

本项目提供工具、记录规则与面板；图片理解和对话由 WorkBuddy 承担。相同照片在不同模型下可能得到不同估算。记录文件默认在本机，发给 WorkBuddy 的图片、语音与消息仍按其服务机制处理，详见 [隐私说明](docs/隐私说明.md)。

默认“仅记录”，不自动设置饮食目标。出生日期、性别等可不填；不足以计算的指标显示缺失。适合记录与回顾，不替代诊疗，不自动调整药物或为所有老人套用同一套减脂计划。

已进行的测试和未完成的平台验收见 [验证记录](docs/验证记录.md)。Windows 实机及 WorkBuddy 手机/电脑完整安装链路，须在对应环境验收后才能宣称已验证。

## 开发与打包

```bash
python3 -B -m unittest discover -s tests -v
node --test tests/frontend.test.cjs
node --check assets/app.js
node --check assets/charts.js
python3 tools/package_release.py
```

Node 仅用于开发验证，使用者不需要安装。发布 ZIP 采用文件白名单，排除 data、.workbuddy、缓存与本机配置；发布前仍需审阅实际包内容。CI 会在 Windows/macOS、Python 3.10/3.13 上执行验证。

项目结构：`storage.py` 为共享存储，`records.py` 为结构化录入，`tools/log.py` 为对话 CLI，`server.py` 为本机服务，`assets/` 为面板，`.codebuddy/skills/health-record/` 为 WorkBuddy 项目技能。

许可证：[MIT](LICENSE)。
