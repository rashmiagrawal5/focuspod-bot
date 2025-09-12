const { sendMessage, sendButtons } = require("./whatsapp");
const { 
  getUserByPhone, 
  addNewUser, 
  updateUserName, 
  updateUserSociety, 
  getSocieties,
  updateFirstBookingStatus,
  generateTransactionId,
  generateLockPin,
  getPricing,              // NEW: Dynamic pricing
  getPriceForDuration,      // NEW: Dynamic pricing
  logSupportRequest,
  logError
} = require("./sheets");

// Import the simple availability system
const { 
  getAvailableSlots, 
  assignPodForSlot,
  formatDateForSheet
} = require("./simple-availability");

// Import createBooking from the original system
const { 
  createBooking 
} = require("./simple-availability");

// Import centralized messages
const { MESSAGES, BUTTONS, USER_STATES, shouldIgnoreMessage } = require("./messages");

// Import Razorpay payment system
const { createAndSendPaymentLink } = require('./razorpay-payments');

// ADDED: Import date utilities for consistency
const { 
  toSheetFormat, 
  toDisplayFormat,
  getTodaySheetFormat,
  getTomorrowSheetFormat,
  getDayAfterSheetFormat
} = require('./date-utils');


// Simple in-memory storage for user states (in production, use Redis or database)
const userStates = {};
const processingMessages = new Set(); // Prevent duplicate processing

async function handleUserMessage(phone, message) {

  console.log(`🔍 DEBUG: Received message "${message}" from ${phone}, current state: ${userStates[phone]?.step || 'undefined'}`)
  // Create unique message key to prevent duplicate processing
  const messageKey = `${phone}-${message}-${Date.now()}`;
  if (processingMessages.has(messageKey)) {
    console.log(`⚠️ Duplicate message ignored: ${message}`);
    return;
  }
  processingMessages.add(messageKey);
  
  // Clean up old processing keys after 30 seconds
  setTimeout(() => processingMessages.delete(messageKey), 30000);
  
  console.log(`🔄 Processing message from ${phone}: ${message}`);
  
  try {
    const user = await getUserByPhone(phone);
    const currentState = userStates[phone] || USER_STATES.INITIAL;
    
    console.log(`👤 User found:`, user);
    console.log(`🎯 Current state: ${currentState}`);

    // Handle different user states
    switch (currentState) {
      case USER_STATES.WAITING_FOR_NAME:
        await handleNameInput(phone, message);
        break;
              
      case USER_STATES.PAYMENT_PROCESSING:
        await handlePaymentProcessing(phone, message);
        break;
        
      case USER_STATES.BOOKING_COMPLETED:
      // User completed booking - check if we should ignore the message
  if (shouldIgnoreMessage(message)) {
    console.log(`🤫 Ignoring acknowledgment message: "${message}" from ${phone}`);
    return; // Don't respond to acknowledgments like "thank you", "ok", etc.
  }
  
  // Only respond to meaningful messages that indicate they want to interact
  console.log(`✅ User wants to restart conversation with: "${message}"`);
  await sendMessage(phone, MESSAGES.BOOKING_ALREADY_CONFIRMED);
  
  // Check if user wants new booking
  if (message.toLowerCase().includes('new booking') || 
      message.toLowerCase().includes('book again') ||
      message.toLowerCase().includes('book') ||
      message.toLowerCase().includes('hi') ||
      message.toLowerCase().includes('hello')) {
    userStates[phone] = { step: USER_STATES.INITIAL };
    await handleInitialMessage(phone, message, user);
  }
  return;
        
      case USER_STATES.CANCELLED:
        // User cancelled, allow restart
        await handleInitialMessage(phone, message, user);
        break;
        
      default:
        await handleInitialMessage(phone, message, user);
        break;
    }
    
  } catch (error) {
    console.error('❌ Error in handleUserMessage:', error);
    await sendMessage(phone, MESSAGES.ERROR_GENERAL);
  }
}

async function handleInitialMessage(phone, message, user) {
  // Check if message contains society info from QR code
  const societyFromQR = extractSocietyFromMessage(message);
  console.log(`🏢 Society from QR code: ${societyFromQR}`);
  
  if (!user) {
    // New user - create entry in database
    console.log('👶 New user detected, creating entry...');
    const userId = await addNewUser(phone);
    console.log(`✅ Created new user with ID: ${userId}`);
    
    // Store QR society info if available
    if (societyFromQR) {
      userStates[phone] = { step: USER_STATES.INITIAL, qrSociety: societyFromQR };
    }
    
    // Send welcome message for first-time user
    await sendMessage(phone, MESSAGES.WELCOME_NEW_USER);
    
    // Show action buttons
    await sendButtons(phone, MESSAGES.WHAT_WOULD_YOU_LIKE, [
      BUTTONS.BOOK_POD,
      BUTTONS.ASK_QUESTION
    ]);
    
    userStates[phone] = { step: USER_STATES.INITIAL };
    return;
  }
  
  // Store QR society info for existing users too
  if (societyFromQR) {
    userStates[phone] = { step: USER_STATES.INITIAL, qrSociety: societyFromQR };
  }
  
  // Existing user
  if (user.FirstBookingDone === 'No') {
    // First-time user (exists in DB but hasn't made first booking)
    const userName = user.Name || 'there';
    await sendMessage(phone, MESSAGES.WELCOME_EXISTING_FIRST_TIME(userName));
  } else {
    // Returning user
    const userName = user.Name || 'there';
    await sendMessage(phone, MESSAGES.WELCOME_RETURNING_USER(userName));
  }
  
  // Show action buttons for all existing users
  await sendButtons(phone, MESSAGES.WHAT_WOULD_YOU_LIKE, [
    BUTTONS.BOOK_POD, 
    BUTTONS.ASK_QUESTION
  ]);
  
  userStates[phone] = { step: USER_STATES.INITIAL };
}

