/**
 * Image Blender Utility | 图片叠加工具
 * 用于将黑白透明通道图叠加到原始图片上，生成带透明背景的PNG
 */

/**
 * Load image from URL or base64 | 从URL或base64加载图片
 * @param {string} src - Image source (URL or base64) | 图片源（URL或base64）
 * @returns {Promise<HTMLImageElement>} - Loaded image element | 加载完成的图片元素
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // Handle CORS | 处理跨域
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/**
 * Get image size from base64 | 从base64获取图片大小
 * @param {string} base64 - Base64 image string | Base64图片字符串
 * @returns {number} - Size in bytes | 字节大小
 */
function getImageSize(base64) {
  if (!base64 || typeof base64 !== 'string') {
    return 0
  }
  // Base64 string size is approximately 4/3 of original binary size
  // Remove data URL prefix if present
  const base64Data = base64.split(',')[1] || base64
  return Math.floor(base64Data.length * 0.75)
}

/**
 * Calculate grayscale value from RGB | 从RGB计算灰度值
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @returns {number} - Grayscale value (0-255)
 */
function toGrayscale(r, g, b) {
  // ITU-R BT.601 standard
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

/**
 * Blend images with alpha channel | 使用alpha通道叠加图片
 * @param {string} baseImageData - Base image data (URL or base64) | 原始图片数据
 * @param {string} alphaImageData - Alpha channel image data (URL or base64) | 透明通道图数据
 * @param {Function} onProgress - Progress callback (optional) | 进度回调（可选）
 * @returns {Promise<string>} - Result as base64 PNG string | 结果base64 PNG字符串
 */
export async function blendImagesWithAlpha(baseImageData, alphaImageData, onProgress) {
  // Validate inputs | 验证输入
  if (!baseImageData || !alphaImageData) {
    throw new Error('请确保提供了原始图片和透明通道图')
  }

  if (baseImageData === alphaImageData) {
    throw new Error('原始图片和透明通道图不能是同一张图片')
  }

  // Check file size limit (10MB) | 检查文件大小限制（10MB）
  const maxSize = 10 * 1024 * 1024
  const baseSize = getImageSize(baseImageData)
  const alphaSize = getImageSize(alphaImageData)

  if (baseSize > maxSize || alphaSize > maxSize) {
    throw new Error('图片大小不能超过10MB')
  }

  if (onProgress) onProgress(10)

  // Load images | 加载图片
  const [baseImg, alphaImg] = await Promise.all([
    loadImage(baseImageData),
    loadImage(alphaImageData)
  ])

  if (onProgress) onProgress(30)

  // Create canvas with base image dimensions | 创建画布（使用原图尺寸）
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = baseImg.width
  canvas.height = baseImg.height

  // Draw base image | 绘制原始图片
  ctx.drawImage(baseImg, 0, 0)

  // Get base image pixel data | 获取原图像素数据
  const baseData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  if (onProgress) onProgress(50)

  // Create temporary canvas for alpha image | 为透明图创建临时画布
  const alphaCanvas = document.createElement('canvas')
  const alphaCtx = alphaCanvas.getContext('2d')
  alphaCanvas.width = canvas.width
  alphaCanvas.height = canvas.height

  // Draw alpha image (automatically scaled to base size) | 绘制透明图（自动缩放到原图尺寸）
  alphaCtx.drawImage(alphaImg, 0, 0, canvas.width, canvas.height)
  const alphaData = alphaCtx.getImageData(0, 0, canvas.width, canvas.height)

  if (onProgress) onProgress(70)

  // Apply alpha mapping: white=transparent, black=opaque | 应用alpha映射：白色=透明，黑色=不透明
  const pixelCount = baseData.data.length / 4
  const chunkSize = Math.ceil(pixelCount / 10) // Process in chunks for progress | 分块处理以显示进度

  for (let i = 0; i < baseData.data.length; i += 4) {
    // Get RGB from alpha image | 从透明图获取RGB
    const r = alphaData.data[i]
    const g = alphaData.data[i + 1]
    const b = alphaData.data[i + 2]

    // Calculate grayscale value | 计算灰度值
    const grayValue = toGrayscale(r, g, b)

    // Map: white(255) -> alpha(0), black(0) -> alpha(255) | 映射：白色->透明，黑色->不透明
    const newAlpha = 255 - grayValue

    // If base image already has alpha, take minimum | 如果原图已有透明度，取最小值
    const originalAlpha = baseData.data[i + 3]
    baseData.data[i + 3] = Math.min(originalAlpha, newAlpha)

    // Report progress | 报告进度
    if (onProgress && (i / 4) % chunkSize === 0) {
      const progress = 70 + Math.floor((i / 4) / pixelCount * 25)
      onProgress(Math.min(progress, 95))
    }
  }

  if (onProgress) onProgress(95)

  // Put modified data back | 写回修改后的数据
  ctx.putImageData(baseData, 0, 0)

  // Export as PNG to preserve transparency | 导出PNG以保留透明度
  const resultDataUrl = canvas.toDataURL('image/png')

  if (onProgress) onProgress(100)

  return resultDataUrl
}

/**
 * Validate image inputs | 验证图片输入
 * @param {string} baseImage - Base image data | 原始图片数据
 * @param {string} alphaImage - Alpha channel image data | 透明通道图数据
 * @returns {Object} - Validation result { valid: boolean, error: string } | 验证结果
 */
export function validateImageInputs(baseImage, alphaImage) {
  if (!baseImage || !alphaImage) {
    return { valid: false, error: '请确保连接了原始图片和透明通道图' }
  }

  if (baseImage === alphaImage) {
    return { valid: false, error: '原始图片和透明通道图不能是同一张图片' }
  }

  const maxSize = 10 * 1024 * 1024
  const baseSize = getImageSize(baseImage)
  const alphaSize = getImageSize(alphaImage)

  if (baseSize > maxSize || alphaSize > maxSize) {
    return { valid: false, error: '图片大小不能超过10MB' }
  }

  return { valid: true, error: null }
}
