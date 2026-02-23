const express = require('express');
const bodyParser = require('body-parser');
const { logSupportRequest, logError } = require('./sheets');
require('dotenv').config();

// ==========================================
// SIMPLIFIED LOGGING SYSTEM
// ==========================================

// Simple logging wrapper - only log important events
function logInfo(message) {
  console.log(`ℹ️ ${new Date().toISOString()} - ${message}`);
}

function logServerError(message, error = null) {
  console.error(`❌ ${new Date().toISOString()} - ${message}`);
  if (error && error.stack) {
    console.error(error.stack);
  }
}

function logSuccess(message) {
  console.log(`✅ ${new Date().toISOString()} - ${message}`);
}

// Only log server startup and critical events
console.log('🚀 FocusPod Bot Starting...');

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} from ${req.ip}`);
  if (req.method === 'POST' && req.body) {
    console.log(`Headers: ${JSON.stringify({
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']?.substring(0, 50),
      'content-length': req.headers['content-length']
    })}`);
  }
  next();
});

// ==========================================
// IMPORT MESSAGE PROCESSING
// ==========================================
const { handleUserMessage, handleInteractiveMessage } = require('./userFlow');

// ==========================================
// DUPLICATE MESSAGE PREVENTION
// ==========================================
const processedMessages = new Set();

// Clean up old message IDs every 5 minutes
setInterval(() => {
  if (processedMessages.size > 1000) {
    processedMessages.clear();
    console.log('🧹 Cleared processed messages cache');
  }
}, 5 * 60 * 1000);

// ==========================================
// TEST & DEBUG ENDPOINTS
// ==========================================

// Basic test endpoint
app.get('/test', (req, res) => {
  console.log('✅ Basic GET test endpoint hit');
  res.json({ 
    status: 'Server is running!', 
    timestamp: new Date().toISOString(),
    service: 'FocusPod WhatsApp Bot',
    endpoints: {
      health: '/health',
      webhook: '/webhook',
      razorpay: '/razorpay-webhook',
      test: '/test-webhook',
      debug: '/debug-payments'
    }
  });
});

// Test webhook endpoint
app.post('/test-webhook', (req, res) => {
  console.log('✅ Test webhook endpoint hit');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  res.json({ 
    status: 'Test webhook received', 
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Debug payments endpoint
app.get('/debug-payments', (req, res) => {
  const pendingCount = Object.keys(global.pendingPayments || {}).length;
  const pendingPayments = global.pendingPayments || {};
  
  console.log('🔍 Debug payments endpoint accessed');
  res.json({
    status: 'Debug info',
    pendingCount,
    pendingPayments,
    timestamp: new Date().toISOString()
  });
});

// Test connection endpoint  
app.get('/test-connection', (req, res) => {
  console.log('🧪 Test connection endpoint hit');
  res.json({
    status: 'Server is running and reachable',
    timestamp: new Date().toISOString(),
    webhookUrl: `${process.env.WEBHOOK_BASE_URL}/razorpay-webhook`,
    pendingPayments: Object.keys(global.pendingPayments || {}).length,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
      webhookBase: process.env.WEBHOOK_BASE_URL
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'FocusPod WhatsApp Bot',
    version: '1.0.0',
    razorpay_webhook: `${process.env.WEBHOOK_BASE_URL}/razorpay-webhook`,
    payment_pages: {
      success: `${process.env.WEBHOOK_BASE_URL}/payment-success`,
      failure: `${process.env.WEBHOOK_BASE_URL}/payment-failure`
    }
  });
});

// ==========================================
// WHATSAPP WEBHOOK VERIFICATION
// ==========================================
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "focuspod_verify_token";
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    console.log(`Mode: ${mode}, Token: ${token}`);
    res.sendStatus(403);
  }
});

// ==========================================
// WHATSAPP WEBHOOK MESSAGE PROCESSING
// ==========================================
app.post('/webhook', async (req, res) => {
  try {
    
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    // Handle regular text messages
    const message = value?.messages?.[0];
    if (message) {
      const from = message.from;
      const messageType = message.type;
      const messageId = message.id; // WhatsApp provides unique message ID
      
      // DUPLICATE PREVENTION: Check if we've already processed this message
      if (processedMessages.has(messageId)) {
        console.log(`⚠️ Duplicate message ignored: ${messageId} from ${from}`);
        return res.sendStatus(200); // Acknowledge but don't process
      }
      
      // Add to processed messages
      processedMessages.add(messageId);
      
      // Clean up old message IDs after 5 minutes
      setTimeout(() => {
        processedMessages.delete(messageId);
      }, 5 * 60 * 1000);
      
      console.log(`📩 Message type: ${messageType} from ${from}`);
      
      if (messageType === 'text') {
        const text = message.text.body;
        console.log(`💬 Text message: ${text}`);
        console.log(`🔄 Processing message from ${from}: ${text}`);
        await handleUserMessage(from, text);
      } 
      else if (messageType === 'interactive') {
        console.log(`📘 Interactive message:`, message.interactive);
        
        // FIXED: Check for button_reply properly
        const buttonReply = message.interactive?.button_reply;
        if (buttonReply) {
          console.log(`🔘 DEBUG: Button clicked by ${from}: ${buttonReply.title}`);
          await handleInteractiveMessage(from, message.interactive);
        } else {
          console.log(`❌ No button_reply found in interactive message`);
        }
      }
      else if (messageType === 'image' || messageType === 'document') {
        console.log(`📷 Media message received from ${from} - redirecting to support`);
        const { sendMessage } = require('./whatsapp');
        const { MESSAGES } = require('./messages');
        await sendMessage(from, MESSAGES.MEDIA_REDIRECT_SUPPORT);
        await logSupportRequest(from, 'Media', 'User sent media file');

      }
      else {
        console.log(`❓ Unhandled message type: ${messageType}`);
        // You can add handling for other message types here
      }
    }
    
    
    
    res.sendStatus(200);
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    console.error('Stack trace:', error.stack);
    await logError('Webhook', message?.from || 'unknown', error.message);

    
    // Send error message to help debug
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    
  if (message?.from) {
      try {
        const { sendMessage } = require('./whatsapp');
        const { MESSAGES } = require('./messages');
        await sendMessage(message.from, MESSAGES.ERROR_WEBHOOK_PROCESSING);
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
      }
    }
    
    res.sendStatus(500);
  }
});

// ==========================================
// RAZORPAY WEBHOOK PROCESSING
// ==========================================

// Import Razorpay webhook handler
const { handleRazorpayWebhook } = require('./razorpay-payments');

app.post('/razorpay-webhook', async (req, res) => {
  try {
    console.log('\n💰 ===== RAZORPAY WEBHOOK RECEIVED =====');
    console.log('📦 Full Body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'x-razorpay-signature': req.headers['x-razorpay-signature'] ? 'PRESENT' : 'MISSING',
      'user-agent': req.headers['user-agent']
    });
    
    // Check current pending payments
    const pendingCount = Object.keys(global.pendingPayments || {}).length;
    console.log('💾 Current pending payments count:', pendingCount);
    if (pendingCount > 0) {
      console.log('📋 Pending payment IDs:', Object.keys(global.pendingPayments));
    }
    
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookBody = req.body;
    
    // Validate basic webhook structure
    if (!webhookBody || !webhookBody.event) {
      console.error('❌ Invalid webhook - missing event');
      return res.status(400).json({ error: 'Invalid webhook body' });
    }
    
    console.log(`🔨 Processing event: ${webhookBody.event}`);
    
    // Handle the webhook
    const result = await handleRazorpayWebhook(webhookBody, webhookSignature);
    
    console.log('📊 Webhook processing result:', result);
    
    if (result.success) {
      console.log(`✅ SUCCESS: ${result.status}`);
      res.status(200).json({ status: 'success', result: result.status });
    } else {
      console.log(`❌ FAILED: ${result.error}`);
      res.status(400).json({ error: result.error });
    }
    
    console.log('💰 ===== WEBHOOK PROCESSING COMPLETE =====\n');
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in webhook:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

// ==========================================
// PAYMENT SUCCESS/FAILURE PAGES
// ==========================================

// Payment success page (for user redirect after payment)
app.get('/payment-success', (req, res) => {
  const { razorpay_payment_id, razorpay_payment_link_id, razorpay_payment_link_reference_id } = req.query;
  
  console.log(`✅ Payment success page accessed`);
  console.log(`Payment ID: ${razorpay_payment_id}`);
  console.log(`Payment Link ID: ${razorpay_payment_link_id}`);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful - FocusPod</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          text-align: center; 
          padding: 20px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .success-box {
          background: white;
          padding: 40px 30px;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 90%;
        }
        .success-icon {
          font-size: 64px;
          color: #28a745;
          margin-bottom: 20px;
        }
        h1 {
          color: #28a745;
          margin-bottom: 10px;
          font-size: 28px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .whatsapp-btn {
          background: #25D366;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 50px;
          display: inline-block;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        .whatsapp-btn:hover {
          background: #20ba5a;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(37, 211, 102, 0.4);
        }
        .payment-id {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 12px;
          color: #666;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="success-box">
        <div class="success-icon">✅</div>
        <h1>Payment Successful!</h1>
        <p>Your FocusPod booking has been confirmed. You'll receive your access details on WhatsApp within 30 seconds.</p>
        
        ${razorpay_payment_id ? `<div class="payment-id">Payment ID: ${razorpay_payment_id}</div>` : ''}
        
        <a href="https://wa.me/${process.env.PHONE_NUMBER_ID?.replace('whatsapp:', '') || '919036089111'}?text=Hi, I just completed my payment. Can you share my booking details?" class="whatsapp-btn">
          📱 Get Booking Details on WhatsApp
        </a>
      </div>
    </body>
    </html>
  `);
});

