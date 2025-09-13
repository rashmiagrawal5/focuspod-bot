// messages.js - Organized in User Journey Sequence

const MESSAGES = {
  // ==========================================
  // 1. WELCOME & INITIAL CONTACT (Step A1)
  // ==========================================
  
  // Welcome messages for different user types
  WELCOME_NEW_USER: "Hi! 👋 Welcome to FocusPod. Since you're booking for the first time, your first booking is FREE 🎉",

  FIRST_BOOKING_2HR_FREE: "Your first booking is FREE for 2 hours! Longer durations are paid.",
  WELCOME_EXISTING_FIRST_TIME: (name) => `Hi ${name}! 👋 Welcome back to FocusPod. Since you're booking for the first time, your first booking is FREE 🎉`,
  WELCOME_RETURNING_USER: (name) => `Hi ${name}! 👋 Ready to book?`,
  
  // Action selection
  WHAT_WOULD_YOU_LIKE: "What would you like to do?",
  
  // ==========================================
  // 2. NAME COLLECTION
  // ==========================================
  
  NAME_REQUEST: "Please share your *name* to get started. 📝",
  NAME_INVALID: "Please enter a valid name (at least 2 characters). 📝",
  NAME_THANK_YOU: (name) => `Thanks ${name}! You're all set! 🎉\n\nLet's continue with your booking.`,
  
  // ==========================================
  // 3. BOOKING START
  // ==========================================
  
  LETS_BOOK_POD: (name) => `Hi ${name}! Let's book a quiet pod in your society. 🏢`,
  
  // ==========================================
  // 4. SOCIETY SELECTION
  // ==========================================
  
  SOCIETY_DETECTED: (societyName) => `Perfect! I've detected you're from ${societyName}. 🎉`,
  SOCIETY_AUTO_ASSIGNED: (societyName) => `Great! I've set your society as ${societyName}. 🎉`,
  SOCIETY_ALREADY_SET: (societyName) => `Great! I see you're from ${societyName}.`,
  SOCIETY_SELECTED: (societyName) => `Perfect! You've selected ${societyName}. 🎉`,
  
  SELECT_SOCIETY: "🏘️ *Please select your residential society:*",
  SOCIETY_CHOOSE_PROMPT: "Choose the one you belong to:",
  OTHER_SOCIETY_HELP: "Please tell me the name of your society, and our team will assist you with the booking. 🏢",
  
  // ==========================================
  // 5. DATE SELECTION
  // ==========================================
  
  SELECT_DATE: "📅 *Select your preferred day:*",
  DATE_CHOOSE_PROMPT: "Choose the day you'd like to book:",
  DATE_OTHER_OPTION: "Or if you need a different date:",
  DATE_SELECTED: (date) => `Great! You've selected ${date}. 📅\nNow let's choose your booking duration.`,
  
  // ==========================================
  // 6. DURATION SELECTION
  // ==========================================
  
  SELECT_DURATION: "⏰ *Choose your booking duration:*",
  DURATION_CHOOSE_PROMPT: "Select the duration that works for you:",
  DURATION_HELP_PROMPT: "Need help deciding?",
  DURATION_SELECTED: (duration, price) => `Perfect! You've selected ${duration} hours for ₹${price}. ⏰\nNow let me find available slots for you...`,
  
  // Dynamic duration button creation
  DURATION_BUTTON: (hours, price) => `${hours}hr — ₹${price}`,
  
  // ==========================================
  // 7. SLOT AVAILABILITY & SELECTION
  // ==========================================
  
  AVAILABLE_SLOTS: (duration) => `🕒 Here are the available slots for *${duration} hour* booking:`,
  DOWNGRADED_SLOTS: (requestedDuration, actualDuration) => `⚠️ No ${requestedDuration}-hour slots are available.\n\nBut we found *${actualDuration}-hour* options for you:`,
  SELECT_TIME_SLOT: "Select your preferred time slot:",
  MORE_SLOTS: "More slots:",
  NO_MORE_SLOTS: "No more slots available. Please select from the options shown above.",
  NEED_MORE_OPTIONS: "Need more options?",
  STILL_MORE_OPTIONS: "Still need more options?",
  ALL_BOOKED: "😞 All pods are fully booked for this day.\n\nWould you like to:\n• Try another date\n• Talk to our team",
  
  // ==========================================
  // 8. BOOKING CONFIRMATION (Free vs Paid)
  // ==========================================
  
  // Free booking (first time)
  FREE_BOOKING_SUCCESS: (societyName, podId, date, timeSlot, duration, bookingId) => 
  `🎉 *FREE Booking Confirmed!*\n\n📍 ${societyName}\n🏠 ${podId}\n📅 ${date}\n🕒 ${timeSlot}\n⏰ ${duration} hours`,

  // Paid booking summary
  PAID_BOOKING_SUMMARY: (societyName, podId, date, timeSlot, duration, price, bookingId) =>
  `✅ *Booking Summary*\n\n📍 ${societyName}\n🏠 ${podId}\n📅 ${date}\n🕒 ${timeSlot}\n⏰ ${duration}hrs\n💰 ₹${price}`,
  
  READY_TO_COMPLETE: "Ready to complete your booking?",
  
  // ==========================================
  // 9. PAYMENT PROCESSING
  // ==========================================
  
  // Payment link creation
  PAYMENT_LINK_CREATING: "🔄 Creating payment link...",

  // Payment link sent (SHORTENED - no variables)
  PAYMENT_LINK_SUCCESS: "💳 *Payment Link Sent!*\n\n🔗 Click to pay securely\n⚡ You'll get automatic confirmation within 30 seconds after payment!",
  
  PAYMENT_LINK_FAILED: "❌ Payment link failed. Try again or call: 📞 +919318323127",
  
  PAYMENT_PROCESSING: (amount) => `💳 Processing payment of ₹${amount}...\n\nPlease wait while we confirm your payment.`,
  
  PAYMENT_STATUS_CHECK: "✅ Payment received! Confirmation coming in 1-2 minutes.\n\nNo confirmation? Call: 📞 +919318323127",

PAYMENT_SUCCESS_AUTO: "✅ Payment successful! Check messages above for confirmation.\n\nNeed help? Call: 📞 +919318323127",
  
  // Payment issues and help
  PAYMENT_ISSUE: "❌ Payment issue.\n\nNo amount is charged if payment failed.\n\nWould you like to:",
  
  PAYMENT_HELP: "Need help?\n\n1. Try payment link again\n2. Use different payment method\n3. Call: +919318323127",

PAYMENT_SUPPORT_DETAILED: "🆘 *Payment Help*\n\nTry:\n• Different browser\n• Different UPI app\n• Debit/Credit card\n\nCall: +919318323127",

PAYMENT_STATUS_WAITING: "⏳ Waiting for payment...\n\nCompleted? Wait 1-2 mins.\nNeed help? Call: +919318323127",

PAYMENT_TECHNICAL_ERROR: "❌ Technical error. Try again or call: 📞 +919318323127",

  // Payment reminder and status messages
  PAYMENT_REMINDER: (amount, transactionId) => 
    `⏰ *Payment link will expire soon*\n`,
  
  PAYMENT_RECEIVED_MANUAL: `✅ *Payment Received!* Your booking couldn't auto-complete. Our team will confirm within 5 minutes.\n\nSupport: +919318323127`,
  
  
  PAYMENT_CANCELLED_MESSAGE: (bookingId, date, amount) =>
    `❌ *Payment Cancelled*\nBooking: ${bookingId}\nDate: ${date}\nAmount: ₹${amount}`,
  
  PAYMENT_EXPIRED_MESSAGE: (bookingId, podName, date) =>
    `⏰ *Payment Link Expired*\nBooking: ${bookingId}\nPod: ${podName}\nDate: ${date}`,
  
  PAYMENT_ERROR_RETRY: `❌ *Payment Error* – Please try again or contact support 📞 +919318323127`,

  PAYMENT_BOOKING_CONFIRMED: (societyName, podName, displayDate, startTime, endTime, amount, paymentId, bookingId) =>
    `✅ *Booking Confirmed!*\n\n` +
    `🏢 ${societyName}\n🏠 ${podName}\n` +
    `📅 ${displayDate}\n🕒 ${startTime} - ${endTime}\n` +
    `💰 ₹${amount}\n🆔 Booking: ${bookingId}`,
  
  LOCK_PIN_ACTIVE: (pin) => 
    `🔐 *Your Access PIN: ${pin}*\n\nYou can enter and exit multiple times during your booking slot using this PIN.`,
  
  LOCK_PIN_DEFAULT: (pin) =>
    `🔐 *Your Access PIN: ${pin}*\n\n✅ Pod PIN active during your booking slot.`,
  
  // ==========================================
  // 10. BOOKING COMPLETION & SUCCESS
  // ==========================================
  
  // Payment successful (REMOVED booking ID as requested)
  PAYMENT_SUCCESSFUL: (societyName, podId, date, timeSlot, duration, amount) =>
    `🎉 *Payment Successful!*\n\n📍 Society: ${societyName}\n🏠 Pod: ${podId}\n📅 Date: ${date}\n🕒 Time: ${timeSlot}\n⏰ Duration: ${duration} hours\n💰 Amount Paid: ₹${amount}\n\nYour pod is confirmed! 🎊`,
  
  ACCESS_PIN: (pin) => `🔑 Your access PIN: *${pin}*\n\nYou can enter and exit multiple times during your booking slot using this PIN.`,
  
  BOOKING_COMPLETE_THANK_YOU: "Thank you for booking with FocusPod! 🎉\n\nEnjoy your focused work session!",
  
  BOOKING_COMPLETE_GUIDELINES: "🙌 Pod Guidelines:\n✅ For work, calls, study\n✅ Water/coffee allowed\n🧼 Keep clean | ❌ No food\n🕒 Exit after your booking\n\n🛟 Support: Call +919318323127",

  BOOKING_ALREADY_CONFIRMED: "🎉 *Your booking is already confirmed!*\n\nIf you need help or want to make another booking, please let us know!\n\nType \"new booking\" to start fresh or \"help\" for assistance.",
  
  BOOKING_CANCELLED: "Your booking has been cancelled. No charges applied.\n\nWould you like to try booking again?",
  
  // ==========================================
  // 11. QUESTIONS & SUPPORT
  // ==========================================
  
  QUESTION_PROMPT: "🤖 No problem! Our team is here to help.\n\nPlease call or WhatsApp us directly:\n📞 +919318323127\n\n⏰ Available: 9 AM - 9 PM daily",
  
  TEAM_SUPPORT_DATE: "No worries! Our team will help you find the perfect booking date.\n\nPlease call or WhatsApp us:\n📞 +919318323127\n⏰ Available: 9 AM - 9 PM daily",
  TEAM_SUPPORT_DURATION: "No worries! Our team will help you find the perfect booking duration.\n\nPlease call or WhatsApp us:\n📞 +919318323127\n⏰ Available: 9 AM - 9 PM daily",
  CONTACT_SUPPORT_DETAILS: "📞 *Contact Support*\n\nNeed immediate help?\n\n📞 *Call or WhatsApp:* +919318323127\n⏰ Available: 9 AM - 9 PM daily\n\nWe're here to help! 😊",
  MEDIA_REDIRECT_SUPPORT: "📷 To share images or documents, please WhatsApp them directly to our support team:\n\n📞 *WhatsApp:* +919318323127\n⏰ Available: 9 AM - 9 PM daily\n\nThey'll assist you immediately! 😊",
  // ==========================================
  // 12. ERROR MESSAGES
  // ==========================================
  ERROR_WEBHOOK_PROCESSING: "Sorry, something went wrong. Please try again.",

  ERROR_GENERAL: "Sorry, something went wrong. Please try again.",
  ERROR_AVAILABILITY: "Sorry, there was an error checking availability. Please try again.",
  ERROR_BOOKING_PREFERENCES: "Sorry, I couldn't find your booking preferences. Let's start the booking process again.",
  ERROR_SOCIETY_INFO: "Sorry, I couldn't find your society information. Please start again.",
  ERROR_SOCIETY_DETAILS: "Sorry, I couldn't find your society details. Please contact support.",
  ERROR_SLOT_UNDERSTANDING: "Sorry, I couldn't understand the time slot. Please try selecting again.",
  ERROR_SLOT_UNAVAILABLE: "Sorry, that slot is no longer available. Please select another slot.",
  ERROR_BOOKING_DETAILS: "Sorry, I couldn't find your booking details. Please start again.",
  ERROR_PAYMENT: "Sorry, there was an error processing your payment. Please try again.",
  ERROR_BOOKING_COMPLETION: "Payment was successful, but there was an error confirming your booking. Our team will contact you shortly.",
  ERROR_NO_SOCIETIES: "Sorry, no societies are currently available. Please contact support.",
  ERROR_SOCIETY_NOT_FOUND: "Sorry, I couldn't find that society. Please contact our support team for assistance.",
  ERROR_NAME_SAVE: "Sorry, there was an error saving your name. Please try again.",
  ERROR_SOCIETIES_LOAD: "Sorry, there was an error loading societies. Please try again.",
  ERROR_DATES_LOAD: "Sorry, there was an error loading dates. Please try again.",
  ERROR_DATE_PROCESS: "Sorry, there was an error processing your date selection. Please try again.",
  ERROR_DURATION_LOAD: "Sorry, there was an error loading duration options. Please try again.",
  ERROR_DURATION_PROCESS: "Sorry, there was an error processing your duration selection. Please try again.",
  ERROR_SLOT_CHOICE: "Sorry, there was an error processing your selection. Please try again.",
  ERROR_MORE_SLOTS: "Sorry, there was an error loading more slots. Please try again.",
  ERROR_NO_DISPLAY_SLOTS: "Sorry, no slots available for display. Please try a different date or duration.",
  ERROR_DIFFERENT_OPTIONS: "No more slots available. Please try a different date or duration.",
  ERROR_PRICING_LOAD: "Sorry, there was an error loading pricing. Using default rates."
};

