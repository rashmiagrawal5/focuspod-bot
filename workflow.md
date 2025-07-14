# Whatsapp user workflow for focuspod

We are installing office pods in multiple societies for user to book and work in their societies. I will building whatsapp bot for user to be able to do booking (including payment)

### Following would be key Google sheet databases

#### Society, Pod and digital lock identifiers

|Society Id	|Society name	|Pod ID	|Pod Name	|Pod Address	|Lock device id	|Default lock pin	|
|---	|---	|---	|---	|---	|---	|---	|
|1	|Tata Primanti	|11	|Pod 1	|Clubhouse Basement	|111	|9036	|
|---	|---	|---	|---	|---	|---	|---	|
|1	|Tata Primanti	|12	|Pod 2	|Clubhouse Ground floor, Reception	|122	|9870	|
|2	|The Close South	|21	|Pod 1	|	|211	|4925	|

#### User data

|User ID	|Phone Number	|Name	|Society ID	|First Booking Done?	|First Booking Date	|First Booking Slot	|Tower number (optional)	|
|---	|---	|---	|---	|---	|---	|---	|---	|
|1	|9876543210	|Riya Gupta	|1	|Yes	|24th June 2025	|(10-12)	|	|
|---	|---	|---	|---	|---	|---	|---	|---	|
|2	|9876000001	|Mehul Shah	|1	|No	|	|	|	|

#### Booking data

|Transaction ID	|Transaction Date	|Transaction time	|Transaction amount	|Booking date	|Slot duration booked	|Slot start and end time	|Assigned Lock pin number	|User ID	|Pod ID	|Society ID	|
|---	|---	|---	|---	|---	|---	|---	|---	|---	|---	|---	|
|1	|10 July 2025	|11:23 am	|199	|11 July	|2	|(10-12)	|	|1	|11	|1	|
|---	|---	|---	|---	|---	|---	|---	|---	|---	|---	|---	|
|2	|	|	|	|	|	|	|	|2	|11	|1	|

#### **POD Availability System**

|Society	|Date	|Slot Start	|Slot End	|Pod ID	|Status	|
|---	|---	|---	|---	|---	|---	|
|Tata Primanti	|June 23, 2025	|6:00 am	|8:00 am	|12	|Free	|
|Tata Primanti	|June 23, 2025	|7:00 am	|9:00 am	|11	|Booked	|
|Tata Primanti	|June 23, 2025	|8:00 am	|10:00 am	|12	|Free	|
|Tata Primanti	|June 23, 2025	|9:00 am	|11:00 am	|11	|Free	|
|Tata Primanti	|June 23, 2025	|10:00 am	|12:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|11:00 am	|1:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|12:00 pm	|2:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|1:00 pm	|3:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|2:00 pm	|4:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|3:00 pm	|5:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|4:00 pm	|6:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|5:00 pm	|7:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|6:00 pm	|8:00 pm	|11	|Free	|
|Tata Primanti	|June 23, 2025	|7:00 pm	|9:00 pm	|11	|Free	|

#### Pricing DB

|Slot	|Price	|
|---	|---	|
|2	|10	|
|---	|---	|
|4	|20	|
|8	|30	|

### Detailed whatsapp bot Workflow

####  **A. User Identification & First-time Offer**

🔹 Step A1: User Initiates Chat

