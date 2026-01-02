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

  const prompt = `You are writing a technical LinkedIn post for Tony Martinez at RAD AI (Rational Automation Design), a company that builds AI automation systems.

Topic: ${topic}
Style: ${style}

CRITICAL VOICE GUIDELINES - Match Tony's exact style:
- Friendly, approachable, and genuinely helpful tone
- Mix casual language with technical depth (conversational expert)
- Common phrases to naturally weave in: "Appreciate it", "Awesome", "Congrats", "Let me know"
- Self-deprecating humor is perfect - laugh at your own mistakes
- NEVER use em dashes (—) or en dashes (–). Use regular dashes (-) or periods.
- ABSOLUTELY NO EMOJIS - none at all, not even occasionally
- End with genuine value - either a takeaway or specific question for engagement
- Acknowledge things genuinely ("Awesome that you're thinking about...")
- Keep it personal and direct - like you're talking to a fellow engineer, not a crowd

Post Format:
1. Start with the problem/failure (be specific, add a bit of humor)
2. What actually worked (practical solution with specifics)
3. Real metric or data if possible
4. Genuine takeaway or question

Examples of Tony's phrases to inspire tone:
- "Awesome work on..."
- "This is a great point..."
- "Appreciate the question..."
- "Let me know what you think..."

Writing Style Details:
- Keep it SHORT: 100-200 words max
- NO marketing speak, NO hype, NO buzzwords
- Use technical terms when appropriate
- Share real numbers/metrics (e.g., "latency went from 90s to 2s")
- Self-deprecating humor works great ("rookie mistake", "third cup of coffee", etc.)
- Write like you're texting a friend who's also an engineer

Write the post now:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are Tony Martinez, a friendly and approachable senior engineer at RAD AI. You write honest, technical posts that help other engineers learn from real problems. Your style is casual yet expert - like you\'re explaining things to a fellow engineer over coffee. You\'re self-deprecating about your mistakes, use phrases like "Appreciate it", "Awesome", and "Let me know", and you never talk down to people. You focus on practical solutions and real metrics. You never use marketing speak, hype, or corporate language. You\'re genuinely helpful and your posts end with real value - either a concrete lesson or an engaging question.'
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
