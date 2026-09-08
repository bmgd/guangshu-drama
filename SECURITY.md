# 安全政策

## 支持的版本

本仓库的 `main` 分支为当前维护版本。

## 上报漏洞

若发现安全问题（例如密钥泄漏、未授权访问、注入类缺陷），请**不要**公开提 Issue。

请通过 GitHub Security Advisory（仓库 → Security → Advisories）私下报告，或联系维护者。

## 请勿提交的内容

- `.env`、真实 API Key、数据库生产凭据
- 用户生成的媒体与任务日志（`data/`）
- 私钥、证书、云厂商长期凭证

本地开发请复制 `backend/.env.example` 为 `backend/.env`，切勿提交。

## 生产部署建议

- 修改 PostgreSQL 默认账号密码（示例中的 `guangshu/guangshu` 仅供本地）
- 限制 `STORAGE_PATH` 与管理接口的网络暴露面
- 为上游 AI 厂商密钥设置最小权限与轮换策略