// FIXED: handleNameInput function
async function handleNameInput(phone, name) {
  console.log(`📝 Name input from ${phone}: ${name}`);
  
  try {
    // Basic validation
    if (!name || name.trim().length < 2) {
      await sendMessage(phone, MESSAGES.NAME_INVALID);
      return;
    }
    
    // Update user name in database
    await updateUserName(phone, name.trim());
    console.log(`✅ Updated name for ${phone}: ${name}`);
    
    await sendMessage(phone, MESSAGES.NAME_THANK_YOU(name.trim()));
    
    // Continue to society selection
    await handleSocietySelection(phone);
    
  } catch (error) {
    console.error('❌ Error updating user name:', error);
    await sendMessage(phone, MESSAGES.ERROR_NAME_SAVE);
  }
}

// FIXED: handleSocietySelection function
async function handleSocietySelection(phone) {
  console.log(`🏢 Starting society selection for ${phone}`);
  
  try {
    const user = await getUserByPhone(phone);
    const userState = userStates[phone] || {};
    const qrSociety = userState.qrSociety;
    
    // Check if user already has a society assigned
    if (user && user.SocietyId && user.SocietyId.trim() !== '') {
      console.log(`✅ User already has society: ${user.SocietyId}`);
      
      // Get society name from database to display
      const societies = await getSocieties();
      const userSociety = societies.find(s => s.id === user.SocietyId);
      const societyName = userSociety ? userSociety.name : user.SocietyId;
      
      await sendMessage(phone, MESSAGES.SOCIETY_ALREADY_SET(societyName));
      // Continue to date selection
      await handleDateSelection(phone);
      return;
    }
    
    // Get all available societies
    const societies = await getSocieties();
    console.log(`📊 Found ${societies.length} societies:`, societies);
    
    if (societies.length === 0) {
      await sendMessage(phone, MESSAGES.ERROR_NO_SOCIETIES);
      return;
    }
    
    // Case 1: QR code used - try to match and auto-assign
    if (qrSociety) {
      const matchingSociety = societies.find(s => 
        s.name.toLowerCase().includes(qrSociety.toLowerCase()) ||
        qrSociety.toLowerCase().includes(s.name.toLowerCase())
      );
      
      if (matchingSociety) {
        await updateUserSociety(phone, matchingSociety.id);
        await sendMessage(phone, MESSAGES.SOCIETY_DETECTED(matchingSociety.name));
        // Continue to date selection
        await handleDateSelection(phone);
        return;
      }
    }
    
    // Case 2: Only one society - auto-assign
    if (societies.length === 1) {
      await updateUserSociety(phone, societies[0].id);
      await sendMessage(phone, MESSAGES.SOCIETY_AUTO_ASSIGNED(societies[0].name));
      // Continue to date selection
      await handleDateSelection(phone);
      return;
    }
    
    // Case 3: Multiple societies - show selection
    await sendMessage(phone, MESSAGES.SELECT_SOCIETY);
    
    // Create buttons for societies (max 3 buttons supported by WhatsApp)
    const societyButtons = societies.slice(0, 3).map(society => society.name);
    
    if (societies.length > 3) {
      societyButtons[2] = "Other Societies"; // Replace 3rd with "Other"
    }
    
    await sendButtons(phone, MESSAGES.SOCIETY_CHOOSE_PROMPT, societyButtons);
    userStates[phone] = USER_STATES.WAITING_FOR_SOCIETY;
    
  } catch (error) {
    console.error('❌ Error in society selection:', error);
    await sendMessage(phone, MESSAGES.ERROR_SOCIETIES_LOAD);
  }
}

// FIXED: handleSocietyChoice function
async function handleSocietyChoice(phone, societyChoice) {
  console.log(`🏢 Society choice from ${phone}: ${societyChoice}`);
  
  try {
    if (societyChoice.includes("Other Societies")) {
      await sendMessage(phone, MESSAGES.OTHER_SOCIETY_HELP);
      userStates[phone] = USER_STATES.WAITING_FOR_CUSTOM_SOCIETY;
      return;
    }
    
    // Find the society in our database
    const societies = await getSocieties();
    const selectedSociety = societies.find(s => 
      societyChoice.includes(s.name) || s.name.includes(societyChoice)
    );
    
    if (selectedSociety) {
      await updateUserSociety(phone, selectedSociety.id);
      await sendMessage(phone, MESSAGES.SOCIETY_SELECTED(selectedSociety.name));
      // Continue to date selection
      await handleDateSelection(phone);
    } else {
      await sendMessage(phone, MESSAGES.ERROR_SOCIETY_NOT_FOUND);
    }
    
  } catch (error) {
    console.error('❌ Error handling society choice:', error);
    await sendMessage(phone, MESSAGES.ERROR_GENERAL);
  }
}

