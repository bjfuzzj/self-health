# VITALS H5 云端部署

本版增加手机 H5、MySQL 单用户服务和 WorkBuddy 云端兼容入口。原有独立本地版仍可单独使用；同一个档案切换云端后，禁止再写本地 JSON。

## 部署结构

- 域名：`health.baihejie.cn`，H5 由 Nginx 提供，`/api/` 反向代理至 `127.0.0.1:8931`。
- 服务：Python 3.11 独立虚拟环境，单进程四线程，systemd `vitals-health.service`，独立系统用户 `vitals`。
- 数据库：MySQL 5.7+，InnoDB、utf8mb4，专用库和账户；不复用其他项目业务表。
- 服务端凭据在 Web 目录之外。不得将真实 `.env`、登录信息、健康记录或附件加入源码包。
- 代码由 root 持有、服务用户只读；凭据组权限仅允许 `vitals` 读取，与已有 PHP 网站的 `www` 用户隔离。
- OSS 和模型均为可选配置。模型未接通返回明确的 503 提示，真实照片不得返回演示识别结果。

`cloud/.env.example` 提供环境变量名；`cloud/vitals-health.service.example` 提供运行方式。

## 初始化与迁移顺序

1. 安装 `cloud/requirements.txt`，创建独立数据库，并设置服务端环境。
2. `python -m cloud.manage init --username owner`，密码来自隐藏输入或环境，不得写入 shell 参数。
3. 准备单独验收数据库运行 `python -m cloud.smoke`。该命令要求数据库名以 `_smoke` 结尾，并显式设置 `HEALTH_SMOKE_ALLOW_RESET=1`；不能对真实库运行。
4. 对原始 JSON 执行 `tools/prepare_migration.py`，输出位置必须是私有目录。该程序不修改输入，为缺失 ID 生成稳定标识，保留无法归档的历史图片引用并明确标记。
5. 暂停旧写入入口，保留原始快照，检查最终源文件与迁移快照来自同一版本。
6. `python -m cloud.manage import 私有快照路径 --expected-revision 当前云版本 --request-id 唯一迁移标识`。
7. 使用 `check`、`export` 核对所有记录 ID、字段与集合数量。全局 revision/updatedAt 为云端生成，其余值按兼容快照核对。
8. 在项目目录外设置权限 600 的 WorkBuddy 云端配置，启用云端兼容入口后再恢复写入。

## WorkBuddy 与电脑面板

参见 `cloud/CLIENT.md`。云端模式下 `tools/log.py` 与 `server.py` 共用 RemoteStore；断网或认证失败不会退回本地 JSON。

原电脑面板通过本地 `server.py` 使用受保护的云端客户端，本地浏览器不接触工作令牌。手机直接访问 HTTPS H5。两端共享档案，不共享聊天历史。

## 备份、恢复与观察

- 每次成功的数据变更，在同一事务内写入版本、回执、变更日志与完整快照，保留最新 80 个快照。
- `python -m cloud.manage history` 查看可恢复版本；`restore` 使用 expected-revision，新建版本而非倒退计数。
- 定期导出 JSON 至 Web 根目录外，图片另外备份；80 个数据快照不等于异机灾备。
- 本次部署提供每日 JSON 备份定时器，保留最近 14 份，输出文件权限 600。两个 `vitals-health-backup.*.example` 文件用于部署；启动后应立即手动运行一次并验证导出。
- 查看 systemd 内存、重启次数、Nginx/API 错误和磁盘余量。原始凭据、图片、正文和完整查询参数不得写入日志。
- 回滚之前停止全部写入，导出最新云档案，确定唯一入口后恢复，不能启用一份过时的本地档案继续双写。

## 验收边界

自动测试、真实 MySQL 验收、HTTPS 浏览器验收与 iPhone/Android 微信实机验收分别记录。模拟浏览器不能替代真实微信验收；可选 OSS 未配置时应报告本地私有存储，不能声称图片已上传 OSS。

## H5 更新与缓存

每次修改 H5 JS/CSS 后先执行 `python tools/version_h5.py`，把更新的 `h5/index.html` 与资源一起发布。脚本把资源内容的 SHA256 前12位写入 URL 的 `?v=`，`tools/package_release.py` 会检查版本是否与文件内容一致，防止遗漏。

宝塔独立站点的 HTTPS `server` 层为 HTML 和 H5 静态资源设置：

```nginx
add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
```

如果某个 `location` 自己设置了 `add_header`，需注意 Nginx 的继承规则，并用实际响应验证。API 原有的 `no-store` 保持。

修改后先用服务器安装的 Nginx 执行 `-t`，通过后 reload，再分别读取 `/` 和带版本号的 JS/CSS 响应头。已打开的旧页面不会自动更换正在执行的脚本；不要为强制更新而清除健康数据或自动刷新未提交表单。需要一次性更新时打开带新查询参数的首页链接，使 HTML 和带内容版本的资源重新加载。

浏览器缓存回归：设置 `PLAYWRIGHT_MODULE` 为本机 Playwright 模块路径后执行 `node --test tests/test_h5_cache.cjs`。测试先缓存旧版脚本，验证不带资源版本时重现旧界面，再验证带版本的文档可进入首页录入并直接触发文件选择器。
