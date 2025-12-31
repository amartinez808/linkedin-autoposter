const fs = require('fs').promises;
const path = require('path');
const VoiceLearner = require('./voiceLearner');
require('dotenv').config();

// Human-like delay function
function randomDelay(min = 2000, max = 5000) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  );
}

class AutoReplyBot {
  constructor(linkedInBot) {
    this.bot = linkedInBot;
    this.page = linkedInBot.page;
    this.voiceLearner = new VoiceLearner(linkedInBot);
    this.voiceEnabled = false;
  }

  async initVoice() {
    await this.voiceLearner.init();
    if (this.voiceLearner.getVoiceProfile()) {
      this.voiceEnabled = true;
      console.log('🎤 Voice profile loaded - replies will match your style');
    } else {
      console.log('⚠️  No voice profile found. Run learnVoice() to create one.');
    }
  }

  async learnVoice(maxConversations = 15) {
    console.log('\n🎓 Learning your voice from past messages...\n');
    await this.voiceLearner.scrapeAllConversations(maxConversations);
    await this.voiceLearner.analyzeVoice();
    this.voiceEnabled = true;
    console.log('\n✅ Voice learning complete! Auto-replies will now match your style.\n');
  }

  async generateSmartReply(incomingMessage, conversationHistory = [], senderName = 'them') {
    if (this.voiceEnabled) {
      return await this.voiceLearner.generateReply(incomingMessage, conversationHistory, senderName);
    }
    // Fallback to generic
    return "Thanks for reaching out! I'll get back to you soon.";
  }

  // === NAVIGATION ===

  async navigateToInbox() {
    console.log('📬 Navigating to inbox...');

    try {
      await this.page.goto('https://www.linkedin.com/messaging/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (navError) {
      console.log('Warning: Navigation timeout, checking if page loaded...');
    }

    await randomDelay(3000, 5000);

    // Multiple selector fallbacks for inbox detection
    const inboxSelectors = [
      '.msg-conversations-container__conversations-list',
      '.msg-overlay-list-bubble',
      '[class*="messaging"]',
      '.scaffold-layout__main'
    ];

    for (const selector of inboxSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        console.log('   Inbox loaded successfully');
        return true;
      } catch (e) {
        continue;
      }
    }

    await this.takeDebugScreenshot('inbox-error');
    console.log('   Warning: Could not confirm inbox loaded');
    return false;
  }

  async navigateToNotifications() {
    console.log('🔔 Navigating to notifications...');

    try {
      await this.page.goto('https://www.linkedin.com/notifications/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (navError) {
      console.log('Warning: Navigation timeout, checking if page loaded...');
    }

    await randomDelay(3000, 5000);

    const notificationSelectors = [
      '.nt-card-list',
      '[class*="notification"]',
      '.scaffold-layout__main'
    ];

    for (const selector of notificationSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        console.log('   Notifications loaded successfully');
        return true;
      } catch (e) {
        continue;
      }
    }

    await this.takeDebugScreenshot('notifications-error');
    console.log('   Warning: Could not confirm notifications loaded');
    return false;
  }

  async openConversation(threadId) {
    console.log(`💬 Opening conversation: ${threadId}`);

    try {
      // Try clicking the conversation in the list first
      const conversationSelector = `[data-conversation-id="${threadId}"], [href*="${threadId}"]`;

      try {
        await this.page.waitForSelector(conversationSelector, { timeout: 5000 });
        await this.page.click(conversationSelector);
        await randomDelay(2000, 3000);
        console.log('   Conversation opened via click');
        return true;
      } catch (e) {
        // Fall back to direct navigation
        const threadUrl = `https://www.linkedin.com/messaging/thread/${threadId}/`;
        await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(2000, 4000);
        console.log('   Conversation opened via URL');
        return true;
      }
    } catch (error) {
      console.error('   Error opening conversation:', error.message);
      await this.takeDebugScreenshot('conversation-error');
      return false;
    }
  }

