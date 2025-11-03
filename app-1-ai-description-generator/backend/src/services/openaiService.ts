import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../config/logger';
import { ExternalServiceError } from '../middleware/errorHandler';

export interface GenerationOptions {
  tone?: 'professional' | 'casual' | 'friendly' | 'formal' | 'playful' | 'luxury';
  language?: string;
  keywords?: string[];
  wordCount?: number;
  seoOptimization?: boolean;
  includeFeatures?: boolean;
  includeBenefits?: boolean;
  customPrompt?: string;
}

export interface GeneratedDescription {
  content: string;
  wordCount: number;
  seoScore?: number;
  keywords?: string[];
  metaDescription?: string;
  titleTag?: string;
}

export interface BatchGenerationResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    productId: string;
    success: boolean;
    description?: GeneratedDescription;
    error?: string;
  }>;
}

class OpenAIService {
  private client: OpenAI;

  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: config.openai.timeout
    });
  }

  /**
   * Generate a product description using OpenAI GPT-4
   */
  async generateDescription(
    productData: {
      title: string;
      existingDescription?: string;
      vendor?: string;
      productType?: string;
      tags?: string[];
      images?: string[];
    },
    options: GenerationOptions = {}
  ): Promise<GeneratedDescription> {
    try {
      const {
        tone = 'professional',
        language = 'en',
        keywords = [],
        wordCount = 150,
        seoOptimization = true,
        includeFeatures = true,
        includeBenefits = true,
        customPrompt
      } = options;

      // Build the prompt
      const prompt = this.buildPrompt(productData, {
        tone,
        language,
        keywords,
        wordCount,
        seoOptimization,
        includeFeatures,
        includeBenefits,
        customPrompt
      });

      // Generate the description
      const completion = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert e-commerce copywriter specializing in creating compelling, SEO-optimized product descriptions that convert browsers into buyers. Write in ${language} language with a ${tone} tone.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.openai.temperature,
        max_tokens: config.openai.maxTokens
      });

      const content = completion.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No content generated from OpenAI');
      }

      // Parse the response and extract metadata
      const result = this.parseResponse(content, productData, options);

      logger.info('Generated product description successfully', {
        productTitle: productData.title,
        wordCount: result.wordCount,
        language,
        tone
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to generate product description:', error);
      
      if (error.code === 'insufficient_quota') {
        throw new ExternalServiceError('OpenAI', 'API quota exceeded', error);
      }
      
      if (error.code === 'rate_limit_exceeded') {
        throw new ExternalServiceError('OpenAI', 'Rate limit exceeded', error);
      }

      throw new ExternalServiceError('OpenAI', 'Failed to generate description', {
        error: error.message,
        productTitle: productData.title
      });
    }
  }

  /**
   * Generate descriptions for multiple products in batch
   */
  async batchGenerateDescriptions(
    products: Array<{
      id: string;
      title: string;
      existingDescription?: string;
      vendor?: string;
      productType?: string;
      tags?: string[];
      images?: string[];
    }>,
    options: GenerationOptions = {}
  ): Promise<BatchGenerationResult> {
    const results: BatchGenerationResult = {
      total: products.length,
      successful: 0,
      failed: 0,
      results: []
    };

    // Process in smaller batches to avoid rate limits
    const batchSize = 5;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (product) => {
        try {
          const description = await this.generateDescription(product, options);
          
          results.successful++;
          return {
            productId: product.id,
            success: true,
            description
          };
        } catch (error: any) {
          results.failed++;
          logger.error(`Failed to generate description for product ${product.id}:`, error);
          
          return {
            productId: product.id,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.results.push(...batchResults);

      // Add delay between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    logger.info('Batch generation completed', {
      total: results.total,
      successful: results.successful,
      failed: results.failed
    });

    return results;
  }

  /**
   * Optimize existing description for SEO
   */
  async optimizeDescription(
    description: string,
    productData: {
      title: string;
      keywords?: string[];
      productType?: string;
    },
    options: {
      language?: string;
      targetKeywords?: string[];
      seoScore?: number;
    } = {}
  ): Promise<GeneratedDescription> {
    try {
      const { language = 'en', targetKeywords = [], seoScore = 80 } = options;

      const prompt = `
Optimize this product description for SEO:

Original Description:
${description}

Product Information:
- Title: ${productData.title}
- Type: ${productData.productType || 'Not specified'}
- Current Keywords: ${productData.keywords?.join(', ') || 'None'}
- Target Keywords: ${targetKeywords.join(', ') || 'None'}

Requirements:
- Improve SEO score to at least ${seoScore}
- Maintain the original meaning and tone
- Include relevant keywords naturally
- Keep word count similar to original
- Write in ${language} language

Please provide:
1. The optimized description
2. The SEO score (0-100)
3. Keywords used
4. Meta description (150-160 characters)
5. Title tag (50-60 characters)
`;

      const completion = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert specializing in e-commerce product descriptions. Optimize content while maintaining readability and conversion potential.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      });

      const content = completion.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No optimized content generated from OpenAI');
      }

      const result = this.parseOptimizedResponse(content);

      logger.info('Optimized product description successfully', {
        originalLength: description.length,
        optimizedLength: result.content.length,
        seoScore: result.seoScore
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to optimize product description:', error);
      throw new ExternalServiceError('OpenAI', 'Failed to optimize description', error);
    }
  }

  /**
   * Build a comprehensive prompt for description generation
   */
  private buildPrompt(
    product: any,
    options: GenerationOptions & { seoOptimization: boolean }
  ): string {
    const {
      tone,
      language,
      keywords,
      wordCount,
      seoOptimization,
      includeFeatures,
      includeBenefits,
      customPrompt
    } = options;

    let prompt = `
Create a compelling product description for this item:

Product: ${product.title}
`;

    if (product.existingDescription) {
      prompt += `Existing Description: ${product.existingDescription}\n`;
    }
    
    if (product.vendor) {
      prompt += `Brand: ${product.vendor}\n`;
    }
    
    if (product.productType) {
      prompt += `Category: ${product.productType}\n`;
    }
    
    if (product.tags && product.tags.length > 0) {
      prompt += `Tags: ${product.tags.join(', ')}\n`;
    }

    prompt += `\nRequirements:
- Write in ${language} language
- Use a ${tone} tone
- Target word count: ${wordCount} words
`;

    if (keywords && keywords.length > 0) {
      prompt += `- Include these keywords naturally: ${keywords.join(', ')}\n`;
    }

    if (seoOptimization) {
      prompt += `- Optimize for SEO with relevant keywords\n`;
    }

    if (includeFeatures) {
      prompt += `- Highlight key features and specifications\n`;
    }

    if (includeBenefits) {
      prompt += `- Focus on customer benefits and value proposition\n`;
    }

    if (customPrompt) {
      prompt += `- Additional instructions: ${customPrompt}\n`;
    }

    prompt += `
Please provide the description in the following format:

**Product Description:**
[Your compelling description here]

**Keywords Used:** [List of keywords naturally integrated]
**SEO Score:** [Score from 0-100]
**Meta Description:** [150-160 character meta description]
**Title Tag:** [50-60 character title tag]
`;

    return prompt;
  }

  /**
   * Parse the AI response and extract structured data
   */
  private parseResponse(
    content: string,
    productData: any,
    options: GenerationOptions
  ): GeneratedDescription {
    // Extract main description
    const descriptionMatch = content.match(/\*\*Product Description:\*\*\s*\n(.*?)(?=\n\*\*|$)/s);
    const description = descriptionMatch ? descriptionMatch[1].trim() : content;

    // Extract keywords
    const keywordsMatch = content.match(/\*\*Keywords Used:\*\*\s*\n(.*?)(?=\n\*\*|$)/s);
    const keywords = keywordsMatch 
      ? keywordsMatch[1].split(',').map((k: string) => k.trim())
      : options.keywords || [];

    // Extract SEO score
    const seoMatch = content.match(/\*\*SEO Score:\*\*\s*(\d+)/);
    const seoScore = seoMatch ? parseInt(seoMatch[1]) : undefined;

    // Extract meta description
    const metaMatch = content.match(/\*\*Meta Description:\*\*\s*\n(.*?)(?=\n\*\*|$)/s);
    const metaDescription = metaMatch ? metaMatch[1].trim() : undefined;

    // Extract title tag
    const titleMatch = content.match(/\*\*Title Tag:\*\*\s*\n(.*?)(?=\n\*\*|$)/s);
    const titleTag = titleMatch ? titleMatch[1].trim() : undefined;

    return {
      content: description,
      wordCount: description.split(/\s+/).length,
      seoScore,
      keywords,
      metaDescription,
      titleTag
    };
  }

  /**
   * Parse optimized description response
   */
  private parseOptimizedResponse(content: string): GeneratedDescription {
    const lines = content.split('\n');
    let description = '';
    let keywords: string[] = [];
    let seoScore: number | undefined;
    let metaDescription: string | undefined;
    let titleTag: string | undefined;

    for (const line of lines) {
      if (line.includes('**') && line.includes(':')) {
        const [key, value] = line.split(':', 2);
        const cleanKey = key.replace(/\*\*/g, '').trim();
        const cleanValue = value ? value.replace(/\*\*/g, '').trim() : '';

        if (cleanKey.toLowerCase().includes('description') && !description) {
          // Find the actual description content (next non-empty line)
          const descIndex = lines.indexOf(line);
          for (let i = descIndex + 1; i < lines.length; i++) {
            if (lines[i].trim() && !lines[i].includes('**')) {
              description = lines[i].trim();
              break;
            }
          }
        } else if (cleanKey.toLowerCase().includes('keyword')) {
          keywords = cleanValue.split(',').map((k: string) => k.trim());
        } else if (cleanKey.toLowerCase().includes('seo') || cleanKey.toLowerCase().includes('score')) {
          seoScore = parseInt(cleanValue);
        } else if (cleanKey.toLowerCase().includes('meta')) {
          metaDescription = cleanValue;
        } else if (cleanKey.toLowerCase().includes('title')) {
          titleTag = cleanValue;
        }
      }
    }

    return {
      content: description || content,
      wordCount: (description || content).split(/\s+/).length,
      seoScore,
      keywords,
      metaDescription,
      titleTag
    };
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(): Promise<{
    totalTokens: number;
    totalRequests: number;
    cost: number;
  }> {
    try {
      // Note: OpenAI doesn't provide real-time usage stats via API
      // This would need to be implemented with usage tracking in the application
      return {
        totalTokens: 0,
        totalRequests: 0,
        cost: 0
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      return {
        totalTokens: 0,
        totalRequests: 0,
        cost: 0
      };
    }
  }

  /**
   * Calculate estimated cost for generation
   */
  calculateCost(tokenCount: number, model: string = 'gpt-4'): number {
    // Pricing per 1K tokens (approximate as of 2023)
    const pricing: { [key: string]: { input: number; output: number } } = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 }
    };

    const modelPricing = pricing[model] || pricing['gpt-4'];
    
    // Estimate 70% input tokens, 30% output tokens
    const inputTokens = Math.ceil(tokenCount * 0.7);
    const outputTokens = Math.ceil(tokenCount * 0.3);

    return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1000;
  }
}

export const openaiService = new OpenAIService();
export default openaiService;