// FIXED: Use date utilities for consistent format
async function handleDateSelection(phone) {
  console.log(`📅 Starting date selection for ${phone}`);
  
  try {
    // Get dates in sheet format using utilities
    const todaySheet = getTodaySheetFormat();
    const tomorrowSheet = getTomorrowSheetFormat();
    const dayAfterSheet = getDayAfterSheetFormat();
    
    // Get display formats
    const todayDisplay = toDisplayFormat(new Date());
    const tomorrowDisplay = toDisplayFormat(new Date(Date.now() + 24*60*60*1000));
    const dayAfterDisplay = toDisplayFormat(new Date(Date.now() + 2*24*60*60*1000));
    
    console.log(`📅 Generated dates - Today: ${todaySheet}, Tomorrow: ${tomorrowSheet}, Day After: ${dayAfterSheet}`);
    
    await sendMessage(phone, MESSAGES.SELECT_DATE);
    
    // Create date selection buttons
    const dateButtons = [
      `Today (${todayDisplay})`,
      `Tomorrow (${tomorrowDisplay})`,
      `Day After (${dayAfterDisplay})`
    ];
    
    await sendButtons(phone, MESSAGES.DATE_CHOOSE_PROMPT, dateButtons);
    
    // Send "Other" option as a separate message with button
    await sendButtons(phone, MESSAGES.DATE_OTHER_OPTION, [BUTTONS.OTHER_HUMAN_SUPPORT]);
    
    userStates[phone] = USER_STATES.WAITING_FOR_DATE;
    
  } catch (error) {
    console.error('❌ Error in date selection:', error);
    await sendMessage(phone, MESSAGES.ERROR_DATES_LOAD);
  }
}


// FIXED: Store dates in sheet format consistently
async function handleDateChoice(phone, dateChoice) {
  console.log(`📅 Date choice from ${phone}: ${dateChoice}`);
  
  try {
    if (dateChoice.includes("Other") || dateChoice.includes("Human Support")) {
      await sendMessage(phone, MESSAGES.TEAM_SUPPORT_DATE);
      await logSupportRequest(phone, 'CustomDate', 'User needs custom date');
      return;
    }
    
    let selectedDateSheet;
    
    if (dateChoice.includes("Today")) {
      selectedDateSheet = getTodaySheetFormat();
    } else if (dateChoice.includes("Tomorrow")) {
      selectedDateSheet = getTomorrowSheetFormat();
    } else if (dateChoice.includes("Day After")) {
      selectedDateSheet = getDayAfterSheetFormat();
    }
    
    if (selectedDateSheet) {
      // Store selected date in SHEET FORMAT for consistency
      userStates[phone] = { 
        ...userStates[phone], 
        selectedDate: selectedDateSheet,  // Now storing in "Aug 21, 2025" format
        step: 'date_selected',
        timestamp: Date.now()
      };
      
      console.log(`📅 Stored date state for ${phone}:`, userStates[phone]);
      
      // Display in user-friendly format
      const dateDisplay = toDisplayFormat(selectedDateSheet);
      await sendMessage(phone, MESSAGES.DATE_SELECTED(dateDisplay));
      
      // Continue to duration selection
      await handleDurationSelection(phone);
    }
    
  } catch (error) {
    console.error('❌ Error handling date choice:', error);
    await sendMessage(phone, MESSAGES.ERROR_DATE_PROCESS);
  }
}


// ENHANCED: Duration selection with dynamic pricing
async function handleDurationSelection(phone) {
  console.log(`⏰ Starting duration selection for ${phone}`);
  
  try {
    await sendMessage(phone, MESSAGES.SELECT_DURATION);
    
    // NEW: Get dynamic pricing from Google Sheets
    const pricing = await getPricing();
    console.log(`💰 Loaded pricing:`, pricing);
    
    // Create duration buttons with dynamic pricing
    const durationButtons = [];
    
    if (pricing[2]) durationButtons.push(MESSAGES.DURATION_BUTTON(2, pricing[2]));
    if (pricing[4]) durationButtons.push(MESSAGES.DURATION_BUTTON(4, pricing[4]));
    if (pricing[8]) durationButtons.push(MESSAGES.DURATION_BUTTON(8, pricing[8]));
    
    // Fallback if pricing fails
    if (durationButtons.length === 0) {
      durationButtons.push("2hr – ₹199", "4hr – ₹349", "8hr – ₹599");
      await sendMessage(phone, MESSAGES.ERROR_PRICING_LOAD);
    }
    
    await sendButtons(phone, MESSAGES.DURATION_CHOOSE_PROMPT, durationButtons);
    
    // Send "Not sure" option as separate button
    await sendButtons(phone, MESSAGES.DURATION_HELP_PROMPT, [BUTTONS.NOT_SURE_TEAM]);
    
    userStates[phone] = { ...userStates[phone], step: USER_STATES.WAITING_FOR_DURATION };
    
  } catch (error) {
    console.error('❌ Error in duration selection:', error);
    await sendMessage(phone, MESSAGES.ERROR_DURATION_LOAD);
  }
}

// ENHANCED: Duration choice with dynamic pricing
async function handleDurationChoice(phone, durationChoice) {
  console.log(`⏰ Duration choice from ${phone}: ${durationChoice}`);
  
  try {
    if (durationChoice.includes("Not sure") || durationChoice.includes("team")) {
      await sendMessage(phone, MESSAGES.TEAM_SUPPORT_DURATION);
      await logSupportRequest(phone, 'CustomDuration', 'User needs help with duration');
      return;
    }
    
    let selectedDuration;
    let price;
    
    // Extract duration from button text (works with dynamic pricing)
    if (durationChoice.includes("2hr")) {
      selectedDuration = 2;
      price = await getPriceForDuration(2);
    } else if (durationChoice.includes("4hr")) {
      selectedDuration = 4;
      price = await getPriceForDuration(4);
    } else if (durationChoice.includes("8hr")) {
      selectedDuration = 8;
      price = await getPriceForDuration(8);
    }
    
    if (selectedDuration && price) {
      // Store duration in user state with better persistence
      userStates[phone] = { 
        ...userStates[phone], 
        selectedDuration: selectedDuration,
        selectedPrice: price,
        step: 'duration_selected',
        timestamp: Date.now()
      };
      
      console.log(`⏰ Stored duration state for ${phone}:`, userStates[phone]);
      
      await sendMessage(phone, MESSAGES.DURATION_SELECTED(selectedDuration, price));
      
      // Continue to slot availability checking
      await handleSlotAvailability(phone);
    }
    
  } catch (error) {
    console.error('❌ Error handling duration choice:', error);
    await sendMessage(phone, MESSAGES.ERROR_DURATION_PROCESS);
  }
}

