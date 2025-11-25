// test-pin-generation.js - Test PIN generation with new token
require('dotenv').config({ override: true });

const { handleBookingLockAccess } = require('./ttlock-integration');

console.log('🔐 Testing PIN Generation\n');
console.log('=' .repeat(60));

async function testPIN() {
  // Test booking data - using Pod 1 Primanti
  const testBooking = {
    lockId: '25707092',  // Pod 1 Primanti
    startTime: '10:00',
    endTime: '12:00',
    bookingId: 'TEST_' + Date.now(),
    societyName: 'Primanti',
    bookingDate: '26/11/2025',  // Tomorrow
    podId: 'Pod 1'
  };

  console.log('📋 Test Booking Details:');
  console.log(JSON.stringify(testBooking, null, 2));
  console.log('\n🔄 Generating PIN...\n');

  try {
    const result = await handleBookingLockAccess(testBooking);

    console.log('\n📊 Result:');
    console.log('=' .repeat(60));
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.pin) {
      console.log('\n✅ SUCCESS! PIN Generated:');
      console.log(`🔢 PIN: ${result.pin}`);
      console.log(`⏰ Valid From: ${result.validFrom}`);
      console.log(`⏰ Valid Until: ${result.validUntil}`);
      console.log(`🆔 Keyboard PWD ID: ${result.keyboardPwdId}`);
    } else {
      console.log('\n❌ PIN generation failed:');
      console.log(`Error: ${result.error || result.message}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testPIN();
