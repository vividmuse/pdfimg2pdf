# 扫描服务使用说明

## 功能说明

扫描服务已集成到应用中，使用xiexinbao.com的真实API进行文档扫描处理。

##使用流程

### 步骤1: 上传PDF并生成预览
1. 在应用首页点击上传PDF文件
2. 等待PDF处理完成
3. 调整处理参数（可选）
   - 白色背景强度
   - 亮度/对比度
   - 文档增强等

### 步骤2: 配置扫描参数
在页面底部的"扫描服务"面板中：
- **扫描模式**：
  - 一页模式：合并所有页面到一张PDF
  - 两页模式：分别生成两张PDF（需要至少2张图片）
- **水印文字**（可选）：添加自定义水印，如"仅供XX使用"

### 步骤3: 发送到扫描服务
1. 点击"🚀 发送到扫描服务"按钮
2. 等待处理（显示进度条）：
   - 📤 正在上传图片...
   - 📝 正在创建订单...
   - ⏳ 正在处理扫描...
   - 📥 正在下载结果...
3. 完成后PDF自动下载

## 技术实现

### API接口

#### 1. 文件上传（OSS直传）
```
GET https://www.xiexinbao.com/oss_hz/params
→ 获取OSS上传参数
→ 直接上传到阿里云OSS
```

#### 2. 创建订单
```
POST https://p.xiexinbao.com/yhl_order/add
Content-Type: application/x-www-form-urlencoded

参数：
- id: 订单ID
- item_id: 3101（文档扫描）
- data_in: JSON字符串（包含文件URL、任务参数等）
- result_msg: JSON字符串（水印等配置）
```

#### 3. 查询订单状态
```
POST https://www.xiexinbao.com/yhl_order/item?id={orderId}
→ 轮询订单状态直到完成
→ 获取result_url（PDF下载链接）
```

### 关键特性

- ✅ **OSS直传**：图片直接上传到阿里云OSS，速度更快
- ✅ **自动轮询**：后台自动查询处理进度，无需用户操作
- ✅ **自动下载**：处理完成后PDF自动下载
- ✅ **无订单详情**：整个流程不显示订单号等技术信息

## 故障排查

### 上传失败
- **错误**："图片上传失败，请检查网络连接后重试"
- **原因**：网络问题或OSS服务暂时不可用
- **解决**：检查网络连接，稍后重试

### 订单创建失败
- **错误**："无法创建扫描订单，请稍后重试"
- **原因**：订单服务暂时不可用
- **解决**：稍后重试

### 处理超时
- **错误**："扫描处理超时，请检查网络后重试"
- **原因**：处理时间过长或网络问题
- **解决**：重新尝试，或减少图片数量

### 扫描失败
- **错误**："扫描处理失败，请检查图片质量后重试"
- **原因**：图片质量不佳或格式问题
- **解决**：使用更清晰的PDF文件，确保图片可读

### PDF下载失败
- **错误**："PDF下载失败，请重试"
- **原因**：下载链接过期或网络问题
- **解决**：重新发起扫描

## 注意事项

⚠️ **图片数量**：两页模式需要至少2张图片

⚠️ **网络要求**：需要稳定的网络连接，处理过程可能需要几秒到几十秒

⚠️ **浏览器兼容性**：建议使用现代浏览器（Chrome、Firefox、Edge等）

⚠️ **CORS**：应用使用CORS跨域请求，如遇问题请检查浏览器设置

## 开发者信息

### 修改扫描配置

在 `services/scanService.ts` 中修改 `SCAN_CONFIG`：

```typescript
const SCAN_CONFIG: ScanServiceConfig = {
    apiBaseUrl: '/api',
    itemId: '3101',      // 文档扫描
    itemName: '文档扫描',
    defaultPrice: 5.9,
    pollInterval: 2000,   // 轮询间隔（毫秒）
    maxPollAttempts: 30,  // 最大轮询次数
};
```

### 文件结构
- `services/scanService.ts`：扫描服务核心逻辑
- `src/components/ScanServicePanel.tsx`：扫描服务UI组件
- `src/hooks/useScanService.ts`：React Hook封装
- `types.ts`：TypeScript类型定义
