# 图片叠加节点设计文档

**日期**: 2025-02-10
**作者**: Claude
**状态**: 设计阶段

## 1. 节点概述

**节点名称**: `ImageBlendNode` (图片叠加节点)

**核心功能**: 接收两张图片作为输入 - 一张原始图片和一张黑白透明通道图，将透明通道图的灰度值映射为 alpha 透明度（纯白=全透明，纯黑=不透明），生成带透明背景的 PNG 图片。

**输入/输出**:
- **输入**: 2个图片连接点（左侧）- 分别连接原始图片和透明通道图
- **输出**: 1个连接点（右侧）- 可连接到其他节点
- **结果**: 生成新的 ImageNode 显示叠加后的图片

**节点数据结构**:
```javascript
{
  label: '图片叠加',
  baseImage: null,      // 原始图片 (imageUrl 或 base64)
  alphaImage: null,     // 透明通道图 (imageUrl 或 base64)
  resultUrl: null,      // 生成的叠加结果 base64
  isProcessing: false,  // 处理状态
  error: null           // 错误信息
}
```

## 2. UI设计和交互

**节点布局**:
- 头部：标题"图片叠加"+ 删除按钮
- 主体：3个区域垂直排列
  1. **原始图片区**：显示连接的原始图片或"请连接原始图片"占位符
  2. **透明通道图区**：显示连接的黑白图或"请连接透明通道图"占位符
  3. **操作区**："生成叠加"按钮（当两张图都连接后启用）

**交互流程**:
1. 用户从左侧连接两个图片节点
2. 节点检测到两张图都已连接，启用"生成叠加"按钮
3. 点击按钮后，显示加载状态（转圈动画）
4. 处理完成后，在节点右侧创建新的 `ImageNode`，显示带透明背景的 PNG
5. 如果出错，在操作区显示错误信息

**视觉反馈**:
- 未连接图片：灰色占位框 + 图标
- 已连接：显示图片缩略图（150px高度）
- 处理中：按钮显示加载动画
- 成功：按钮变为绿色对勾，2秒后恢复

## 3. 图片处理核心逻辑

**Canvas图像处理流程**:

```javascript
// 核心处理函数
async function blendImagesWithAlpha(baseImageData, alphaImageData) {
  // 1. 创建离屏 canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // 2. 加载两张图片
  const baseImg = await loadImage(baseImageData)
  const alphaImg = await loadImage(alphaImageData)

  // 3. 设置canvas尺寸（使用base图片尺寸）
  canvas.width = baseImg.width
  canvas.height = baseImg.height

  // 4. 绘制原始图片
  ctx.drawImage(baseImg, 0, 0)

  // 5. 获取像素数据
  const baseData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // 6. 绘制并处理alpha通道图（缩放到base尺寸）
  const alphaCanvas = document.createElement('canvas')
  alphaCanvas.width = canvas.width
  alphaCanvas.height = canvas.height
  const alphaCtx = alphaCanvas.getContext('2d')
  alphaCtx.drawImage(alphaImg, 0, 0, canvas.width, canvas.height)
  const alphaData = alphaCtx.getImageData(0, 0, canvas.width, canvas.height)

  // 7. 应用alpha映射：白色=透明(alpha=0)，黑色=不透明(alpha=255)
  for (let i = 0; i < baseData.data.length; i += 4) {
    // 取灰度值（使用R通道，因为黑白图RGB相同）
    const grayValue = alphaData.data[i]
    // 白色(255) -> alpha=0, 黑色(0) -> alpha=255
    const alpha = 255 - grayValue
    baseData.data[i + 3] = alpha
  }

  // 8. 写回并导出PNG（保留透明通道）
  ctx.putImageData(baseData, 0, 0)
  return canvas.toDataURL('image/png')
}
```

**关键点**:
- 自动处理不同尺寸的透明通道图（缩放到base图片尺寸）
- 使用灰度值直接映射alpha通道
- 输出PNG格式以保留透明度

## 4. 错误处理和边界情况

**输入验证**:
```javascript
function validateInputs(baseImage, alphaImage) {
  if (!baseImage || !alphaImage) {
    throw new Error('请确保连接了原始图片和透明通道图')
  }

  if (baseImage === alphaImage) {
    throw new Error('原始图片和透明通道图不能是同一张图片')
  }

  // 检查文件大小限制（10MB）
  const maxSize = 10 * 1024 * 1024
  const baseSize = getImageSize(baseImage)
  const alphaSize = getImageSize(alphaImage)
  if (baseSize > maxSize || alphaSize > maxSize) {
    throw new Error('图片大小不能超过10MB')
  }
}
```

**错误处理**:
- **图片加载失败**: 显示"图片加载失败，请重试"
- **内存不足**: 显示"图片过大，处理失败"
- **格式不支持**: 提示"请使用常见图片格式（JPG、PNG、WebP）"
- **处理超时**: 5秒超时限制，显示"处理超时，请尝试更小的图片"

**边界情况**:
- 透明通道图尺寸 ≠ 原始图尺寸：自动缩放透明通道图
- 透明通道图是彩色图：提取灰度值（0.299R + 0.587G + 0.114B）
- 原始图已有透明度：保留原透明度并与新生成透明度取最小值

**性能优化**:
- 使用Web Worker处理大图片（>2MB）
- 显示处理进度（大图时分块处理）

## 5. 实现文件结构

```
src/components/nodes/
  ImageBlendNode.vue          # 新建：图片叠加节点组件
  ImageBlendNode.spec.js      # 可选：单元测试

src/stores/canvas.js
  # 添加 'imageBlend' 节点类型
  # 在 getDefaultNodeData() 中添加默认数据

src/utils/
  imageBlender.js             # 新建：图片处理工具函数

src/views/Canvas.vue
  # 在 nodeTypes 映射中注册 ImageBlendNode
```

## 6. 技术栈

- **Vue 3**: Composition API
- **Canvas API**: 图像像素处理
- **@vue-flow/core**: 节点连接和数据流
- **Naive UI**: UI组件库
- **Tailwind CSS**: 样式

## 7. 实现优先级

1. **高优先级** (必须实现):
   - 基本的节点UI和连接
   - 核心图片叠加逻辑
   - 输入验证
   - 创建结果图片节点

2. **中优先级** (增强体验):
   - 加载状态和进度显示
   - 错误提示优化
   - 图片预览缩略图

3. **低优先级** (性能优化):
   - Web Worker处理大图
   - 图片压缩
   - 单元测试