const BUTTONS = {
  // Main Actions
  BOOK_POD: "📍 Book a Pod",
  ASK_QUESTION: "❓ Ask a Question",
  BOOK_AGAIN: "📍 Book Again",
  CALL_SUPPORT: "📞 Call Support",
  
  // Date Options
  OTHER_HUMAN_SUPPORT: "Other → Support",
  TRY_DIFFERENT_DATE: "Try Diff Date",
  TRY_DIFFERENT_DURATION: "Try Diff Duration",
  
  // Duration Options - Dynamic (generated from pricing)
  NOT_SURE_TEAM: "Not sure? Let's talk to the team 👥",
  
  // Slot Options
  SHOW_MORE_SLOTS: "🔄 Show More Slots",
  
  // Payment Options
  PAY_NOW: "💳 Pay Now",
  CANCEL_BOOKING: "❌ Cancel Booking",
  TRY_PAYMENT_AGAIN: "🔄 Try Payment Again",
  CONTACT_SUPPORT: "📞 Contact Support",
  PAYMENT_COMPLETE: "✅ Payment Complete",
  NEED_HELP: "❓ Need Help",
  
  // Alternative Options
  WAIT_TEAM_CALL: "📞 Wait for Team Call"
};

const USER_STATES = {
  INITIAL: 'initial',
  WAITING_FOR_ACTION: 'waiting_for_action',
  WAITING_FOR_NAME: 'waiting_for_name',
  WAITING_FOR_QUESTION: 'waiting_for_question',
  WAITING_FOR_SOCIETY: 'waiting_for_society',
  WAITING_FOR_DATE: 'waiting_for_date',
  WAITING_FOR_DURATION: 'waiting_for_duration',
  WAITING_FOR_SLOT: 'waiting_for_slot',
  WAITING_FOR_OTHER_DATE: 'waiting_for_other_date',
  WAITING_FOR_CUSTOM_SOCIETY: 'waiting_for_custom_society',
  WAITING_FOR_TEAM_CALL: 'waiting_for_team_call',
  READY_FOR_BOOKING: 'ready_for_booking',
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_PROCESSING: 'payment_processing',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_VERIFICATION: 'payment_verification',
  BOOKING_COMPLETED: 'booking_completed',
  CANCELLED: 'cancelled'
};

