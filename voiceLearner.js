const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const REPLIES_DIR = path.join(__dirname, 'replies');
const VOICE_PROFILE_PATH = path.join(REPLIES_DIR, 'voice-profile.json');
const SCRAPED_MESSAGES_PATH = path.join(REPLIES_DIR, 'scraped-messages.json');

// Human-like delay function
function randomDelay(min = 2000, max = 5000) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  );
}

class VoiceLearner {
  constructor(linkedInBot) {
    this.bot = linkedInBot;
    this.page = linkedInBot.page;
    this.scrapedMessages = [];
    this.voiceProfile = null;
  }

  async init() {
    // Ensure replies directory exists
    try {
      await fs.mkdir(REPLIES_DIR, { recursive: true });
    } catch (e) {}

    // Load existing scraped messages if available
    try {
      const data = await fs.readFile(SCRAPED_MESSAGES_PATH, 'utf-8');
      this.scrapedMessages = JSON.parse(data);
      console.log(`📚 Loaded ${this.scrapedMessages.length} previously scraped messages`);
    } catch (e) {
      this.scrapedMessages = [];
    }

    // Load existing voice profile if available
    try {
      const data = await fs.readFile(VOICE_PROFILE_PATH, 'utf-8');
      this.voiceProfile = JSON.parse(data);
      console.log('🎤 Loaded existing voice profile');
    } catch (e) {
      this.voiceProfile = null;
    }
  }

  // === SCRAPING YOUR PAST MESSAGES ===

  async navigateToMessaging() {
    console.log('📬 Navigating to messaging...');

    try {
      await this.page.goto('https://www.linkedin.com/messaging/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (navError) {
      console.log('Warning: Navigation timeout, checking if page loaded...');
    }

    await randomDelay(3000, 5000);
    return true;
  }

  async getConversationList(limit = 20) {
    console.log(`📋 Getting conversation list (limit: ${limit})...`);

    try {
      // Wait for conversation list to load
      await randomDelay(3000, 5000);

      // Take debug screenshot
      try {
        const screenshotPath = path.join(__dirname, 'screenshots', `messaging-debug-${Date.now()}.png`);
        await this.page.screenshot({ path: screenshotPath });
        console.log(`   Debug screenshot: ${screenshotPath}`);
      } catch (e) {}

      // Scroll to load more conversations - try multiple container selectors
      for (let i = 0; i < 3; i++) {
        await this.page.evaluate(() => {
          const containers = [
            document.querySelector('.msg-conversations-container__conversations-list'),
            document.querySelector('[class*="msg-conversations"]'),
            document.querySelector('.scaffold-layout__list'),
            document.querySelector('ul[class*="list"]')
          ];
          for (const list of containers) {
            if (list) {
              list.scrollTop += 500;
              break;
            }
          }
        });
        await randomDelay(1000, 2000);
      }

      const conversations = await this.page.evaluate((maxConversations) => {
        const items = [];

        // LinkedIn 2024/2025 messaging UI - find all conversation row elements
        // The conversations appear as list items with links to /messaging/thread/
        const allLinks = document.querySelectorAll('a[href*="/messaging/thread/"]');

        // De-duplicate by thread ID
        const seenThreads = new Set();

        allLinks.forEach((link) => {
          if (items.length >= maxConversations) return;

          const href = link.getAttribute('href') || '';
          const match = href.match(/thread\/([^/?]+)/);

          if (match && !seenThreads.has(match[1])) {
            seenThreads.add(match[1]);

            // Find the conversation container (walk up to find the row)
            let container = link;
            for (let i = 0; i < 5; i++) {
              if (container.parentElement) container = container.parentElement;
            }

            // Try to find the participant name - look for prominent text
            let participantName = 'Unknown';

            // Common patterns for name elements
            const namePatterns = [
              'h3', 'h4',
              '[class*="participant"]',
              '[class*="entity-name"]',
              'span[class*="truncate"]',
              '.msg-conversation-listitem__participant-names',
              '.artdeco-entity-lockup__title'
            ];

            for (const pattern of namePatterns) {
              const nameEl = container.querySelector(pattern);
              if (nameEl && nameEl.innerText.trim().length > 0 && nameEl.innerText.trim().length < 100) {
                participantName = nameEl.innerText.trim().split('\n')[0];
                break;
              }
            }

            // Fallback: find first reasonable text content
            if (participantName === 'Unknown') {
              const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
              let node;
              while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text.length > 2 && text.length < 50 && !text.includes('message') && !text.includes('ago')) {
                  participantName = text;
                  break;
                }
              }
            }

            items.push({
              threadId: match[1],
              participantName: participantName
            });
          }
        });

        return items;
      }, limit);

      console.log(`   Found ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.error('   Error getting conversations:', error.message);
      return [];
    }
  }

  async scrapeConversation(threadId, participantName) {
    console.log(`💬 Scraping conversation with ${participantName}...`);

    try {
      // Navigate to the conversation
      const threadUrl = `https://www.linkedin.com/messaging/thread/${threadId}/`;
      await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(2000, 4000);

      // Scroll up to load older messages
      for (let i = 0; i < 5; i++) {
        await this.page.evaluate(() => {
          const container = document.querySelector('.msg-s-message-list');
          if (container) container.scrollTop = 0;
        });
        await randomDelay(500, 1000);
      }

      // Wait a bit for messages to load
      await randomDelay(2000, 3000);

      // Extract messages
      const messages = await this.page.evaluate(() => {
        const items = [];

        // Get all message groups
        const messageGroups = document.querySelectorAll('.msg-s-message-list__event');

        messageGroups.forEach(group => {
          const senderEl = group.querySelector('.msg-s-message-group__name');
          const contentEls = group.querySelectorAll('.msg-s-event-listitem__body');
          const timeEl = group.querySelector('.msg-s-message-group__timestamp, time');

          // Determine if outgoing (sent by you)
          const isOutgoing = group.classList.contains('msg-s-message-list__event--outbound') ||
                            group.querySelector('.msg-s-message-list__event--outbound') !== null;

          contentEls.forEach(contentEl => {
            const content = contentEl.innerText.trim();
            if (content) {
              items.push({
                sender: senderEl ? senderEl.innerText.trim() : (isOutgoing ? 'You' : 'Other'),
                content: content,
                timestamp: timeEl ? timeEl.getAttribute('datetime') || timeEl.innerText.trim() : null,
                isOutgoing: isOutgoing
              });
            }
          });
        });

        return items;
      });

      // Filter to only your outgoing messages
      const yourMessages = messages.filter(m => m.isOutgoing);
      console.log(`   Found ${yourMessages.length} of your messages (${messages.length} total)`);

      return {
        threadId,
        participantName,
        allMessages: messages,
        yourMessages: yourMessages,
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`   Error scraping conversation: ${error.message}`);
      return null;
    }
  }

