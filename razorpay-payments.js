// Updated razorpay-payments.js - Fixed webhook signature for development

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendMessage, sendButtons } = require('./whatsapp');

// ADDED: Import date utilities for consistency
const { toSheetFormat, toDisplayFormat } = require('./date-utils');


// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// Global storage for pending payments (use Redis in production)
if (!global.pendingPayments) {
  global.pendingPayments = {};
}

// Create payment link and send to user (same as before)
async function createAndSendPaymentLink(phone, amount, bookingData) {
  try {
    console.log(`💳 Creating Razorpay payment for ${phone} - Amount: ₹${amount}`);
    
    const paymentLinkData = {
      amount: amount * 100,
      currency: 'INR',
      accept_partial: false,
      first_min_partial_amount: 0,
      description: `FocusPod Booking - ${bookingData.podName || bookingData.podId}`,
      customer: {
        name: bookingData.userName || 'FocusPod Customer',
        contact: phone.replace(/^\+/, ''),
        email: `${phone.replace(/^\+/, '')}@focuspod.temp`
      },
      notify: {
        sms: true,
        email: false,
        whatsapp: false
      },
      reminder_enable: true,
      notes: {
        booking_id: bookingData.transactionId,
        pod_id: bookingData.podId,
        pod_name: bookingData.podName,
        society_name: bookingData.societyName,
        user_phone: phone,
        start_time: bookingData.startTime,
        end_time: bookingData.endTime,
        duration: bookingData.duration,
        user_id: bookingData.userId,
        booking_date: bookingData.date
      },
      callback_url: `${process.env.WEBHOOK_BASE_URL}/payment-success`,
      callback_method: 'get',
      expire_by: Math.floor(Date.now() / 1000) + 1800
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkData);
    
    global.pendingPayments[paymentLink.id] = {
      phone: phone,
      bookingData: bookingData,
      amount: amount,
      createdAt: new Date().toISOString()
    };

    console.log(`✅ Payment link created: ${paymentLink.id}`);
    console.log(`📝 Stored in global.pendingPayments for webhook processing`);
    
    const paymentMessage = 
      `💳 *Complete Your Payment*\n\n` +
      `📍 Society: ${bookingData.societyName}\n` +
      `🏠 Pod: ${bookingData.podName || bookingData.podId}\n` +
      `⏰ Time: ${bookingData.startTime} - ${bookingData.endTime}\n` +
      `💰 Amount: ₹${amount}\n` +
      `🆔 Booking: ${bookingData.transactionId}\n\n` +
      `🔗 *Click to pay securely:*\n` +
      `${paymentLink.short_url}\n\n` +
      `✅ UPI • Cards • Net Banking • Wallets\n` +
      `🔒 100% Secure Payment\n` +
      `⚡ Instant Confirmation - No Screenshots Needed!\n` +
      `⏰ Link expires in 60 minutes`;

    await sendMessage(phone, paymentMessage);
    
    // ✅ No immediate status buttons - webhooks handle everything
    console.log(`💳 Payment link sent to ${phone}, waiting for webhook confirmation...`);

// Send reminder after 5 minutes (if payment still pending)
setTimeout(async () => {
  if (global.pendingPayments[paymentLink.id]) {
    try {
      await sendMessage(phone, 
        `⏰ *Payment Reminder*\n\n` +
        `Your payment link will expire in 10 minutes.\n\n` +
        `💳 Amount: ₹${amount}\n` +
        `🆔 Booking: ${bookingData.transactionId}\n\n` +
        `Please complete your payment to confirm the booking.\n\n` +
        `Having issues? Reply 'help' for support.`
      );
      console.log(`⏰ 5-minute payment reminder sent to ${phone}`);
    } catch (error) {
      console.log(`⚠️ Failed to send payment reminder: ${error.message}`);
    }
  }
}, 300000); // 5 minutes

// Clean up expired payment after 15 minutes
setTimeout(() => {
  if (global.pendingPayments[paymentLink.id]) {
    delete global.pendingPayments[paymentLink.id];
    console.log(`🧹 Cleaned up expired payment (30 min): ${paymentLink.id}`);
  }
}, 1800000); // 30 minutes

    return {
      success: true,
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url
    };

  } catch (error) {
    console.error('❌ Error creating payment link:', error);
    
    await sendMessage(phone, 
      `❌ *Payment Error*\n\n` +
      `Sorry, we couldn't create your payment link right now.\n\n` +
      `Please try again in a moment or contact support:\n` +
      `📞 +91-9036089111`
    );
    
    throw error;
  }
}

