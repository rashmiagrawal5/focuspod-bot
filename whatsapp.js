// FIXED: whatsapp.js - Proper message sending with validation

const axios = require('axios');
require('dotenv').config();

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

// FIXED: Send a simple text message with proper validation
async function sendMessage(phone, text) {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  
  try {
    // FIXED: Validate inputs before sending
    if (!phone || !text) {
      console.error('❌ Invalid message parameters:', { phone: !!phone, text: !!text });
      throw new Error('Phone number and text are required');
    }
    
    if (typeof text !== 'string' || text.trim() === '') {
      console.error('❌ Invalid text content:', { text, type: typeof text });
      throw new Error('Text must be a non-empty string');
    }
    
    console.log(`📤 Sending message to ${phone}: ${text.substring(0, 50)}...`);
    
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: phone,
        text: { body: text.trim() }, // FIXED: Ensure text.body is properly set
      },
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    console.log(`✅ Text message sent to ${phone}`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending text message:', error.response?.data || error.message);
    
    // FIXED: Better error handling for different types of errors
    if (error.response?.status === 400) {
      console.error('❌ WhatsApp API Error - Bad Request:', {
        message: error.response.data?.error?.message,
        code: error.response.data?.error?.code,
        sentData: { phone, text: typeof text, textLength: text?.length }
      });
    }
    
    throw error;
  }
}

// FIXED: Send interactive buttons with validation
async function sendButtons(phone, bodyText, buttons) {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  
  // FIXED: Validate inputs
  if (!phone || !bodyText || !buttons || buttons.length === 0) {
    console.error('❌ Invalid button parameters:', { 
      phone: !!phone, 
      bodyText: !!bodyText, 
      buttons: buttons?.length 
    });
    return;
  }
  
  if (buttons.length > 3) {
    console.error('❌ Too many buttons (max 3 allowed)');
    buttons = buttons.slice(0, 3); // Take only first 3
  }
  
  try {
    console.log(`📤 Sending buttons to ${phone}: ${bodyText.substring(0, 30)}...`);
    
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText.trim() }, // FIXED: Ensure proper text formatting
          action: {
            buttons: buttons.map((btnText, idx) => ({
              type: 'reply',
              reply: {
                id: `btn_${idx + 1}`,
                title: btnText.substring(0, 20).trim(), // WhatsApp limit is 20 chars
              },
            })),
          },
        },
      },
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    console.log(`✅ Button message sent to ${phone} with ${buttons.length} buttons`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending button message:', error.response?.data || error.message);
    
    // Fallback: send as text message if buttons fail
    const fallbackText = `${bodyText}\n\nOptions:\n${buttons.map((btn, idx) => `${idx + 1}. ${btn}`).join('\n')}\n\nPlease reply with the number of your choice.`;
    await sendMessage(phone, fallbackText);
  }
}

// Send a list message (for more than 3 options)
async function sendList(phone, bodyText, buttonText, sections) {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  
  try {
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: sections
          },
        },
      },
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    console.log(`✅ List message sent to ${phone}`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending list message:', error.response?.data || error.message);
    throw error;
  }
}

// Send message with quick reply buttons (alternative format)
async function sendQuickReply(phone, text, options) {
  // This is a fallback that sends numbered options as text
  const optionsText = options.map((option, idx) => `${idx + 1}. ${option}`).join('\n');
  const fullMessage = `${text}\n\n${optionsText}\n\nPlease reply with the number of your choice.`;
  
  return await sendMessage(phone, fullMessage);
}

module.exports = { 
  sendMessage, 
  sendButtons, 
  sendList, 
  sendQuickReply 
};