// Fixed slot display functions for userFlow.js

// FIXED: Better slot availability display (show 3, then show more 3, then button)
async function handleSlotAvailability(phone) {
  console.log(`🔍 ENHANCED: Checking slot availability for ${phone}`);
  
  try {
    const userState = userStates[phone] || {};
    const { selectedDate, selectedDuration } = userState;
    
    console.log(`📊 User state for ${phone}:`, userState);
    
    if (!selectedDate || !selectedDuration) {
      console.log(`❌ Missing booking preferences for ${phone}:`, { selectedDate, selectedDuration });
      await sendMessage(phone, MESSAGES.ERROR_BOOKING_PREFERENCES);
      
      // Restart the booking flow
      await handleDateSelection(phone);
      return;
    }

    // Get user's society
    const user = await getUserByPhone(phone);
    if (!user || !user.SocietyId) {
      await sendMessage(phone, MESSAGES.ERROR_SOCIETY_INFO);
      return;
    }

    // Get society name for availability checking
    const societies = await getSocieties();
    const userSociety = societies.find(s => s.id === user.SocietyId);
    const societyName = userSociety ? userSociety.name : null;
    
    if (!societyName) {
      await sendMessage(phone, MESSAGES.ERROR_SOCIETY_DETAILS);
      return;
    }

    
    // FIXED: selectedDate is already in sheet format, use directly
    console.log(`🔍 ENHANCED: Looking for slots: ${societyName}, ${selectedDate}, ${selectedDuration}hrs`);
    
    // Get available slots using NEW system with sheet format date
    const availabilityResult = await getAvailableSlots(societyName, selectedDate, selectedDuration);
    const { slots, actualDuration, isDowngraded } = availabilityResult;
   
    console.log(`📊 ENHANCED: Availability result:`, {
      totalSlots: slots.length,
      actualDuration,
      isDowngraded,
      firstSlot: slots[0]
    });
    
    if (slots.length === 0) {
      // No slots available at all
      await sendMessage(phone, MESSAGES.ALL_BOOKED);
      
      await sendButtons(phone, MESSAGES.WHAT_WOULD_YOU_LIKE, [
        BUTTONS.TRY_DIFFERENT_DATE,
        BUTTONS.CALL_SUPPORT
      ]);
      return;
    }

    // Handle downgraded duration
    if (isDowngraded) {
      await sendMessage(phone, MESSAGES.DOWNGRADED_SLOTS(selectedDuration, actualDuration));
      userStates[phone] = { ...userStates[phone], selectedDuration: actualDuration };
    } else {
      await sendMessage(phone, MESSAGES.AVAILABLE_SLOTS(actualDuration));
    }

    // FIXED: Show first 3 slots WITHOUT "showing X of Y" message
    const firstBatch = slots.slice(0, 3);
    const hasMoreThan3 = slots.length > 3;
    
    // Create buttons for first 3 slots
    const slotButtons = firstBatch.map(slot => slot.timeSlot);

    console.log(`🔘 Creating first slot buttons:`, slotButtons);

    if (slotButtons.length > 0) {
      await sendButtons(phone, MESSAGES.SELECT_TIME_SLOT, slotButtons);
      
      // FIXED: If more than 3 slots, show "More slots" with next 3 slots immediately
      if (hasMoreThan3) {
        const secondBatch = slots.slice(3, 6);
        const hasMoreThan6 = slots.length > 6;
        
        if (secondBatch.length > 0) {
          const moreSlotButtons = secondBatch.map(slot => slot.timeSlot);
          await sendButtons(phone, "More slots:", moreSlotButtons);
          
          // Show "Need more options?" with "Show More Slots" button only if more than 6
          if (hasMoreThan6) {
            await sendButtons(phone, "Need more options?", [BUTTONS.SHOW_MORE_SLOTS]);
          }
        }
      }
      
      // If 6 or fewer slots total, show alternative options
      if (slots.length <= 6) {
        await sendButtons(phone, "Or choose a different option:", [
          BUTTONS.TRY_DIFFERENT_DATE,
          BUTTONS.TRY_DIFFERENT_DURATION
        ]);
      }
    } else {
      console.log('❌ No slot buttons to show');
      await sendMessage(phone, MESSAGES.ERROR_NO_DISPLAY_SLOTS);
    }
    
    // Store slots for potential "show more" functionality
    userStates[phone] = { 
      ...userStates[phone], 
      availableSlots: slots,
      currentPage: 1,
      slotsShown: Math.min(6, slots.length), // Track that we've shown up to 6 slots
      step: USER_STATES.WAITING_FOR_SLOT
    };
    
  } catch (error) {
    console.error('❌ Error checking slot availability:', error);
    await sendMessage(phone, MESSAGES.ERROR_AVAILABILITY);
  }
}

