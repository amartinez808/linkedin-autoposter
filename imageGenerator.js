const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create images directory
const IMAGES_DIR = path.join(__dirname, 'images');

async function ensureImagesDir() {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  } catch (e) {
    // Directory already exists
  }
}

/**
 * Fetch image from Unsplash based on query
 */
async function fetchUnsplashImage(query) {
  try {
    console.log(`🖼️  Fetching Unsplash image for: ${query}`);

    // Unsplash API (you can use without key for basic usage, but better with key)
    const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || 'demo';
    const url = unsplashAccessKey === 'demo'
      ? `https://source.unsplash.com/1200x630/?${encodeURIComponent(query)},business,technology`
      : `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${unsplashAccessKey}`;

    let imageUrl;

    if (unsplashAccessKey === 'demo') {
      // Direct image URL
      imageUrl = url;
    } else {
      // API response
      const response = await axios.get(url);
      imageUrl = response.data.urls.regular;
    }

    // Download image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const fileName = `unsplash_${Date.now()}.jpg`;
    const filePath = path.join(IMAGES_DIR, fileName);

    await fs.writeFile(filePath, imageResponse.data);

    console.log(`✅ Unsplash image saved: ${fileName}`);
    return {
      path: filePath,
      source: 'unsplash',
      fileName: fileName
    };
  } catch (error) {
    console.error('❌ Error fetching Unsplash image:', error.message);
    return null;
  }
}

/**
 * Generate image using DALL-E
 */
async function generateDalleImage(prompt) {
  try {
    console.log(`🎨 Generating DALL-E image for: ${prompt}`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Professional business image for LinkedIn post: ${prompt}. Style: clean, modern, professional, business-appropriate. High quality.`,
      n: 1,
      size: "1024x1024",
      quality: "standard"
    });

    const imageUrl = response.data[0].url;

    // Download the generated image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const fileName = `dalle_${Date.now()}.png`;
    const filePath = path.join(IMAGES_DIR, fileName);

    await fs.writeFile(filePath, imageResponse.data);

    console.log(`✅ DALL-E image saved: ${fileName}`);
    return {
      path: filePath,
      source: 'dalle',
      fileName: fileName
    };
  } catch (error) {
    console.error('❌ Error generating DALL-E image:', error.message);
    return null;
  }
}

/**
 * Get image for post - randomly chooses between Unsplash and DALL-E
 */
async function getImageForPost(topic, postContent) {
  await ensureImagesDir();

  // Randomly choose between Unsplash (70%) and DALL-E (30%)
  // Unsplash is cheaper/free, so we use it more often
  const useUnsplash = Math.random() < 0.7;

  if (useUnsplash) {
    // Extract key words from topic for better image search
    const searchQuery = extractSearchTerms(topic);
    const unsplashResult = await fetchUnsplashImage(searchQuery);

    // If Unsplash fails, fall back to DALL-E
    if (!unsplashResult) {
      console.log('🔄 Unsplash failed, falling back to DALL-E...');
      const imagePrompt = createImagePrompt(topic, postContent);
      return await generateDalleImage(imagePrompt);
    }

    return unsplashResult;
  } else {
    // Create a concise image prompt from the post content
    const imagePrompt = createImagePrompt(topic, postContent);
    return await generateDalleImage(imagePrompt);
  }
}

/**
 * Extract search terms from topic for Unsplash
 */
function extractSearchTerms(topic) {
  // Map topics to good search terms
  const topicMap = {
    'AI automation': 'artificial intelligence technology',
    'automation benefits': 'business automation technology',
    'automation case studies': 'business success teamwork',
    'automation mistakes': 'problem solving business',
    'automation opportunities': 'innovation opportunity',
    'ROI of business automation': 'business growth success',
    'automation vs manual': 'efficiency productivity',
    'AI tools': 'technology workspace',
    'digital transformation': 'digital transformation business',
    'business automation': 'modern office technology',
    'process optimization': 'workflow efficiency',
    'smart business solutions': 'smart technology business'
  };

  // Find the best match
  for (const [key, value] of Object.entries(topicMap)) {
    if (topic.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Default to generic business/tech
  return 'business technology innovation';
}

/**
 * Create DALL-E prompt from post content
 */
function createImagePrompt(topic, postContent) {
  // Extract key concepts from content
  const concepts = [];

  if (postContent.includes('automation')) concepts.push('automation');
  if (postContent.includes('AI') || postContent.includes('artificial intelligence')) concepts.push('AI');
  if (postContent.includes('team') || postContent.includes('employees')) concepts.push('team collaboration');
  if (postContent.includes('efficiency') || postContent.includes('productivity')) concepts.push('productivity');
  if (postContent.includes('data')) concepts.push('data analytics');
  if (postContent.includes('transform')) concepts.push('transformation');

  const conceptStr = concepts.slice(0, 3).join(', ') || 'business technology';

  return `${conceptStr} in a modern business setting`;
}

/**
 * Clean up old images (optional - keeps storage manageable)
 */
async function cleanupOldImages(daysOld = 7) {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(IMAGES_DIR, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        console.log(`🗑️  Deleted old image: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up images:', error.message);
  }
}

module.exports = {
  getImageForPost,
  fetchUnsplashImage,
  generateDalleImage,
  cleanupOldImages
};