// Payment failure page
app.get('/payment-failure', (req, res) => {
  const { error_description, error_code, error_reason } = req.query;
  
  console.log(`❌ Payment failure page accessed`);
  console.log(`Error: ${error_description}, Code: ${error_code}, Reason: ${error_reason}`);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Failed - FocusPod</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          text-align: center; 
          padding: 20px; 
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .failure-box {
          background: white;
          padding: 40px 30px;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 90%;
        }
        .failure-icon {
          font-size: 64px;
          color: #dc3545;
          margin-bottom: 20px;
        }
        h1 {
          color: #dc3545;
          margin-bottom: 10px;
          font-size: 28px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .whatsapp-btn {
          background: #25D366;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 50px;
          display: inline-block;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        .whatsapp-btn:hover {
          background: #20ba5a;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(37, 211, 102, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="failure-box">
        <div class="failure-icon">❌</div>
        <h1>Payment Failed</h1>
        <p>Your payment could not be processed. Don't worry - no charges were made to your account.</p>
        
        ${error_description ? `
          <p style="font-size: 12px; color: #999;">
            Error: ${error_description}
          </p>
        ` : ''}
        
        <a href="https://wa.me/${process.env.PHONE_NUMBER_ID?.replace('whatsapp:', '') || '919036089111'}?text=Hi, I had a payment issue. Can you help me book a pod?" class="whatsapp-btn">
          📱 Get Help on WhatsApp
        </a>
      </div>
    </body>
    </html>
  `);
});

// ==========================================
// RAZORPAY INTEGRATION TEST
// ==========================================

// Test endpoint to check if Razorpay integration is working
app.get('/test-razorpay', async (req, res) => {
  try {
    const { createAndSendPaymentLink } = require('./razorpay-payments');
    
    res.json({
      status: 'Razorpay integration loaded successfully',
      timestamp: new Date().toISOString(),
      webhook_url: `${process.env.WEBHOOK_BASE_URL}/razorpay-webhook`,
      test_payment_available: true,
      keys_configured: {
        key_id: !!process.env.RAZORPAY_KEY_ID,
        secret: !!process.env.RAZORPAY_SECRET
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'Razorpay integration error',
      error: error.message,
      suggestion: 'Make sure razorpay-payments.js file exists and Razorpay package is installed'
    });
  }
});

// ==========================================
// CATCH-ALL 404 HANDLER
// ==========================================

// Add this AFTER all other routes to catch unmatched requests
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log(`Headers:`, req.headers);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /health',
      'GET /test', 
      'GET /webhook (verification)',
      'POST /webhook (WhatsApp messages)',
      'POST /razorpay-webhook',
      'POST /test-webhook',
      'GET /debug-payments',
      'GET /payment-success',
      'GET /payment-failure'
    ]
  });
});

// ==========================================
// ENHANCED SERVER STARTUP
// ==========================================

// Check TTLock token before starting server
const { checkTokenOnStartup } = require('./ttlock-token-checker');

// Start server with enhanced logging
async function startServer() {
  // Check and refresh TTLock token if needed on startup
  await checkTokenOnStartup();

  // Set up periodic token check (every 10 days)
  // This will auto-refresh the token when it's 79+ days old (11 days before 90-day expiry)
  const TOKEN_CHECK_INTERVAL = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds

  setInterval(async () => {
    console.log('\n🔄 Running scheduled TTLock token check...');
    try {
      await checkTokenOnStartup();
    } catch (error) {
      console.error('❌ Error during scheduled token check:', error);
    }
  }, TOKEN_CHECK_INTERVAL);

  console.log('⏰ Scheduled token check every 10 days (auto-refresh when >79 days old)');

  app.listen(PORT, () => {
  console.log(`🚀 FocusPod WhatsApp Bot running on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`💳 Razorpay Webhook: ${process.env.WEBHOOK_BASE_URL}/razorpay-webhook`);
  console.log(`✅ Payment Success: ${process.env.WEBHOOK_BASE_URL}/payment-success`);
  console.log(`❌ Payment Failure: ${process.env.WEBHOOK_BASE_URL}/payment-failure`);
  console.log(`🏥 Health check: ${process.env.WEBHOOK_BASE_URL}/health`);
  console.log(`🧪 Test endpoint: ${process.env.WEBHOOK_BASE_URL}/test`);
  console.log(`🔧 Test webhook: ${process.env.WEBHOOK_BASE_URL}/test-webhook`);
  console.log(`🛠 Debug payments: ${process.env.WEBHOOK_BASE_URL}/debug-payments`);
  console.log('\n📋 Available endpoints:');
  console.log('- GET  /health');
  console.log('- GET  /test');
  console.log('- POST /webhook (WhatsApp)');
  console.log('- POST /razorpay-webhook (Razorpay)');
  console.log('- POST /test-webhook (Testing)');
  console.log('- GET  /debug-payments (Debug)');
  console.log('- GET  /payment-success (Redirect)');
  console.log('- GET  /payment-failure (Redirect)');
  console.log('\n🔍 Testing commands:');
  console.log(`curl ${process.env.WEBHOOK_BASE_URL}/test`);
  console.log(`curl -X POST ${process.env.WEBHOOK_BASE_URL}/test-webhook -H "Content-Type: application/json" -d '{"test":"hello"}'`);
  console.log(`curl -X POST ${process.env.WEBHOOK_BASE_URL}/razorpay-webhook -H "Content-Type: application/json" -d '{"event":"test","payload":{}}'`);
  console.log('');
  
  // Check environment setup
  const requiredEnvVars = ['WHATSAPP_TOKEN', 'PHONE_NUMBER_ID', 'WEBHOOK_BASE_URL', 'RAZORPAY_KEY_ID', 'RAZORPAY_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('⚠️  Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('');
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  console.log('🎯 Ready to receive WhatsApp messages!');
  });
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});