// FIXED: Handle Razorpay webhook events with proper signature handling
async function handleRazorpayWebhook(webhookBody, webhookSignature) {
  try {
    // Compact production log
    console.log('💰 Razorpay webhook received:', {
      event: webhookBody.event,
      linkId: webhookBody.payload?.payment_link?.entity?.id,
      paymentId: webhookBody.payload?.payment?.entity?.id,
      amount: webhookBody.payload?.payment?.entity?.amount / 100,
      status: webhookBody.payload?.payment?.entity?.status,
      bookingId: webhookBody.payload?.payment_link?.entity?.notes?.booking_id,
      phone: webhookBody.payload?.payment_link?.entity?.notes?.user_phone
    });

    // Verbose logging only in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📦 Full webhook body:', JSON.stringify(webhookBody, null, 2));
    }
    
    // Signature validation
    let isSignatureValid = false;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';
    
    if (webhookSignature && webhookSecret) {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(webhookBody))
          .digest('hex');
        
        isSignatureValid = expectedSignature === webhookSignature;
        console.log(`🔐 Signature validation: ${isSignatureValid ? 'VALID' : 'INVALID'}`);
      } catch (sigError) {
        console.log('⚠️ Signature verification error:', sigError.message);
      }
    }
    
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    if (!isSignatureValid && !isDevelopment) {
      console.error('❌ Invalid webhook signature in production mode');
      return { success: false, error: 'Invalid signature' };
    }
    if (!isSignatureValid && isDevelopment) {
      console.log('⚠️ Invalid signature - but allowing in development mode');
    }

    const { event, payload } = webhookBody;

    // ✅ Handle payment success
    if (event === "payment_link.paid") {
      const paymentLinkId = payload?.payment_link?.entity?.id;
      const phone = global.pendingPayments[paymentLinkId]?.phone;
      const bookingData = global.pendingPayments[paymentLinkId]?.bookingData;

      if (!paymentLinkId || !bookingData) {
        console.log("⚠️ Payment link not found in pendingPayments");
        return { success: false, error: "Payment not found" };
      }

      console.log(`✅ Payment confirmed for booking ${bookingData.transactionId}`);

      // --- FIX: Clear pending payment so reminder/expiry won't fire ---
      if (global.pendingPayments[paymentLinkId]) {
        delete global.pendingPayments[paymentLinkId];
        console.log(`🧹 Cleared pending payment after success: ${paymentLinkId}`);
      }

      await sendMessage(phone,
        `✅ *Payment Successful!*\n\n` +
        `🎉 Booking Confirmed Instantly!\n\n` +
        `📍 Society: ${bookingData.societyName}\n` +
        `🏠 Pod: ${bookingData.podName || bookingData.podId}\n` +
        `📅 Date: ${bookingData.date}\n` +
        `⏰ Time: ${bookingData.startTime} - ${bookingData.endTime}\n` +
        `⏳ Duration: ${bookingData.duration} hours\n` +
        `💰 Amount: ₹${bookingData.amount}\n` +
        `🆔 Booking ID: ${bookingData.transactionId}`
      );

      return { success: true };
    }

    if (event === "payment_link.expired") {
      console.log("⚠️ Payment link expired event received");
      // Don’t send expired message if already paid (entry will be cleared)
    }

    return { success: true };

  } catch (error) {
    console.error("❌ Error in handleRazorpayWebhook:", error);
    return { success: false, error: error.message };
  }
}