  async scrapeAllConversations(maxConversations = 15) {
    console.log(`\n🔍 Starting to scrape your past messages from ${maxConversations} conversations...\n`);

    await this.navigateToMessaging();
    const conversations = await this.getConversationList(maxConversations);

    const allYourMessages = [];

    for (const conv of conversations) {
      const result = await this.scrapeConversation(conv.threadId, conv.participantName);

      if (result && result.yourMessages.length > 0) {
        allYourMessages.push(...result.yourMessages.map(m => ({
          ...m,
          participant: conv.participantName
        })));
      }

      // Random delay between conversations to seem human
      await randomDelay(2000, 4000);
    }

    // Save scraped messages
    this.scrapedMessages = allYourMessages;
    await this.saveScrapedMessages();

    console.log(`\n✅ Scraped ${allYourMessages.length} of your messages from ${conversations.length} conversations`);
    return allYourMessages;
  }

  async saveScrapedMessages() {
    await fs.writeFile(
      SCRAPED_MESSAGES_PATH,
      JSON.stringify(this.scrapedMessages, null, 2)
    );
    console.log(`💾 Saved scraped messages to ${SCRAPED_MESSAGES_PATH}`);
  }

  // === VOICE ANALYSIS ===

  async analyzeVoice() {
    if (this.scrapedMessages.length < 5) {
      console.log('⚠️  Need at least 5 messages to analyze voice. Run scrapeAllConversations first.');
      return null;
    }

    console.log(`\n🎤 Analyzing your voice from ${this.scrapedMessages.length} messages...\n`);

    // Prepare sample messages for analysis
    const sampleMessages = this.scrapedMessages
      .filter(m => m.content.length > 10 && m.content.length < 500)
      .slice(0, 50)
      .map(m => m.content);

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

      this.voiceProfile = JSON.parse(jsonStr);
      this.voiceProfile.analyzedAt = new Date().toISOString();
      this.voiceProfile.messageCount = this.scrapedMessages.length;

      // Save voice profile
      await this.saveVoiceProfile();

      console.log('✅ Voice profile created!\n');
      console.log('📝 Summary:', this.voiceProfile.summary);

      return this.voiceProfile;
    } catch (error) {
      console.error('❌ Error analyzing voice:', error.message);
      return null;
    }
  }

  async saveVoiceProfile() {
    await fs.writeFile(
      VOICE_PROFILE_PATH,
      JSON.stringify(this.voiceProfile, null, 2)
    );
    console.log(`💾 Saved voice profile to ${VOICE_PROFILE_PATH}`);
  }

  // === GENERATE REPLIES IN YOUR VOICE ===

  async generateReply(incomingMessage, conversationContext = [], senderName = 'them') {
    if (!this.voiceProfile) {
      console.log('⚠️  No voice profile loaded. Run analyzeVoice first or load existing profile.');
      // Fall back to generic professional reply
      return this.generateGenericReply(incomingMessage, senderName);
    }

    console.log('✍️  Generating reply in your voice...');

    // Build conversation context string
    let contextStr = '';
    if (conversationContext.length > 0) {
      contextStr = '\nRECENT CONVERSATION:\n' +
        conversationContext.slice(-5).map(m =>
          `${m.isOutgoing ? 'You' : senderName}: ${m.content}`
        ).join('\n');
    }

    const prompt = `You need to write a LinkedIn DM reply that sounds EXACTLY like this person based on their voice profile.

VOICE PROFILE:
${JSON.stringify(this.voiceProfile, null, 2)}

${contextStr}

MESSAGE TO REPLY TO (from ${senderName}):
"${incomingMessage}"

Write a reply that:
1. Matches their exact tone and formality level
2. Uses their typical greeting/sign-off style (or lack thereof)
3. Includes their common phrases naturally
4. Matches their punctuation and emoji patterns
5. Follows their typical message length
6. Sounds like they actually wrote it

IMPORTANT:
- Don't be robotic or overly formal unless that's their style
- Don't add things they wouldn't say
- Keep it natural and conversational
- Match their energy level

Reply only with the message text, nothing else:`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are ghostwriting as someone with this communication style: ${this.voiceProfile.summary}. Write EXACTLY how they would write - same tone, same length, same phrases. Be authentic to their voice.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const reply = completion.choices[0].message.content.trim();
      console.log(`✅ Generated reply: "${reply.substring(0, 50)}..."`);
      return reply;
    } catch (error) {
      console.error('❌ Error generating reply:', error.message);
      return this.generateGenericReply(incomingMessage, senderName);
    }
  }

  generateGenericReply(incomingMessage, senderName) {
    // Simple fallback replies
    const genericReplies = [
      "Thanks for reaching out! Let me get back to you on this.",
      "Appreciate the message - I'll follow up soon.",
      "Got it, thanks! Will circle back shortly.",
      "Thanks for the note! Let me look into this."
    ];
    return genericReplies[Math.floor(Math.random() * genericReplies.length)];
  }

  // === CATEGORIZED REPLY GENERATION ===

  async generateCategorizedReply(incomingMessage, category, conversationContext = [], senderName = 'them') {
    // Categories: networking, job-inquiry, sales-pitch, follow-up, thank-you, question
    const categoryPrompts = {
      'networking': 'This is a networking/connection message. Be friendly and open to connecting.',
      'job-inquiry': 'This is about a job opportunity. Be professional but interested.',
      'sales-pitch': 'This is a sales/marketing message. Be polite but brief.',
      'follow-up': 'This is a follow-up to a previous conversation. Reference the context.',
      'thank-you': 'They are thanking you. Respond graciously.',
      'question': 'They are asking a question. Answer helpfully in your style.'
    };

    const categoryContext = categoryPrompts[category] || '';

    if (!this.voiceProfile) {
      return this.generateGenericReply(incomingMessage, senderName);
    }

    const prompt = `Write a LinkedIn DM reply in this person's voice.

VOICE PROFILE:
${JSON.stringify(this.voiceProfile, null, 2)}

CONTEXT: ${categoryContext}

MESSAGE TO REPLY TO:
"${incomingMessage}"

Write a natural reply that sounds exactly like them:`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Ghostwrite as someone with this style: ${this.voiceProfile.summary}. Match their voice exactly.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error:', error.message);
      return this.generateGenericReply(incomingMessage, senderName);
    }
  }

  // === UTILITY ===

  getVoiceProfile() {
    return this.voiceProfile;
  }

  getScrapedMessageCount() {
    return this.scrapedMessages.length;
  }
}

module.exports = VoiceLearner;
