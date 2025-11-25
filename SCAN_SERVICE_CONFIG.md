# 扫描服务配置指南

## 需要配置的项目

### 1. 扫描服务API地址

当前代码中使用了 `/scan-proxy` 作为代理路径，您需要配置实际的扫描服务API地址。

#### 开发环境配置

**方式一：使用环境变量（推荐）**

创建 `.env` 文件：
```bash
# .env
VITE_SCAN_API_URL=https://your-scan-service.com/api
```

然后修改 `services/scanService.ts`：
```typescript
const SCAN_CONFIG: ScanServiceConfig = {
    apiBaseUrl: import.meta.env.VITE_SCAN_API_URL || '/scan-proxy',
    // ...其他配置
};
```

**方式二：直接修改配置**

在 `services/scanService.ts` 中直接修改：
```typescript
const SCAN_CONFIG: ScanServiceConfig = {
    apiBaseUrl: 'https://your-scan-service.com/api',  // 修改为实际API地址
    itemId: '3102',
    itemName: '证件扫描',
    defaultPrice: 5.9,
    pollInterval: 2000,
    maxPollAttempts: 30,
};
```

### 2. 配置代理（用于解决CORS跨域问题）

#### 开发环境 - Vite代理

创建或修改 `vite.config.ts`：
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scan-proxy': {
        target: 'https://your-scan-service.com',  // 实际的扫描服务地址
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scan-proxy/, ''),
        secure: false,
      }
    }
  }
});
```

#### 生产环境 - Vercel代理

修改 `vercel.json`，添加代理配置：
```json
{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "devCommand": "npm run dev",
    "installCommand": "npm install",
    "framework": "vite",
    "rewrites": [
        {
            "source": "/scan-proxy/:path*",
            "destination": "https://your-scan-service.com/:path*"
        },
        {
            "source": "/(.*)",
            "destination": "/index.html"
        }
    ],
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "Cross-Origin-Embedder-Policy",
                    "value": "require-corp"
                },
                {
                    "key": "Cross-Origin-Opener-Policy",
                    "value": "same-origin"
                }
            ]
        }
    ]
}
```

### 3. 其他可选配置

#### 修改轮询参数

如果扫描处理时间较长，可以调整轮询配置：
```typescript
const SCAN_CONFIG: ScanServiceConfig = {
    // ...
    pollInterval: 3000,      // 轮询间隔（毫秒），默认2000
    maxPollAttempts: 60,     // 最大轮询次数，默认30
};
```

#### 修改订单信息

根据实际的扫描服务调整：
```typescript
const SCAN_CONFIG: ScanServiceConfig = {
    // ...
    itemId: '您的服务ID',
    itemName: '您的服务名称',
    defaultPrice: 5.9,       // 价格（如果适用）
};
```

## 快速配置步骤

### 步骤1: 确定扫描服务地址
假设您的扫描服务地址是：`https://scan-api.example.com`

### 步骤2: 选择配置方式

**推荐方式（使用环境变量 + 代理）：**

1. 创建 `.env` 文件：
```bash
VITE_SCAN_API_URL=/scan-proxy
```

2. 创建 `vite.config.ts`（如果不存在）：
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scan-proxy': {
        target: 'https://scan-api.example.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scan-proxy/, ''),
      }
    }
  }
});
```

3. 修改 `vercel.json` 用于生产环境：
```json
{
    "rewrites": [
        {
            "source": "/scan-proxy/:path*",
            "destination": "https://scan-api.example.com/:path*"
        },
        {
            "source": "/(.*)",
            "destination": "/index.html"
        }
    ]
}
```

### 步骤3: 测试配置

1. 重启开发服务器：
```bash
npm run dev
```

2. 上传PDF并生成预览
3. 点击"发送到扫描服务"按钮
4. 检查浏览器控制台的网络请求

## 故障排查

### 问题：CORS错误
**解决方案：** 确保配置了代理，或者扫描服务API支持CORS

### 问题：404 Not Found
**解决方案：** 检查API地址是否正确，路径重写规则是否正确

### 问题：超时
**解决方案：** 增加 `maxPollAttempts` 或 `pollInterval` 的值

### 问题：上传失败
**解决方案：** 检查上传接口路径是否正确（当前是 `${apiBaseUrl}/api/upload`）

## 当前配置位置

- **扫描服务配置**: `services/scanService.ts` (第4-11行)
- **代理配置（开发）**: `vite.config.ts` (需要创建)
- **代理配置（生产）**: `vercel.json`
- **环境变量**: `.env` (需要创建)

## 注意事项

⚠️ **安全提示**：
- 不要将API密钥硬编码在代码中
- 使用环境变量管理敏感配置
- `.env` 文件应该加入 `.gitignore`

⚠️ **生产部署**：
- 确保在Vercel上配置环境变量
- 验证代理路由在生产环境正常工作
- 测试完整的扫描流程
