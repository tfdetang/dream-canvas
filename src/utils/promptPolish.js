/**
 * Prompt Polishing Utilities | 提示词润色工具
 * Language detection and multilingual prompts
 */

/**
 * 检测文本的主要语言
 * @param {string} text - 要检测的文本
 * @returns {string} 'zh' | 'en' | 'mixed'
 */
export function detectLanguage(text) {
  if (!text || text.trim().length === 0) return 'en'

  // 统计中文字符和英文字符的数量
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0
  const englishChars = text.match(/[a-zA-Z]/g)?.length || 0

  // 如果中文字符占主导（>30%），判定为中文
  if (chineseChars > 0 && chineseChars / (chineseChars + englishChars) > 0.3) {
    return 'zh'
  }

  // 如果英文字符占主导，判定为英文
  if (englishChars > 0) {
    return 'en'
  }

  // 如果都没有明显的字符，默认为英文
  return 'en'
}

/**
 * 多语言润色 prompt 配置
 */
export const POLISH_PROMPTS = {
  zh: {
    system: '你是一个专业的AI绘画提示词专家。将用户输入的内容美化成高质量的生图提示词，包含风格、光线、构图、细节等要素。重要：必须使用中文输出，不要翻译成英文，不要使用英文词汇，除非是专有名词。直接返回优化后的提示词，不要其他解释。',
    label: '中文润色'
  },
  en: {
    system: 'You are an expert AI art prompt engineer. Transform the user\'s input into a high-quality image generation prompt. Include details about style, lighting, composition, and artistic elements. Return only the optimized prompt in English without any additional explanations.',
    label: 'English Polish'
  }
}

/**
 * 根据输入语言获取对应的润色 prompt
 * @param {string} text - 输入文本
 * @returns {Object} { system, label, language }
 */
export function getPolishPrompt(text) {
  const language = detectLanguage(text)
  const prompt = POLISH_PROMPTS[language]

  return {
    ...prompt,
    language
  }
}
