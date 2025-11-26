# Cloudflare Pages 部署指南

## 方法一：使用 Cloudflare Pages Dashboard（推荐）

1. **连接 GitHub 仓库**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 进入 Pages
   - 点击 "Create a project"
   - 连接你的 GitHub 仓库

2. **配置构建设置**
   ```
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   Environment variables: (无需配置)
   ```

3. **部署**
   - 点击 "Save and Deploy"
   - 每次推送到 main 分支会自动部署

## 方法二：使用 Wrangler CLI

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **部署**
   ```bash
   # 构建项目
   npm run build
   
   # 部署到 Cloudflare Pages
   npx wrangler pages deploy dist --project-name pdfimg2pdf
   ```

## 配置文件

项目已包含 `wrangler.jsonc` 配置文件：
```json
{
  "name": "pdfimg2pdf",
  "compatibility_date": "2025-11-26",
  "assets": {
    "directory": "./dist"
  }
}
```

## 环境要求

- Node.js 18+
- 构建输出目录：`dist`
- 无需服务器端运行时（纯静态应用）

## CORS 配置

由于应用需要调用外部 API，Cloudflare Pages 会自动处理静态资源，但跨域请求需要目标服务器支持 CORS。

当前应用调用的外部 API：
- `https://p.xiexinbao.com/yhl_order/*` - 扫描服务
- `https://www.xiexinbao.com/yhl_order/*` - 订单状态查询

## 注意事项

1. **隐私优先**：应用在浏览器端处理，不需要服务器，完全符合 Privacy First 原则
2. **API 代理**：开发环境的 `/api/*` 代理在生产环境不可用，会直接调用真实 API
3. **自动部署**：推送到 GitHub 后会自动触发 Cloudflare Pages 部署

## 验证部署

部署成功后，访问 Cloudflare 提供的 URL（如 `https://pdfimg2pdf.pages.dev`）验证功能：
- ✅ PDF 上传和处理
- ✅ 扫描服务
- ✅ 多语言切换
- ✅ PDF 下载