// FIXED: Show more slots (next batch after 6)
async function handleShowMoreSlots(phone) {
  console.log(`🔄 ENHANCED: Showing more slots for ${phone}`);
  
  try {
    const userState = userStates[phone] || {};
    const { availableSlots, slotsShown = 6 } = userState;
    
    if (!availableSlots || availableSlots.length === 0) {
      await sendMessage(phone, MESSAGES.ERROR_DIFFERENT_OPTIONS);
      return;
    }
    
    // Show next 3 slots after the 6 already shown
    const nextBatch = availableSlots.slice(slotsShown, slotsShown + 3);
    const newSlotsShown = slotsShown + nextBatch.length;
    const stillHasMore = availableSlots.length > newSlotsShown;
    
    if (nextBatch.length === 0) {
      await sendMessage(phone, MESSAGES.NO_MORE_SLOTS);
      return;
    }

    // FIXED: Show next batch WITHOUT "showing X-Y of Z" message
    await sendMessage(phone, "🕑 *Additional available slots:*");

    // Create buttons for next batch of slots
    const slotButtons = nextBatch.map(slot => slot.timeSlot);
    await sendButtons(phone, MESSAGES.SELECT_TIME_SLOT, slotButtons);
    
    // Show "More slots" button if there are still more
    if (stillHasMore) {
      await sendButtons(phone, "Still need more options?", [BUTTONS.SHOW_MORE_SLOTS]);
    } else {
      // No more slots, show alternatives
      await sendButtons(phone, "Or try a different option:", [
        BUTTONS.TRY_DIFFERENT_DATE,
        BUTTONS.TRY_DIFFERENT_DURATION
      ]);
    }
    
    // Update slots shown count
    userStates[phone] = { ...userStates[phone], slotsShown: newSlotsShown };
    
  } catch (error) {
    console.error('❌ Error showing more slots:', error);
    await sendMessage(phone, MESSAGES.ERROR_MORE_SLOTS);
  }
}

// Rest of the functions...
async function handleSlotChoice(phone, slotChoice) {
  console.log(`🕐 ENHANCED: Slot choice from ${phone}: ${slotChoice}`);
  
  try {
    if (slotChoice.includes("Show More")) {
      await handleShowMoreSlots(phone);
      return;
    }
    
    // Extract time slot (format: "09:00-11:00") - FIXED: Using regular dash
    const timeSlotMatch = slotChoice.match(/\d{2}:\d{2}-\d{2}:\d{2}/);
    console.log(`🔍 DEBUG: Regex match result:`, timeSlotMatch);
    
    if (!timeSlotMatch) {
      console.log(`❌ DEBUG: Regex failed for: "${slotChoice}"`);
      await sendMessage(phone, MESSAGES.ERROR_SLOT_UNDERSTANDING);
      return;
    }
    
    const selectedTimeSlot = timeSlotMatch[0];
    const userState = userStates[phone] || {};
    const { availableSlots, selectedDuration, selectedPrice, selectedDate } = userState;
    
    console.log(`🔍 DEBUG: Available slots count:`, availableSlots?.length || 0);
    console.log(`🔍 DEBUG: Looking for slot:`, selectedTimeSlot);
    
    // Find the matching slot details  
    const selectedSlot = availableSlots?.find(slot => slot.timeSlot === selectedTimeSlot);
    
    if (!selectedSlot) {
      console.log(`❌ DEBUG: Could not find matching slot in available slots`);
      await sendMessage(phone, MESSAGES.ERROR_SLOT_UNAVAILABLE);
      return;
    }
    
    console.log(`✅ DEBUG: Found slot`, selectedSlot);

    
    // Store selected slot
    userStates[phone] = {
      ...userStates[phone],
      selectedSlot: selectedSlot,
      step: USER_STATES.READY_FOR_BOOKING
    };
    
    // Get user info for booking confirmation
    const user = await getUserByPhone(phone);
    
    // Get society name instead of ID
    const societies = await getSocieties();
    const userSociety = societies.find(s => s.id === user.SocietyId);
    const societyName = userSociety ? userSociety.name : user.SocietyId;
    
    const isFirstBooking = user.FirstBookingDone === 'No';
    // FIXED: Use selectedDate directly (already in sheet format)
    console.log(`📅 DEBUG: Using selectedDate: ${selectedDate} (should be in sheet format)`);

    // 🎯 ASSIGN A SPECIFIC POD FOR THIS SLOT - use selectedDate directly
    const assignedPod = await assignPodForSlot(societyName, selectedSlot, selectedDate);

    if (!assignedPod) {
      console.log(`❌ Could not assign pod for slot ${selectedTimeSlot}`);
      await sendMessage(phone, "Sorry, this slot is no longer available. Please select another slot.");
      return;
    }

    console.log(`🎯 Assigned pod: ${assignedPod.podId} for slot ${selectedTimeSlot}`);

    // Update selectedSlot with the assigned pod
    selectedSlot.podId = assignedPod.podId;
    selectedSlot.podName = assignedPod.podName; 

    
    console.log(`🎯 Processing booking: First booking = ${isFirstBooking}`);
    
    // Show booking confirmation
    if (isFirstBooking) {
      // Create booking using new system
      const transactionId = generateTransactionId();
      let lockPin = generateLockPin(user.PhoneNumber);
      
      console.log(`🆓 Creating FREE booking: ${transactionId}`);
      console.log(`📅 DEBUG: selectedDate for booking: ${selectedDate}`);
      
      
      // Create booking in new structure
      try {
        const bookingResult = await createBooking({
          bookingId: transactionId,
          societyId: user.SocietyId,
          date: selectedDate,  // Already in sheet format
          podId: selectedSlot.podId,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          duration: selectedDuration,
          userId: user.UserId,
          amount: 0, // Free for first booking
          bookingType: 'First_Free'
        });
        
        console.log('✅ ENHANCED: Booking created in new structure');
        console.log('📦 Booking result:', bookingResult);

        // Get the TTLock-generated PIN from booking result
        const finalLockPin = bookingResult.assignedLockPin || lockPin;
        const pinStatus = bookingResult.pinStatus || 'unknown';
  
        console.log(`🔐 Final PIN to send to user: ${finalLockPin} (Status: ${pinStatus})`);
       // Update lockPin for use outside try block
       lockPin = finalLockPin;
  
  
      } catch (error) {
        console.error('❌ Error creating booking in new structure:', error);
        console.error('❌ Full error details:', error.stack);
        // Continue with old PIN as fallback
  console.log('🔄 Continuing with fallback PIN:', lockPin);
      }
      
      // Update Users sheet - mark first booking as done
      try {
        await updateFirstBookingStatus(
          user.PhoneNumber, 
          toDisplayFormat(selectedDate),  // Convert for display
          selectedDuration
        );
        console.log('✅ Updated Users sheet with first booking');
      } catch (error) {
        console.error('❌ Error updating Users sheet:', error);
      }
      
      // Send success messages
      await sendMessage(phone, MESSAGES.FREE_BOOKING_SUCCESS(
        societyName,
        selectedSlot.podName,
        toDisplayFormat(selectedDate),  // Display format for user
        selectedTimeSlot,
        selectedDuration,
        transactionId
      ));
      
      await sendMessage(phone, MESSAGES.ACCESS_PIN(lockPin));
      
      // Send guidelines and complete booking
      setTimeout(async () => {
        await sendMessage(phone, MESSAGES.BOOKING_COMPLETE_GUIDELINES);
        // Set state to completed to prevent "Hi again"
        userStates[phone] = { ...userStates[phone], step: USER_STATES.BOOKING_COMPLETED };
      }, 2000);
      
    } else {
      // Generate booking data for paid booking
      const transactionId = generateTransactionId();
      const lockPin = generateLockPin(user.PhoneNumber);
      
      
      console.log(`💳 Creating PAID booking: ${transactionId} for ₹${selectedPrice}`);
      console.log(`📅 DEBUG: selectedDate = ${selectedDate}`);
      
      // Store booking data in user state for payment processing
      userStates[phone] = {
        ...userStates[phone],
        pendingBooking: {
          transactionId: transactionId,
          societyId: user.SocietyId,
          date: selectedDate,  // Store in sheet format
          podId: selectedSlot.podId,
          podName: selectedSlot.podName,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          duration: selectedDuration,
          userId: user.UserId,
          amount: selectedPrice,
          bookingType: 'Regular',
          assignedLockPin: lockPin,
          selectedSlot: selectedSlot,
          societyName: societyName,
          bookingDate: toDisplayFormat(selectedDate)  // Display format for user messages
        },
        step: USER_STATES.PENDING_PAYMENT
      };
      
      await sendMessage(phone, MESSAGES.PAID_BOOKING_SUMMARY(
        societyName,
        selectedSlot.podName,
        toDisplayFormat(selectedDate),  // Display format for user
        selectedTimeSlot,
        selectedDuration,
        selectedPrice,
        transactionId
      ));
      
      await sendButtons(phone, MESSAGES.READY_TO_COMPLETE, [
        BUTTONS.PAY_NOW,
        BUTTONS.CANCEL_BOOKING
      ]);
    }
    
  } catch (error) {
    console.error('❌ Error handling slot choice:', error);
    await sendMessage(phone, MESSAGES.ERROR_SLOT_CHOICE);
  }
}