  async navigateToPost(postUrl) {
    console.log(`📄 Navigating to post: ${postUrl}`);

    try {
      await this.page.goto(postUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (navError) {
      console.log('Warning: Navigation timeout, checking if page loaded...');
    }

    await randomDelay(3000, 5000);

    const postSelectors = [
      '.feed-shared-update-v2',
      '[data-urn*="activity"]',
      '.social-details-social-counts'
    ];

    for (const selector of postSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        console.log('   Post loaded successfully');
        return true;
      } catch (e) {
        continue;
      }
    }

    await this.takeDebugScreenshot('post-error');
    console.log('   Warning: Could not confirm post loaded');
    return false;
  }

  // === DETECTION ===

  async getUnreadConversations() {
    console.log('🔍 Checking for unread conversations...');

    try {
      const conversations = await this.page.evaluate(() => {
        const items = [];

        // Look for conversation cards with unread indicators
        const conversationCards = document.querySelectorAll(
          '.msg-conversation-listitem, .msg-conversation-card, [class*="conversation-list-item"]'
        );

        conversationCards.forEach(card => {
          // Check for unread badge
          const unreadBadge = card.querySelector(
            '.msg-conversation-card__unread-count, [class*="notification-badge"], .artdeco-notification-badge'
          );

          if (unreadBadge) {
            const nameEl = card.querySelector(
              '.msg-conversation-card__participant-names, [class*="participant-name"], .msg-conversation-listitem__participant-names'
            );
            const previewEl = card.querySelector(
              '.msg-conversation-card__message-snippet, [class*="message-snippet"]'
            );
            const linkEl = card.querySelector('a[href*="messaging"]');

            // Extract thread ID from href or data attribute
            let threadId = card.getAttribute('data-conversation-id');
            if (!threadId && linkEl) {
              const href = linkEl.getAttribute('href') || '';
              const match = href.match(/thread\/([^/]+)/);
              if (match) threadId = match[1];
            }

            items.push({
              threadId: threadId,
              authorName: nameEl ? nameEl.innerText.trim() : 'Unknown',
              preview: previewEl ? previewEl.innerText.trim() : '',
              unreadCount: parseInt(unreadBadge.innerText) || 1
            });
          }
        });

        return items;
      });

      console.log(`   Found ${conversations.length} unread conversation(s)`);
      return conversations;
    } catch (error) {
      console.error('   Error getting unread conversations:', error.message);
      await this.takeDebugScreenshot('unread-error');
      return [];
    }
  }

  async extractConversationHistory(limit = 10) {
    console.log(`📜 Extracting conversation history (last ${limit} messages)...`);

    try {
      const messages = await this.page.evaluate((messageLimit) => {
        const items = [];

        const messageElements = document.querySelectorAll(
          '.msg-s-message-list__event, .msg-s-event-listitem, [class*="message-list-item"]'
        );

        const relevantMessages = Array.from(messageElements).slice(-messageLimit);

        relevantMessages.forEach(msgEl => {
          const senderEl = msgEl.querySelector(
            '.msg-s-message-group__name, [class*="sender-name"], .msg-s-event-listitem__link'
          );
          const contentEl = msgEl.querySelector(
            '.msg-s-event-listitem__body, [class*="message-body"], .msg-s-message-list-content'
          );
          const timeEl = msgEl.querySelector(
            '.msg-s-message-group__timestamp, time, [class*="timestamp"]'
          );

          // Check if this is an outgoing message (sent by user)
          const isOutgoing = msgEl.classList.contains('msg-s-message-list__event--outbound') ||
                            msgEl.querySelector('[class*="outbound"]') !== null;

          if (contentEl) {
            items.push({
              sender: senderEl ? senderEl.innerText.trim() : (isOutgoing ? 'You' : 'Other'),
              content: contentEl.innerText.trim(),
              timestamp: timeEl ? timeEl.getAttribute('datetime') || timeEl.innerText.trim() : null,
              isOutgoing: isOutgoing
            });
          }
        });

        return items;
      }, limit);

      console.log(`   Extracted ${messages.length} message(s)`);
      return messages;
    } catch (error) {
      console.error('   Error extracting conversation:', error.message);
      await this.takeDebugScreenshot('history-error');
      return [];
    }
  }

  async getCommentNotifications() {
    console.log('🔍 Checking for comment notifications...');

    try {
      const notifications = await this.page.evaluate(() => {
        const items = [];

        const notificationCards = document.querySelectorAll(
          '.nt-card, [class*="notification-card"], .notification-card'
        );

        notificationCards.forEach(card => {
          const textEl = card.querySelector(
            '.nt-card__text, [class*="notification-text"]'
          );
          const text = textEl ? textEl.innerText.toLowerCase() : '';

          // Look for "commented on your post" notifications
          if (text.includes('commented') && (text.includes('your post') || text.includes('your activity'))) {
            const linkEl = card.querySelector('a[href*="activity"], a[href*="feed/update"]');
            const nameEl = card.querySelector(
              '.nt-card__actor-name, [class*="actor-name"], strong'
            );

            let postUrl = null;
            if (linkEl) {
              postUrl = linkEl.getAttribute('href');
              if (postUrl && !postUrl.startsWith('http')) {
                postUrl = 'https://www.linkedin.com' + postUrl;
              }
            }

            items.push({
              authorName: nameEl ? nameEl.innerText.trim() : 'Someone',
              postUrl: postUrl,
              notificationText: textEl ? textEl.innerText.trim() : '',
              detectedAt: new Date().toISOString()
            });
          }
        });

        return items;
      });

      console.log(`   Found ${notifications.length} comment notification(s)`);
      return notifications;
    } catch (error) {
      console.error('   Error getting comment notifications:', error.message);
      await this.takeDebugScreenshot('notifications-extract-error');
      return [];
    }
  }

  async extractComments(includeReplied = false) {
    console.log('💬 Extracting comments from post...');

    try {
      // First, try to expand comments section
      const expandSelectors = [
        'button[aria-label*="comment"]',
        '.social-details-social-counts__comments',
        '[class*="show-comments"]'
      ];

      for (const selector of expandSelectors) {
        try {
          const expandBtn = await this.page.$(selector);
          if (expandBtn) {
            await expandBtn.click();
            await randomDelay(2000, 3000);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      const comments = await this.page.evaluate((includeRepliedComments) => {
        const items = [];

        const commentElements = document.querySelectorAll(
          '.comments-comment-item, [class*="comment-item"], .feed-shared-update-v2__comments-container article'
        );

        commentElements.forEach(commentEl => {
          const authorEl = commentEl.querySelector(
            '.comments-post-meta__name-text, [class*="commenter-name"], .feed-shared-actor__name'
          );
          const contentEl = commentEl.querySelector(
            '.comments-comment-item__main-content, [class*="comment-text"], .feed-shared-text'
          );
          const replyBtnEl = commentEl.querySelector(
            'button[aria-label*="Reply"], [class*="reply-button"]'
          );

          // Check if we've already replied (look for our reply in thread)
          const hasReply = commentEl.querySelector('.comments-comment-item--reply') !== null;

          if (contentEl && (includeRepliedComments || !hasReply)) {
            // Try to get comment ID from data attributes
            const commentId = commentEl.getAttribute('data-id') ||
                             commentEl.getAttribute('data-urn') ||
                             `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            items.push({
              commentId: commentId,
              authorName: authorEl ? authorEl.innerText.trim() : 'Unknown',
              content: contentEl.innerText.trim(),
              hasReply: hasReply,
              canReply: replyBtnEl !== null
            });
          }
        });

        return items;
      }, includeReplied);

      console.log(`   Extracted ${comments.length} comment(s)`);
      return comments;
    } catch (error) {
      console.error('   Error extracting comments:', error.message);
      await this.takeDebugScreenshot('comments-error');
      return [];
    }
  }

  // === SENDING ===

  async sendDirectMessage(text) {
    console.log('📤 Sending direct message...');

    try {
      // Find message input
      const inputSelectors = [
        '.msg-form__contenteditable',
        '[role="textbox"][contenteditable="true"]',
        '.msg-form__message-texteditor',
        'div[data-placeholder="Write a message…"]'
      ];

      let inputEl = null;
      for (const selector of inputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          inputEl = await this.page.$(selector);
          if (inputEl) break;
        } catch (e) {
          continue;
        }
      }

      if (!inputEl) {
        throw new Error('Could not find message input');
      }

      // Click and type with human-like delays
      await inputEl.click();
      await randomDelay(500, 1000);

      await this.humanTypeReply(text);
      await randomDelay(1000, 2000);

      // Find and click send button
      const sendSelectors = [
        'button[type="submit"].msg-form__send-button',
        'button[aria-label*="Send"]',
        '.msg-form__send-button',
        'button.msg-form__send-btn'
      ];

      let sent = false;
      for (const selector of sendSelectors) {
        try {
          const sendBtn = await this.page.$(selector);
          if (sendBtn) {
            const isDisabled = await this.page.evaluate(el => el.disabled, sendBtn);
            if (!isDisabled) {
              await sendBtn.click();
              sent = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!sent) {
        // Try pressing Enter as fallback
        await this.page.keyboard.press('Enter');
        sent = true;
      }

      await randomDelay(2000, 3000);
      console.log('   Message sent successfully');
      return true;
    } catch (error) {
      console.error('   Error sending message:', error.message);
      await this.takeDebugScreenshot('send-dm-error');
      return false;
    }
  }

  async replyToComment(commentId, text) {
    console.log(`💬 Replying to comment: ${commentId}`);

    try {
      // Find the specific comment and its reply button
      const replyClicked = await this.page.evaluate((cId) => {
        const commentEl = document.querySelector(`[data-id="${cId}"], [data-urn="${cId}"]`) ||
                         document.querySelector('.comments-comment-item');

        if (!commentEl) return false;

        const replyBtn = commentEl.querySelector(
          'button[aria-label*="Reply"], [class*="reply-button"], button[class*="reply"]'
        );

        if (replyBtn) {
          replyBtn.click();
          return true;
        }
        return false;
      }, commentId);

      if (!replyClicked) {
        console.log('   Could not find reply button, trying generic approach...');
      }

      await randomDelay(1500, 2500);

      // Find the reply input
      const replyInputSelectors = [
        '.comments-comment-box__form .ql-editor',
        '.comments-comment-texteditor [contenteditable="true"]',
        '[data-placeholder*="Add a reply"]',
        '.ql-editor[data-placeholder]'
      ];

      let replyInput = null;
      for (const selector of replyInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          replyInput = await this.page.$(selector);
          if (replyInput) break;
        } catch (e) {
          continue;
        }
      }

      if (!replyInput) {
        throw new Error('Could not find reply input');
      }

      await replyInput.click();
      await randomDelay(500, 1000);

      await this.humanTypeReply(text);
      await randomDelay(1000, 2000);

      // Find and click post/submit button for reply
      const postSelectors = [
        'button[class*="comments-comment-box__submit"]',
        'button[type="submit"][class*="comment"]',
        'button[aria-label*="Post"]'
      ];

      let posted = false;
      for (const selector of postSelectors) {
        try {
          const postBtn = await this.page.$(selector);
          if (postBtn) {
            const isDisabled = await this.page.evaluate(el => el.disabled, postBtn);
            if (!isDisabled) {
              await postBtn.click();
              posted = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!posted) {
        // Try Ctrl+Enter as fallback
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('Enter');
        await this.page.keyboard.up('Control');
        posted = true;
      }

      await randomDelay(2000, 3000);
      console.log('   Reply posted successfully');
      return true;
    } catch (error) {
      console.error('   Error replying to comment:', error.message);
      await this.takeDebugScreenshot('reply-comment-error');
      return false;
    }
  }

  // === UTILITIES ===

  async humanTypeReply(text) {
    // Type character by character with random delays (human-like)
    for (const char of text) {
      await this.page.keyboard.type(char);
      const delay = char === ' ' ? Math.random() * 100 + 50 : Math.random() * 80 + 30;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async takeDebugScreenshot(prefix) {
    try {
      const screenshotPath = path.join(
        __dirname,
        'screenshots',
        `${prefix}-${Date.now()}.png`
      );
      await this.page.screenshot({ path: screenshotPath });
      console.log(`   Screenshot saved: ${screenshotPath}`);
    } catch (e) {
      console.log('   Could not take screenshot');
    }
  }

  // === MAIN AUTO-REPLY LOOP ===

  async processUnreadMessages(options = {}) {
    const {
      requireApproval = process.env.REQUIRE_APPROVAL === 'true',
      maxReplies = 10,
      skipSalesPitches = true
    } = options;

    console.log('\n🤖 Starting auto-reply bot...\n');
    console.log(`   Voice enabled: ${this.voiceEnabled}`);
    console.log(`   Require approval: ${requireApproval}`);
    console.log(`   Max replies: ${maxReplies}\n`);

    // Navigate to inbox
    await this.navigateToInbox();
    await randomDelay(2000, 3000);

    // Get unread conversations
    const unreadConvos = await this.getUnreadConversations();

    if (unreadConvos.length === 0) {
      console.log('📭 No unread messages to reply to');
      return { processed: 0, replied: 0, skipped: 0 };
    }

    console.log(`\n📬 Found ${unreadConvos.length} unread conversation(s)\n`);

    let processed = 0;
    let replied = 0;
    let skipped = 0;

    for (const convo of unreadConvos.slice(0, maxReplies)) {
      processed++;
      console.log(`\n--- Processing ${processed}/${Math.min(unreadConvos.length, maxReplies)} ---`);
      console.log(`From: ${convo.authorName}`);

      // Open the conversation
      const opened = await this.openConversation(convo.threadId);
      if (!opened) {
        console.log('   Skipping - could not open conversation');
        skipped++;
        continue;
      }

      await randomDelay(2000, 3000);

      // Extract conversation history
      const history = await this.extractConversationHistory(10);

      if (history.length === 0) {
        console.log('   Skipping - no messages found');
        skipped++;
        continue;
      }

      // Get the last message (the one we're replying to)
      const lastMessage = history[history.length - 1];

      // Skip if last message is from us (already replied)
      if (lastMessage.isOutgoing) {
        console.log('   Skipping - already replied');
        skipped++;
        continue;
      }

      console.log(`   Last message: "${lastMessage.content.substring(0, 80)}..."`);

      // Detect if it's a sales pitch (optional skip)
      if (skipSalesPitches && this.detectSalesPitch(lastMessage.content)) {
        console.log('   Skipping - detected sales pitch');
        skipped++;
        continue;
      }

      // Generate reply in your voice
      const reply = await this.generateSmartReply(
        lastMessage.content,
        history,
        convo.authorName
      );

      console.log(`   Generated reply: "${reply.substring(0, 80)}..."`);

      if (requireApproval) {
        console.log('\n   [APPROVAL REQUIRED] Reply not sent - set REQUIRE_APPROVAL=false to auto-send');
        // Save pending reply for review
        await this.savePendingReply(convo, lastMessage, reply);
      } else {
        // Send the reply
        const sent = await this.sendDirectMessage(reply);
        if (sent) {
          replied++;
          console.log('   ✅ Reply sent!');
          await this.logReply(convo, lastMessage, reply);
        } else {
          console.log('   ❌ Failed to send reply');
        }
      }

      // Human-like delay between processing conversations
      await randomDelay(5000, 10000);
    }

    console.log('\n========================================');
    console.log(`✅ Auto-reply complete!`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Replied: ${replied}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('========================================\n');

    return { processed, replied, skipped };
  }

  detectSalesPitch(message) {
    const salesKeywords = [
      'buy now', 'limited time', 'discount', 'special offer',
      'schedule a call', 'book a demo', 'free trial',
      'increase your revenue', 'grow your business',
      'exclusive opportunity', 'act now', 'don\'t miss out',
      'we help companies', 'our solution', 'our platform'
    ];

    const lowerMessage = message.toLowerCase();
    return salesKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  async savePendingReply(convo, lastMessage, generatedReply) {
    const pendingPath = path.join(__dirname, 'replies', 'pending-replies.json');

    let pending = [];
    try {
      const data = await fs.readFile(pendingPath, 'utf-8');
      pending = JSON.parse(data);
    } catch (e) {}

    pending.push({
      threadId: convo.threadId,
      authorName: convo.authorName,
      incomingMessage: lastMessage.content,
      generatedReply: generatedReply,
      generatedAt: new Date().toISOString()
    });

    await fs.writeFile(pendingPath, JSON.stringify(pending, null, 2));
    console.log('   💾 Saved to pending replies for review');
  }

  async logReply(convo, lastMessage, sentReply) {
    const logPath = path.join(__dirname, 'replies', 'sent-replies.json');

    let log = [];
    try {
      const data = await fs.readFile(logPath, 'utf-8');
      log = JSON.parse(data);
    } catch (e) {}

    log.push({
      threadId: convo.threadId,
      authorName: convo.authorName,
      incomingMessage: lastMessage.content,
      sentReply: sentReply,
      sentAt: new Date().toISOString()
    });

    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }
}

module.exports = AutoReplyBot;
