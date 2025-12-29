const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const POST_TOPICS = [
  'Reliability issues when deploying LLMs in production',
  'Prompt engineering failures and what actually worked',
  'Debugging automation workflows that silently fail',
  'Cost blowups from naive LLM API usage',
  'Hallucination problems in real business use cases',
  'Latency issues when chaining multiple AI calls',
  'Context window limits breaking complex workflows',
  'Error handling in AI automation pipelines',
  'Testing strategies for non-deterministic AI systems',
  'Token optimization lessons from production',
  'Rate limiting challenges with AI APIs',
  'Data validation failures in automated systems',
  'Version control for evolving prompts',
  'Monitoring AI system drift in production',
  'Recovery strategies when automation fails'
];

const POST_STYLES = [
  'direct problem → solution format',
  'honest failure story with lessons learned',
  'technical breakdown of a specific issue',
  'practical workaround with code/approach',
  'data-driven comparison of approaches'
];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function generateLinkedInPost() {
  const topic = getRandomElement(POST_TOPICS);
  const style = getRandomElement(POST_STYLES);

  const prompt = `You are writing a technical LinkedIn post for RAD AI (Rational Automation Design), a company that builds AI automation systems.

Topic: ${topic}
Style: ${style}

Voice: Technical but human and funny. Like talking to a friend who's also an engineer. Be yourself, don't be corporate.

Guidelines:
- Keep it SHORT: 100-200 words max
- Start with what broke/failed (be specific and a bit funny about it)
- Then what actually worked (be practical)
- NO marketing speak, NO hype, NO buzzwords
- NO emojis
- NO em dashes (—), use regular dashes (-) or periods instead
- Use technical terms when appropriate
- Share real numbers/metrics (e.g., "went from 90s to 2s latency")
- Add a touch of humor or personality (self-deprecating is good)
- End with a specific takeaway or question
- Write like you're explaining to another engineer over coffee
- DO NOT use hashtags (we'll add them separately)

Example tone: "Spent 3 hours debugging why our LLM kept hallucinating. Turns out I forgot to validate the input. Classic me."

Write the post now:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a senior engineer writing honest, technical posts with personality and humor. Be real, be funny, be yourself. Talk like a human, not a corporate robot. Share what broke and what helped, but make it relatable and a bit self-deprecating.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 500
    });

    let post = completion.choices[0].message.content.trim();

    // Add technical hashtags
    const hashtags = '\n\n#LLM #AIEngineering #ProductionAI #MLOps #Automation';
    post += hashtags;

    return {
      content: post,
      topic: topic,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating content:', error.message);
    throw error;
  }
}

// Generate multiple posts for queuing
async function generatePostBatch(count = 5) {
  const posts = [];

  for (let i = 0; i < count; i++) {
    try {
      const post = await generateLinkedInPost();
      posts.push(post);

      // Small delay between generations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to generate post ${i + 1}:`, error.message);
    }
  }

  return posts;
}

module.exports = {
  generateLinkedInPost,
  generatePostBatch
};