// FIXED: Payment choice handling - Clean version focused on webhook success
async function handlePaymentChoice(phone, choice) {
  console.log(`💳 Payment choice from ${phone}: ${choice}`);
  
  try {
    const userState = userStates[phone] || {};
    const { pendingBooking } = userState;
    
    if (!pendingBooking) {
      await sendMessage(phone, MESSAGES.ERROR_BOOKING_DETAILS);
      return;
    }
    
    if (choice === "cancel" || choice.includes("Cancel")) {
      // Clear pending booking
      userStates[phone] = { ...userStates[phone], pendingBooking: null, step: USER_STATES.CANCELLED };
      await sendMessage(phone, MESSAGES.BOOKING_CANCELLED);
      
      await sendButtons(phone, MESSAGES.WHAT_WOULD_YOU_LIKE, [
        BUTTONS.BOOK_AGAIN,
        BUTTONS.ASK_QUESTION
      ]);
      return;
    }
    
    if (choice === "pay" || choice.includes("Pay Now") || choice.includes("💳")) {
      
      // Prepare booking data for Razorpay
      const bookingDataForPayment = {
        transactionId: pendingBooking.transactionId,
        podId: pendingBooking.podId,
        podName: pendingBooking.podName,
        societyName: pendingBooking.societyName,
        startTime: pendingBooking.startTime,
        endTime: pendingBooking.endTime,
        duration: pendingBooking.duration,
        userId: pendingBooking.userId,
        userName: await getUserName(phone),
        date: pendingBooking.date  // Pass the sheet format date
      };
      
      // Send payment processing message
      await sendMessage(phone, MESSAGES.PAYMENT_LINK_CREATING);
      
      try {
        // Create and send Razorpay payment link
        const paymentResult = await createAndSendPaymentLink(
          phone, 
          pendingBooking.amount, 
          bookingDataForPayment
        );
        
        if (paymentResult.success) {
          // Update user state to payment processing
          userStates[phone] = { 
            ...userStates[phone], 
            step: USER_STATES.PAYMENT_PROCESSING,
            paymentLinkId: paymentResult.paymentLinkId
          };
          
          console.log(`✅ Payment link sent to ${phone}: ${paymentResult.paymentLinkId}`);
          
          // Simple success message - webhook will handle the rest
          await sendMessage(phone, 
            `💳 *Payment Link Sent!*\n\n` +
            `Amount: ₹${pendingBooking.amount}\n` +
            `Booking: ${pendingBooking.transactionId}\n\n` +
            `🔗 Click the payment link above to pay securely\n` +
            `✅ You'll get automatic confirmation within 30 seconds after payment!`
          );
          
        } else {
          await sendMessage(phone, MESSAGES.PAYMENT_LINK_FAILED);
        }
        
      } catch (error) {
        console.error(`❌ Payment creation error for ${phone}:`, error);
        await sendMessage(phone, MESSAGES.PAYMENT_TECHNICAL_ERROR);
      }
    }
    
    // Handle payment status inquiries
    if (choice.includes("Payment Complete") || choice.includes("✅")) {
      await sendMessage(phone, MESSAGES.PAYMENT_STATUS_CHECK);
    }
    
    // Handle payment help requests
    if (choice.includes("Need Help") || choice.includes("❓")) {
      await sendMessage(phone, MESSAGES.PAYMENT_HELP);
    }
    
  } catch (error) {
    console.error('❌ Error handling payment choice:', error);
    await sendMessage(phone, MESSAGES.ERROR_PAYMENT);
  }
}