const IGNORE_WORDS = [
  // Acknowledgments
  'ok', 'okay', 'k', 'kk',
  
  // Thank you variations
  'thank you', 'thanks', 'thanku', 'ty', 'tq', 'thank u',
  'dhanyawad', 'shukriya', 'thanks a lot', 'thank you so much',
  
  // Positive feedback
  'great', 'awesome', 'excellent', 'perfect', 'good', 'nice',
  'great service', 'good service', 'excellent service', 'amazing',
  'wonderful', 'fantastic', 'superb', 'brilliant',
  
  // Confirmations
  'yes', 'yeah', 'yep', 'sure', 'alright', 'fine', 'cool',
  'got it', 'understood', 'noted', 'received',
  
  // Greetings that don't need response after completion
  'bye', 'goodbye', 'see you', 'take care', 'tc',
  
  // Common responses
  'done', 'completed', 'finished', 'all good', 'all set',
  
  // Emojis and symbols (common ones)
  '👍', '👌', '✅', '🙏', '😊', '😀', '🎉', '❤️', '💯'
];

// Function to check if message should be ignored
function shouldIgnoreMessage(message) {
  if (!message || typeof message !== 'string') return false;
  
  const lowerMessage = message.toLowerCase().trim();
  
  // Check exact matches and partial matches
  return IGNORE_WORDS.some(ignoreWord => {
    const lowerIgnoreWord = ignoreWord.toLowerCase();
    
    // Exact match
    if (lowerMessage === lowerIgnoreWord) return true;
    
    // For phrases, check if message contains the phrase
    if (ignoreWord.includes(' ') && lowerMessage.includes(lowerIgnoreWord)) return true;
    
    // For single words, check if it's a standalone word (not part of another word)
    if (!ignoreWord.includes(' ')) {
      const wordBoundary = new RegExp(`\\b${lowerIgnoreWord}\\b`);
      return wordBoundary.test(lowerMessage);
    }
    
    return false;
  });
}

module.exports = {
  MESSAGES,
  BUTTONS,
  USER_STATES,
  IGNORE_WORDS,
  shouldIgnoreMessage
};