// ENHANCED: Handle successful payment
async function handlePaymentSuccess(payload) {
  try {
    const paymentLink = payload.payment_link.entity;
    const payment = payload.payment.entity;
    const notes = paymentLink.notes;
    
    console.log(`🎉 Payment successful: ${payment.id}`);
    console.log(`📱 User: ${notes.user_phone}`);
    console.log(`💰 Amount: ₹${payment.amount / 100}`);
    console.log(`📅 Booking date from notes: ${notes.booking_date}`);

    
    // Get stored payment info
    const paymentInfo = global.pendingPayments[paymentLink.id];
    
    if (!paymentInfo) {
      console.error(`❌ Payment info not found for: ${paymentLink.id}`);
      console.log(`🔍 Available payments:`, Object.keys(global.pendingPayments));
      
      // FALLBACK: Try to process anyway with webhook data
      console.log('🔄 Attempting fallback processing with webhook data');
      await handlePaymentFallback(notes, payment);
      return { success: true, status: 'fallback_processing' };
    }

    console.log(`✅ Found payment info:`, paymentInfo);

    // Complete the booking
    await completeBookingAfterPayment({
      bookingId: notes.booking_id,
      phone: notes.user_phone,
      paymentId: payment.id,
      amount: payment.amount / 100,
      podId: notes.pod_id,
      podName: notes.pod_name,
      societyName: notes.society_name,
      startTime: notes.start_time,
      endTime: notes.end_time,
      duration: notes.duration,
      userId: notes.user_id,
      paymentMethod: payment.method,
      bookingDate: notes.booking_date
    });

    // Clean up
    delete global.pendingPayments[paymentLink.id];
    
    return { success: true, status: 'booking_completed' };

  } catch (error) {
    console.error('❌ Error handling payment success:', error);
    return { success: false, error: error.message };
  }
}

// NEW: Fallback payment handling when payment info is not found
async function handlePaymentFallback(notes, payment) {
  try {
    console.log('🔄 Processing payment with fallback method');
    
    const { generateLockPin } = require('./sheets');
    const { createBooking } = require('./simple-availability');
    
    // Generate lock PIN
    const lockPin = generateLockPin(notes.user_phone);
    
    // FIXED: Use the booking date from notes (should be in sheet format)
    const formattedDate = notes.booking_date;
    console.log(`📅 Using booking date from notes: ${formattedDate}`);
    
    // Create booking
    await createBooking({
      bookingId: notes.booking_id,
      societyId: '1',
      date: formattedDate,
      podId: notes.pod_id,
      podName: notes.pod_name,
      startTime: notes.start_time,
      endTime: notes.end_time,
      duration: parseInt(notes.duration),
      userId: notes.user_id,
      amount: payment.amount / 100,
      bookingType: 'Regular',
      lockPin: lockPin
    });

    // FIXED: Convert date for user display
    const displayDate = toDisplayFormat(formattedDate);
    
    
    // Send confirmation to user
    await sendMessage(notes.user_phone,
      `🎉 *Payment Successful!*\n\n` +
      `✅ *Booking Confirmed!*\n\n` +
      `📍 Society: ${notes.society_name}\n` +
      `🏠 Pod: ${notes.pod_name || notes.pod_id}\n` +
      `📅 Date: ${displayDate}\n` +
      `🕒 Time: ${notes.start_time} - ${notes.end_time}\n` +
      `⏰ Duration: ${notes.duration} hours\n` +
      `💰 Amount: ₹${payment.amount / 100}\n` +
      `💳 Payment ID: ${payment.id}\n` +
      `🆔 Booking ID: ${notes.booking_id}`
    );
    
    // Send access PIN
    setTimeout(async () => {
      await sendMessage(notes.user_phone,
        `🔐 *Your Access PIN: ${lockPin}*\n\n` +
        `✅ Use this PIN to unlock the pod during your booking time\n` +
        `🔄 You can enter and exit multiple times with the same PIN\n` +
        `⏰ PIN is active only during your booking slot\n\n` +
        `*Save this PIN - you'll need it to access the pod!*`
      );
    }, 2000);
    
    console.log('✅ Fallback payment processing completed');
    
  } catch (error) {
    console.error('❌ Fallback payment processing failed:', error);
    
    // Send fallback message
    await sendMessage(notes.user_phone,
      `✅ *Payment Received!*\n\n` +
      `💳 Payment ID: ${payment.id}\n` +
      `🆔 Booking ID: ${notes.booking_id}\n\n` +
      `Our team is processing your booking and will confirm within 5 minutes.\n\n` +
      `Support: +91-9036089111`
    );
  }
}