// Handle payment processing states
async function handlePaymentProcessing(phone, message) {
  console.log(`💰 Message during payment processing from ${phone}: ${message}`);
  
  const userState = userStates[phone] || {};
  const { paymentLinkId } = userState;
  
  if (message.toLowerCase().includes('paid') || 
      message.toLowerCase().includes('done') ||
      message.toLowerCase().includes('completed') ||
      message.toLowerCase().includes('success')) {
    
    await sendMessage(phone, MESSAGES.PAYMENT_SUCCESS_AUTO);
    
  } else if (message.toLowerCase().includes('failed') || 
             message.toLowerCase().includes('error') ||
             message.toLowerCase().includes('problem') ||
             message.toLowerCase().includes('cancel')) {
    
    await sendMessage(phone, MESSAGES.PAYMENT_ISSUE);
    
    await sendButtons(phone, "Choose an option:", [
      BUTTONS.TRY_PAYMENT_AGAIN,
      BUTTONS.CONTACT_SUPPORT,
      BUTTONS.CANCEL_BOOKING
    ]);
    
  } else if (message.toLowerCase().includes('help') || 
             message.toLowerCase().includes('support')) {
    
    await sendMessage(phone, MESSAGES.PAYMENT_SUPPORT_DETAILED);
    
  } else {
    await sendMessage(phone, MESSAGES.PAYMENT_STATUS_WAITING);
  }
}