1. User scan QR code, Auto identify society using QR code. Each pod gets a **unique QR code** that contains pre-filled info. [https://wa.me/919036089111?text=Hi, I would like to book pod at Tata Primanti](https://wa.me/919036089111?text=Hi,%20I%20would%20like%20to%20book%20pod%20at%20Tata%20Primanti), OR
2. User messages WA business number directly - “Hi” or any other text
3. Welcome Message - “Hi! 👋 Welcome to FocusPod. Let's get you a quiet pod to work from your society.” 
4. User Detection (New or Existing) - Bot lookup User DB using phone number. 
    1. If new user, Message → Since you're booking for the first time. Your first pod booking is FREE. Please share your name to get started.
        1. Update user db with phone number, name and marks `First Booking Done = No` ****
    2. If existing user → continue to booking.
5. Detect Society - 
    1. If QR used → prefill society in user db, If not → check Society db, if only one society is onboarded → prefill that society in user db
    2. if multiple societies are onboarded, Message
        1. 🏘️ *Please select your residential society:*
            List Onboarded societies as button - [Tata Primanti] [DLF Phase 5] [Emerald Hills]
            *(Choose the one you belong to)*
        2. update user society in user db
6. `Choose an option: [🔐 Book a Pod] [❓Ask a Question]`
    1. User chooses - Book a pod → continue to booking.
    2. If user chooses - “Ask a Question” 
        1. 🤖 *No problem! Our team is here to help.*
             Please type your question, We’ll connect you with a human shortly. 🧑‍💼

#### B. Date & Slot Selection

1. Date Selection
    1. Select your preferred day: [Today] [Tomorrow] [Day After] [Other → Human Support]
        1. If user selects “Other”, Message → Please share the date you’d like to book and your preferred time. Team will call you shortly and assist you with the booking.
2. Duration Selection
    1. Choose duration: [2hr – ₹199] [4hr – ₹349] [8hr – ₹599] [Not sure? Let’s talk to the team 👥]
        1. if user selects “not sure”, Message → No worries! Team will call you shortly and assist you with the booking
3. Based on the duration, check availabity sheet (Backend logic - check slots on all the pods against a society, and share 5 available slots for selected duration)
    1. Case A: Slots found (any duration)
        1. **Show first 5** 🕑 Here are the available slots for *{duration} hour* booking: [09:00–11:00][10:00–12:00][11:00–13:00][12:00–14:00][13:00–15:00] 🔄 *Need a different slot]*
        2. **If “Need a different slot” is clicked, show next 5:** More options for *{duration}* hour slots: [14:00–16:00][15:00–17:00][16:00–18:00][17:00–19:00][18:00–20:00] 🔄 *[Show remaining]*
        3. **Final remaining slots:** Last available slots today: [18:00–20:00][19:00–21:00]
    2. Case B: Downgrade, If no slot is available for selected duration, automatically check for shorter duration slot 
        1. ⚠️ No {selected_duration}-hour slots are available.
             But we found a few *shorter duration* options for you:
             • 10:00–12:00 (2 hrs)
             • 13:00–15:00 (2 hrs)
            *(Tap to book, or select another date)*
    3. Case C: Nothing Found
        1. 😔 All pods are fully booked for this day.
             Would you like to:
             • Try another date
             • Talk to our team
    4. What to Store Between Messages:
        1. `user_id`
        2. `last_duration_shown` (e.g. 4 hr)
        3. `last_page_shown` (e.g. 1)
        4. `all_matching_slots` (optional in memory/session)
    5. Python-like Pseudocode Logic
        
        def get_paginated_slots(society, date, duration, sheet_data, page=1):
            def find_slots_for_duration(hours):
                all_matching = []
                for row in sheet_data:
                    if row['Society'] != society or row['Date'] != date:
                        continue
                    if row['Status'].lower() != 'free':
                        continue
                    
                    start = datetime.strptime(row['Slot Start'], '%H:%M')
                    end = datetime.strptime(row['Slot End'], '%H:%M')
                    if (end - start) == timedelta(hours=hours):
                        all_matching.append(row)
                return all_matching
        
            # First try requested duration
            matching_slots = find_slots_for_duration(duration)
            
            # If empty, fallback to shorter durations
            if not matching_slots:
                fallback_durations = [d for d in [4, 2] if d < duration]
                for d in fallback_durations:
                    matching_slots = find_slots_for_duration(d)
                    if matching_slots:
                        duration = d  # downgrade duration
                        break
        
            # Pagination logic
            start_idx = (page - 1) * 5
            end_idx = page * 5
            paginated_slots = matching_slots[start_idx:end_idx]
        
            return {
                "slots": paginated_slots,
                "more_available": len(matching_slots) > end_idx,
                "actual_duration": duration
            }

#### C. Auto Pod Assignment + Pricing Logic

1. Check Pod Availability
    1. If both pods free → assign Pod 1
    2. If Pod 1 booked → assign Pod 2
2. Check Pricing Based on User Type From User DB, Payment and Lock integration
    1. If `First Booking Done = No`
        1. Offer FREE slot - “Your first pod booking is FREE, Select confirm to book the Pod”, User selects confirm
        2. Auto-trigger TTLock API with: first 4 digits of the user mobile as pin lock for the assigned duration
        3. Store PIN + slot in Google Sheet
        4. 🎉 Welcome! Pod is Booked.
             📍 Clubhouse – Tata Primanti
             🕒 10:00–12:00
             🔐 Use PIN `XXXX` to unlock (valid during slot)
        5. Update flag in Google Sheet to `Yes` post payment is complete
    2. If Returning User
        1. Payment flow - Use facebook upi https://developers.facebook.com/docs/whatsapp/on-premises/payments-api/upi/ for payment.
        2. Please pay ₹XX to confirm your pod booking: [Payment Link]. After payment, you’ll receive the access PIN
        3. After Payment success, auto-trigger TTLock API with: first 4 digits of the user mobile as pin lock for the assigned duration

#### D. Booking Confirmation & Post-Slot Info

1. Once user confirms or pays:
    1. Return this message:
    2. ✅ Your pod is booked!
         📍 FocusPod – “Pod Address from society DB”
         ⏱ 10:00–12:00
         🔐 Access PIN: XXXX
         You can **enter and exit** multiple times using the same PIN anytime during your booking.
2. Do’s & Don’ts Message (Optional After Confirmation)
    1. 🙌 Pod Guidelines:
         ✅ For work, meetings, calls, study, music
         ✅ Can carry water/coffee
         🧼 Keep it clean | ❌ No food or smoking
         🕒 Please exit after your booking time
    2. 🛟 For support: WhatsApp or call us at +91-XXXXXXXXXX
3. **Use Google Sheets as Single Source of Truth**
    1. Sync user DB, availability, transaction DB, and PIN issuance in real-time
4. Door lock PIN should be set to default as per society DB for all the non-booking times, Only for booking duration PIN should be updated.

#### F. Notification Setup

    1. Send reminder 10 mins before slot.
    2. When 10 mins remaining
    3. Post-booking feedback