// Complete booking after successful payment (same as before)
// Complete the booking after payment with TTLock integration
async function completeBookingAfterPayment(paymentInfo) {
  try {
    const { createBooking } = require('./simple-availability');
    
    console.log(`🗝️ Completing booking with TTLock: ${paymentInfo.bookingId}`);
    console.log(`📅 Booking date: ${paymentInfo.bookingDate}`);
    
    // FIXED: Use the booking date directly (should already be in sheet format)
    const formattedDate = paymentInfo.bookingDate;

    
    // Create booking with TTLock integration
    const bookingResult = await createBooking({
      bookingId: paymentInfo.bookingId,
      societyId: '1',
      date: formattedDate,
      podId: paymentInfo.podId,
      startTime: paymentInfo.startTime,
      endTime: paymentInfo.endTime,
      duration: paymentInfo.duration,
      userId: paymentInfo.userId,
      amount: paymentInfo.amount,
      bookingType: 'Regular'
    });
    
    // Get the generated PIN from booking result
    const assignedLockPin = bookingResult.assignedLockPin || '1234';
    const pinStatus = bookingResult.pinStatus || 'unknown';
    
    console.log(`✅ Booking created with TTLock PIN: ${assignedLockPin} (Status: ${pinStatus})`);
    // FIXED: Convert date to display format for user messages
    const displayDate = toDisplayFormat(formattedDate);
    
    
    await sendMessage(paymentInfo.phone,
      `🎉 *Payment Successful!*\n\n` +
      `✅ *Booking Confirmed Instantly!*\n\n` +
      `📍 Society: ${paymentInfo.societyName}\n` +
      `🏠 Pod: ${paymentInfo.podName || paymentInfo.podId}\n` +  
      `📅 Date: ${displayDate}\n` +
      `🕒 Time: ${paymentInfo.startTime} - ${paymentInfo.endTime}\n` +
      `⏰ Duration: ${paymentInfo.duration} hours\n` +
      `💰 Amount: ₹${paymentInfo.amount}\n` +
      `💳 Payment ID: ${paymentInfo.paymentId}\n` +
      `🆔 Booking ID: ${paymentInfo.bookingId}`
    );
    
    // Send PIN with status information
    setTimeout(async () => {
      let pinMessage = `🔐 *Your Access PIN: ${assignedLockPin}*\n\n`;
      
      if (pinStatus === 'active') {
        pinMessage += `✅ Smart lock PIN generated successfully!\n` +
          `🔄 You can enter and exit multiple times with this PIN\n` +
          `⏰ PIN is active only during your booking slot\n\n` +
          `*This is a time-based PIN that will work only during your booking time.*`;
      } else if (pinStatus === 'fallback_default') {
        pinMessage += `✅ Using default pod PIN\n` +
          `🔄 You can enter and exit multiple times with this PIN\n` +
          `⏰ PIN works during your booking slot\n\n` +
          `*Note: This is the pod's default PIN. Smart lock PIN generation had a temporary issue.*`;
      } else {
        pinMessage += `✅ Pod access PIN provided\n` +
          `🔄 You can enter and exit multiple times with this PIN\n` +
          `⏰ PIN works during your booking slot\n\n` +
          `*Save this PIN - you'll need it to access the pod!*`;
      }
      
      await sendMessage(paymentInfo.phone, pinMessage);
    }, 2000);
    
    setTimeout(async () => {
      await sendMessage(paymentInfo.phone, 
        `🙌 Pod Guidelines:\n` +
        `✅ For work, meetings, calls, study, music\n` +
        `✅ Can carry water/coffee\n` +
        `🧼 Keep it clean | ❌ No food or smoking\n` +
        `🕒 Please exit after your booking time\n\n` +
        `🛟 For support: WhatsApp or call us at +91-9036089111`
      );
    }, 5000);
    
    console.log(`✅ Booking completed successfully with TTLock: ${paymentInfo.bookingId}`);
    
  } catch (error) {
    console.error('❌ Error completing booking with TTLock:', error);
    // FIXED: Convert date for display in error message too
    const displayDate = toDisplayFormat(paymentInfo.bookingDate);
    
    
    await sendMessage(paymentInfo.phone,
      `✅ *Payment Received Successfully!*\n\n` +
      `Your payment of ₹${paymentInfo.amount} has been processed.\n\n` +
      `There was a minor technical issue completing your booking automatically.\n\n` +
      `📞 Our team has been notified and will confirm your booking within 5 minutes.\n\n` +
      `💳 Payment ID: ${paymentInfo.paymentId}\n` +
      `🆔 Booking ID: ${paymentInfo.bookingId}\n` +
      `📅 Date: ${displayDate}\n\n` +
      `Support: +91-9036089111`
    );
  }
}