// Complete payment booking with TTLock integration
async function completePaymentBooking(phone, bookingData) {
  try {
    console.log('💰 ENHANCED: Completing payment booking with TTLock system');
    
    // Create booking in new structure with TTLock
    const bookingResult = await createBooking({
      bookingId: bookingData.transactionId,
      societyId: bookingData.societyId,
      date: bookingData.date,
      podId: bookingData.podId,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      duration: bookingData.duration,
      userId: bookingData.userId,
      amount: bookingData.amount,
      bookingType: bookingData.bookingType
    });
    
    // Get the TTLock-generated PIN from booking result
    const finalLockPin = bookingResult.assignedLockPin || bookingData.assignedLockPin;
    const pinStatus = bookingResult.pinStatus || 'unknown';

    console.log(`🔐 Final PIN to send to user: ${finalLockPin} (Status: ${pinStatus})`);

    // Clear pending booking from state and mark as completed
    userStates[phone] = { 
      ...userStates[phone], 
      pendingBooking: null, 
      step: USER_STATES.BOOKING_COMPLETED 
    };
    
    await sendMessage(phone, MESSAGES.PAYMENT_SUCCESSFUL(
      bookingData.societyName,
      bookingData.podId,
      bookingData.bookingDate,
      `${bookingData.startTime}-${bookingData.endTime}`,
      bookingData.duration,
      bookingData.amount,
      bookingData.transactionId
    ));
    
    // Send PIN with status information
    let pinMessage = `🔐 Your access PIN: *${finalLockPin}*\n\n`;
    
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
    
    await sendMessage(phone, pinMessage);
    
    // Send guidelines
    setTimeout(async () => {
      await sendMessage(phone, MESSAGES.BOOKING_COMPLETE_GUIDELINES);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error completing payment booking with TTLock:', error);
    await sendMessage(phone, MESSAGES.ERROR_BOOKING_COMPLETION);
  }
}

// Handle button replies
async function handleButtonReply(phone, buttonText) {
  console.log(`🔘 Button clicked by ${phone}: ${buttonText}`);

  // ADD THESE DEBUG LOGS
  console.log(`🔍 DEBUG: Button text length: ${buttonText.length}`);
  console.log(`🔍 DEBUG: Contains "—": ${buttonText.includes("—")}`);
  console.log(`🔍 DEBUG: Contains ":": ${buttonText.includes(":")}`);
  console.log(`🔍 DEBUG: Both conditions: ${buttonText.includes("—") && buttonText.includes(":")}`);
  
  
  try {
    if (buttonText.includes("Ask a Question") || buttonText.includes("❓")) {
      console.log(`🔍 DEBUG: Matched Ask Question`);
      await sendMessage(phone, MESSAGES.QUESTION_PROMPT);
      await logSupportRequest(phone, 'Question', buttonText);
      return;
    }
    
    if (buttonText.includes("Book a Pod") || buttonText.includes("📝")) {
      console.log(`🔍 DEBUG: Matched Book Pod`);
      const user = await getUserByPhone(phone);
      
      if (!user || !user.Name || user.Name.trim() === "") {
        await sendMessage(phone, MESSAGES.NAME_REQUEST);
        userStates[phone] = USER_STATES.WAITING_FOR_NAME;
        return;
      }
      
      await sendMessage(phone, MESSAGES.LETS_BOOK_POD(user.Name));
      
      // Continue to society selection
      await handleSocietySelection(phone);
    }
    
    // Handle society selection buttons
    if (buttonText.includes("Tata Primanti") || buttonText.includes("DLF Phase 5") || buttonText.includes("Emerald Hills")) {
      console.log(`🔍 DEBUG: Matched Society`);
      await handleSocietyChoice(phone, buttonText);
    }
    
    // Handle date selection buttons
    if (buttonText.includes("Today") || buttonText.includes("Tomorrow") || buttonText.includes("Day After") || buttonText.includes("Other")) {
      console.log(`🔍 DEBUG: Matched Date`);
      await handleDateChoice(phone, buttonText);
    }
    
    // Handle duration selection buttons
    if (buttonText.includes("2hr") || buttonText.includes("4hr") || buttonText.includes("8hr") || buttonText.includes("Not sure")) {
      console.log(`🔍 DEBUG: Matched Duration`);
      await handleDurationChoice(phone, buttonText);
    }
    
    // Handle slot selection buttons - FIXED: Using regular dash
    if (buttonText.includes("-") && buttonText.includes(":")) {
      console.log(`🔍 DEBUG: Matched Slot Selection - calling handleSlotChoice`);
      await handleSlotChoice(phone, buttonText);
      return; // ADD EXPLICIT RETURN
    }
    
    // Handle Show More Slots
    if (buttonText.includes("Show More") || buttonText.includes("🔄")) {
      console.log(`🔍 DEBUG: Matched Show More`);
      await handleShowMoreSlots(phone);
    }  
    // Handle alternative options (truncation-safe)
if (buttonText.includes("Try Different Date") || 
    buttonText.includes("Try Different Dat") ||  // WhatsApp truncation
    buttonText.includes("Try Different Duration") ||
    buttonText.includes("Try Different Dur")) {   // WhatsApp truncation
  console.log(`📅 DEBUG: Matched alternative option: "${buttonText}"`);
  await handleAlternativeChoice(phone, buttonText);
  return;
}
    
    // Handle payment buttons
    if (buttonText.includes("Pay Now") || buttonText.includes("💳")) {
      await handlePaymentChoice(phone, "pay");
      return;
    }
    
    if (buttonText.includes("Cancel Booking") || buttonText.includes("❌")) {
      await handlePaymentChoice(phone, "cancel");
      return;
    }
    
    // Handle "Try Booking Again" button
    if (buttonText.includes("Try Booking Again") || buttonText.includes("Book Again")) {
      // Reset user state and start fresh booking
      userStates[phone] = { step: USER_STATES.INITIAL };
      
      const user = await getUserByPhone(phone);
      if (user && user.Name) {
        await sendMessage(phone, `Hi ${user.Name}! Let's book a pod for you. 🏢`);
        await handleSocietySelection(phone);
      } else {
        await sendMessage(phone, MESSAGES.NAME_REQUEST);
        userStates[phone] = USER_STATES.WAITING_FOR_NAME;
      }
      return;
    }
    
    // Handle "Contact Support" button
    if (buttonText.includes("Contact Support") || buttonText.includes("📞")) {
      await sendMessage(phone, MESSAGES.CONTACT_SUPPORT_DETAILS);
      return;
    }
    
    console.log(`🔍 DEBUG: No conditions matched for: "${buttonText}"`);
    
  } catch (error) {
    console.error('❌ Error in handleButtonReply:', error);
    await sendMessage(phone, MESSAGES.ERROR_GENERAL);
  }
}





// Handle alternative choices
async function handleAlternativeChoice(phone, choice) {
  if (choice.includes("Try Different Date") || choice.includes("Try Different Dat")) {
    console.log(`📅 DEBUG: Showing date selection again for: "${choice}"`);
    await handleDateSelection(phone);
  } else if (choice.includes("Try Different Duration") || choice.includes("Try Different Dur")) {
    console.log(`⏰ DEBUG: Showing duration selection again for: "${choice}"`);
    await handleDurationSelection(phone);
  }
}

// Helper function to get user name
async function getUserName(phone) {
  try {
    console.log(`🔍 Getting user name for ${phone}`);
    const user = await getUserByPhone(phone);
    
    if (user && user.Name && user.Name.trim()) {
      console.log(`✅ Found user name: ${user.Name}`);
      return user.Name.trim();
    } else {
      console.log(`⚠️ No name found for ${phone}, using default`);
      return 'FocusPod Customer';
    }
  } catch (error) {
    console.error('❌ Error getting user name:', error);
    return 'FocusPod Customer';
  }
}


// Helper function to extract society info from QR code message
function extractSocietyFromMessage(message) {
  // Check if message contains society info (from QR code)
  // Example: "Hi, I would like to book pod at Tata Primanti"
  const patterns = [
    /at\s+(.+?)(?:\s|$)/i,
    /in\s+(.+?)(?:\s|$)/i,
    /from\s+(.+?)(?:\s|$)/i,
    /book.*pod.*at\s+(.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

// Function to handle interactive button responses from WhatsApp
async function handleInteractiveMessage(phone, interactiveData) {
  const buttonReply = interactiveData.button_reply;
  if (buttonReply) {
    await handleButtonReply(phone, buttonReply.title);
  }
}

// Clear user state (useful for testing or resetting conversation)
function clearUserState(phone) {
  delete userStates[phone];
  console.log(`🧹 Cleared state for ${phone}`);
}

module.exports = {
  handleUserMessage,
  handleButtonReply,
  handleNameInput,
  handleInteractiveMessage,
  handleDateSelection,
  handleDateChoice,
  handleDurationSelection,
  handleDurationChoice,
  handleSlotAvailability,
  handleSlotChoice,
  handleShowMoreSlots,
  handlePaymentChoice,
  handlePaymentProcessing,
  completePaymentBooking,
  clearUserState
};