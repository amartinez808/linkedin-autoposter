#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const REPLIES_DIR = path.join(__dirname, 'replies');
const VOICE_PROFILE_PATH = path.join(REPLIES_DIR, 'voice-profile.json');
const MANUAL_MESSAGES_PATH = path.join(REPLIES_DIR, 'manual-messages.json');

async function analyzeVoice() {
  console.log('\n🎤 Analyzing your voice from manual messages...\n');

  // Load manual messages
  let messages = [];
  try {
    const data = await fs.readFile(MANUAL_MESSAGES_PATH, 'utf-8');
    messages = JSON.parse(data);
    console.log(`📝 Loaded ${messages.length} messages`);
  } catch (e) {
    console.error('❌ Could not load manual-messages.json');
    process.exit(1);
  }

  if (messages.length < 5) {
    console.log('⚠️  Need at least 5 messages to analyze voice.');
    process.exit(1);
  }

  // Prepare sample messages for analysis
  const sampleMessages = messages
    .filter(m => m.content && m.content.length > 5)
    .map(m => m.content);

  console.log(`\n📊 Analyzing ${sampleMessages.length} messages...\n`);

  const analysisPrompt = `Analyze these LinkedIn DM messages from one person and create a detailed voice profile. These are REAL messages they sent - learn their exact style.

MESSAGES:
${sampleMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Create a voice profile covering:

1. **Tone & Formality**: How formal/casual are they? Professional but friendly? Super casual?

2. **Message Length**: Do they write short punchy messages or longer detailed ones? Average length pattern?

3. **Greeting Style**: How do they start messages? "Hey", "Hi [name]", no greeting, etc.

4. **Sign-off Style**: How do they end? Just stop, "Thanks", "Cheers", etc.

5. **Vocabulary Patterns**:
   - Common phrases they use
   - Technical vs simple language
   - Any slang or informal expressions
   - Filler words or expressions ("yeah", "honestly", "btw", etc.)

6. **Punctuation & Formatting**:
   - Do they use exclamation marks? How often?
   - Emojis? Which ones?
   - Question style
   - Use of ellipsis, dashes, etc.

7. **Response Patterns**:
   - Do they acknowledge the other person's message first?
   - How direct are they?
   - Do they ask follow-up questions?

8. **Personality Traits** that come through:
   - Humor style if any
   - Level of enthusiasm
   - How they show interest or agreement

Return a JSON object with this structure:
{
  "summary": "One paragraph describing their overall communication style",
  "tone": "casual/professional/friendly/formal/mixed",
  "avgMessageLength": "short/medium/long",
  "greetingStyle": "description and examples",
  "signOffStyle": "description and examples",
  "commonPhrases": ["phrase1", "phrase2", ...],
  "punctuationStyle": {
    "exclamationFrequency": "never/rare/sometimes/often",
    "emojiUsage": "never/rare/sometimes/often",
    "commonEmojis": ["emoji1", "emoji2"]
  },
  "responsePattern": "description of how they typically structure responses",
  "personalityTraits": ["trait1", "trait2", ...],
  "exampleResponses": {
    "thankingResponse": "example of how they'd thank someone",
    "agreeingResponse": "example of how they'd agree",
    "askingQuestion": "example of how they'd ask something",
    "casualGreeting": "example casual opener"
  }
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing communication styles and creating detailed voice profiles. Return valid JSON only.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const response = completion.choices[0].message.content.trim();

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = response;
    if (response.includes('```json')) {
      jsonStr = response.split('```json')[1].split('```')[0].trim();
    } else if (response.includes('```')) {
      jsonStr = response.split('```')[1].split('```')[0].trim();
    }

    const voiceProfile = JSON.parse(jsonStr);
    voiceProfile.analyzedAt = new Date().toISOString();
    voiceProfile.messageCount = sampleMessages.length;

    // Save voice profile
    await fs.writeFile(VOICE_PROFILE_PATH, JSON.stringify(voiceProfile, null, 2));
    console.log(`💾 Saved voice profile to ${VOICE_PROFILE_PATH}`);

    console.log('\n✅ Voice profile created!\n');
    console.log('========================================');
    console.log('📝 SUMMARY:');
    console.log('========================================');
    console.log(voiceProfile.summary);
    console.log('\n');
    console.log('🎯 Tone:', voiceProfile.tone);
    console.log('📏 Message Length:', voiceProfile.avgMessageLength);
    console.log('👋 Greeting Style:', voiceProfile.greetingStyle);
    console.log('✍️  Sign-off:', voiceProfile.signOffStyle);
    console.log('💬 Common Phrases:', voiceProfile.commonPhrases.join(', '));
    console.log('😊 Emojis:', voiceProfile.punctuationStyle.commonEmojis.join(' '));
    console.log('🧠 Personality:', voiceProfile.personalityTraits.join(', '));
    console.log('\n========================================\n');

    return voiceProfile;
  } catch (error) {
    console.error('❌ Error analyzing voice:', error.message);
    process.exit(1);
  }
}

analyzeVoice();