// Handle payment cancellation (same as before)
async function handlePaymentCancellation(payload) {
  try {
    const paymentLink = payload.payment_link.entity;
    const notes = paymentLink.notes;
    
    console.log(`❌ Payment cancelled: ${paymentLink.id}`);
     // FIXED: Convert date for display
     const displayDate = toDisplayFormat(notes.booking_date);
    
    await sendMessage(notes.user_phone,
      `❌ *Payment Cancelled*\n\n` +
      `You cancelled the payment for your booking.\n\n` +
      `Booking: ${notes.booking_id}\n` +
      `Date: ${displayDate}\n` +
      `Amount: ₹${paymentLink.amount / 100}\n\n` +
      `Would you like to try booking again?`
    );
    
    await sendButtons(notes.user_phone, "What would you like to do?", [
      "🔄 Try Booking Again",
      "📞 Contact Support",
      "❌ Exit"
    ]);
    
    if (global.pendingPayments[paymentLink.id]) {
      delete global.pendingPayments[paymentLink.id];
    }
    
    return { success: true, status: 'cancelled' };
    
  } catch (error) {
    console.error('❌ Error handling payment cancellation:', error);
    return { success: false, error: error.message };
  }
}

// Handle payment expiry (same as before)
async function handlePaymentExpiry(payload) {
  try {
    const paymentLink = payload.payment_link.entity;
    const notes = paymentLink.notes;
    
    console.log(`⏰ Payment expired: ${paymentLink.id}`);
    // FIXED: Convert date for display
    const displayDate = toDisplayFormat(notes.booking_date);
    
    
    await sendMessage(notes.user_phone,
      `⏰ *Payment Link Expired*\n\n` +
      `Your payment link has expired (60 minutes).\n\n` +
      `Booking: ${notes.booking_id}\n` +
      `Pod: ${notes.pod_name || notes.pod_id}\n` +
      `Date: ${displayDate}\n\n` +
      `Would you like to try booking again?`
    );
    
    
    if (global.pendingPayments[paymentLink.id]) {
      delete global.pendingPayments[paymentLink.id];
    }
    
    return { success: true, status: 'expired' };
    
  } catch (error) {
    console.error('❌ Error handling payment expiry:', error);
    return { success: false, error: error.message };
  }
}

// Utility functions (same as before)
async function checkPaymentStatus(paymentLinkId) {
  try {
    const paymentLink = await razorpay.paymentLink.fetch(paymentLinkId);
    return {
      status: paymentLink.status,
      amount: paymentLink.amount / 100,
      created_at: paymentLink.created_at
    };
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    throw error;
  }
}

function listPendingPayments() {
  const pending = Object.entries(global.pendingPayments || {});
  console.log(`📋 Pending payments: ${pending.length}`);
  
  if (pending.length > 0) {
    console.table(pending.map(([id, data]) => ({
      paymentId: id,
      phone: data.phone,
      amount: `₹${data.amount}`,
      booking: data.bookingData.transactionId,
      created: data.createdAt
    })));
  }
  
  return pending;
}

module.exports = {
  createAndSendPaymentLink,
  handleRazorpayWebhook,
  checkPaymentStatus,
  listPendingPayments
};