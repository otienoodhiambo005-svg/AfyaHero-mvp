# AfyaHero Bot Integration Documentation

## Overview

This document describes the WhatsApp and USSD bot integration for AfyaHero Hospital OS, built using Africa's Talking API.

## Architecture

### Components

1. **WhatsApp Bot Service** (`src/lib/bot/whatsapp-bot.ts`)
   - Handles incoming WhatsApp messages
   - Sends appointment reminders
   - Sends prescription reminders
   - Sends lab results notifications
   - Processes bot commands

2. **USSD Service** (`src/lib/bot/uussd-service.ts`)
   - Handles USSD menu navigation
   - Provides hospital information
   - Enables appointment booking via USSD
   - Supports prescription viewing
   - Lab results access

3. **Bot Authentication Service** (`src/lib/bot/bot-auth.ts`)
   - Authenticates patients via phone number
   - Manages bot sessions
   - Handles OTP verification
   - Session management and cleanup

4. **Appointment Bot Service** (`src/lib/bot/appointment-bot.ts`)
   - Books appointments via bot
   - Views upcoming appointments
   - Cancels appointments
   - Reschedules appointments

5. **Prescription Bot Service** (`src/lib/bot/prescription-bot.ts`)
   - Sends medication reminders
   - Views active prescriptions
   - Tracks medication adherence
   - Manages reminder schedules

6. **Lab Results Bot Service** (`src/lib/bot/lab-results-bot.ts`)
   - Sends lab results notifications
   - Views recent lab results
   - Provides detailed result information
   - Historical results access

### API Endpoints

#### WhatsApp Webhook
- **POST** `/api/bot/whatsapp/webhook` - Receives incoming WhatsApp messages
- **GET** `/api/bot/whatsapp/webhook` - Webhook verification

#### USSD Webhook
- **POST** `/api/bot/uussd/webhook` - Receives USSD requests
- **GET** `/api/bot/uussd/webhook` - Webhook verification

#### Bot Analytics
- **GET** `/api/admin/bot/analytics` - Bot usage analytics and statistics

## Setup Instructions

### 1. Africa's Talking Account

1. Create an account at [Africa's Talking](https://www.africastalking.com)
2. Enable WhatsApp Business API
3. Enable USSD service
4. Get your API credentials:
   - Username
   - API Key

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
AFRICAS_TALKING_USERNAME=your_username
AFRICAS_TALKING_API_KEY=your_api_key
WHATSAPP_SENDER_ID=AfyaHero
```

### 3. Configure Webhooks

#### WhatsApp Webhook
1. Log in to Africa's Talking dashboard
2. Navigate to WhatsApp → Webhooks
3. Add webhook URL: `https://your-domain.com/api/bot/whatsapp/webhook`
4. Select events: `Message Received`, `Message Delivered`, `Message Failed`

#### USSD Webhook
1. Navigate to USSD → Service Codes
2. Create or update your USSD service code
3. Set callback URL: `https://your-domain.com/api/bot/uussd/webhook`

### 4. Database Schema

The following tables are required (add to Prisma schema):

```prisma
model BotMessage {
  id          String   @id @default(cuid())
  type        String
  platform    String   // 'whatsapp' or 'ussd'
  phoneNumber String
  message     String
  direction   String   // 'inbound' or 'outbound'
  status      String   // 'sent', 'delivered', 'failed'
  timestamp   DateTime @default(now())
  patientId   String?
  patient     Patient? @relation(fields: [patientId], references: [id])
}

model MedicationReminder {
  id            String   @id @default(cuid())
  prescriptionId String
  patientId     String
  reminderTime  String
  phoneNumber   String
  active        Boolean  @default(true)
  lastSent      DateTime?
  prescription  Prescription @relation(fields: [prescriptionId], references: [id])
  patient       Patient @relation(fields: [patientId], references: [id])
}

model MedicationAdherence {
  id             String   @id @default(cuid())
  prescriptionId  String
  patientId      String
  takenAt        DateTime @default(now())
  status         String   // 'TAKEN', 'SKIPPED', 'LATE'
  prescription   Prescription @relation(fields: [prescriptionId], references: [id])
  patient        Patient @relation(fields: [patientId], references: [id])
}

model Patient {
  // Add these fields to existing Patient model
  lastBotActivity DateTime?
  botPreferences  Json?
}
```

## WhatsApp Bot Commands

### Available Commands

- `HELP` - Show help menu
- `APPOINTMENT` - Book/view appointments
- `PRESCRIPTION` - View prescriptions
- `LAB_RESULTS` - Check lab results
- `CONFIRM <ID>` - Confirm appointment
- `RESCHEDULE <ID>` - Reschedule appointment
- `TAKEN <MED>` - Confirm medication taken
- `DETAILS <ID>` - Get lab result details

### Usage Examples

**Book Appointment:**
```
User: APPOINTMENT
Bot: To book an appointment, please provide:
1. Your patient ID or phone number
2. Preferred date (DD/MM/YYYY)
3. Preferred time
4. Doctor name (optional)

User: APPOINTMENT 12345 20/04/2026 10:00 Dr. Smith
Bot: ✅ Appointment Confirmed
```

**View Appointments:**
```
User: APPOINTMENT
Bot: 📅 Your Upcoming Appointments:
• 20/04/2026 at 10:00 - Dr. Smith
• 25/04/2026 at 14:00 - Dr. Johnson
```

**Medication Reminder:**
```
Bot: Hello John, this is a medication reminder. Please take Amoxicillin (500mg) 3x daily.
User: TAKEN
Bot: ✅ Medication Recorded
```

## USSD Menu Structure

### Main Menu
```
Welcome to AfyaHero Hospital OS
1. Appointments
2. My Prescriptions
3. Lab Results
4. Medical Records
5. Hospital Info
6. Emergency
```

### Submenus

**Appointments:**
1. Book Appointment
2. View Upcoming
3. Cancel Appointment

**Prescriptions:**
1. View Active Prescriptions
2. Medication Reminders

**Lab Results:**
1. View Recent Results
2. Result History

**Medical Records:**
1. View Summary
2. Request Records

**Hospital Info:**
1. Departments
2. Doctors
3. Services
4. Location & Hours

**Emergency:**
1. Call Emergency
2. Report Emergency

## Features

### Appointment Booking
- Book appointments via WhatsApp or USSD
- View upcoming appointments
- Cancel appointments
- Reschedule appointments
- Automatic reminders 24 hours before

### Prescription Management
- View active prescriptions
- Set up medication reminders
- Track medication adherence
- Automatic reminder notifications

### Lab Results
- Receive lab result notifications
- View recent results
- Access detailed result information
- Historical results access

### Authentication
- Patient authentication via phone number
- OTP verification for security
- Session management
- Automatic session cleanup

## Security Considerations

1. **Webhook Verification**
   - Verify webhook signatures
   - Validate incoming requests
   - Rate limiting

2. **Patient Privacy**
   - Only send results to verified patients
   - Mask sensitive information
   - Audit logging

3. **Session Management**
   - Session timeout (30 minutes)
   - Automatic cleanup
   - Secure session storage

4. **API Keys**
   - Store in secrets manager
   - Regular rotation
   - Environment-specific keys

## Monitoring

### Analytics Dashboard

Access the bot analytics dashboard at:
`/portal/admin/bot-analytics`

Metrics tracked:
- Total messages sent/received
- WhatsApp vs USSD usage
- Active users
- Appointments booked via bot
- Prescriptions viewed
- Lab results viewed
- Recent activity log

### Logging

All bot interactions are logged with:
- Timestamp
- Phone number (masked)
- Message type
- Platform
- Status

## Troubleshooting

### Webhook Not Receiving Messages

1. Check webhook URL is accessible
2. Verify Africa's Talking webhook configuration
3. Check server logs for errors
4. Verify API credentials

### Messages Not Sending

1. Check API key validity
2. Verify account balance
3. Check phone number format
4. Review error logs

### USSD Menu Not Working

1. Verify service code configuration
2. Check callback URL
3. Test menu navigation
4. Review session logs

## Testing

### Manual Testing

**WhatsApp:**
1. Send test message to your WhatsApp number
2. Verify webhook receives message
3. Test each command
4. Verify responses

**USSD:**
1. Dial your USSD service code
2. Navigate through menus
3. Test each feature
4. Verify responses

### Automated Testing

Run bot tests:
```bash
npm run test:bot
```

## Cost Considerations

### Africa's Talking Pricing

- **WhatsApp**: ~$0.005 per message
- **USSD**: ~$0.01 per session
- **SMS** (fallback): ~$0.01 per message

### Estimated Monthly Costs

For 1,000 active patients:
- WhatsApp messages: ~500 messages/day = $75/month
- USSD sessions: ~200 sessions/day = $60/month
- **Total**: ~$135/month

## Future Enhancements

- [ ] Multi-language support
- [ ] Voice bot integration
- [ ] Image-based results (WhatsApp)
- [ ] Payment via bot
- [ ] Insurance verification
- [ ] Video consultation scheduling
- [ ] Symptom checker
- [ ] Health tips and education

## Support

For issues related to:
- **Bot Integration**: Contact DevOps team
- **Africa's Talking API**: [Support Portal](https://support.africastalking.com)
- **Database Issues**: Contact Backend team
- **Patient Data**: Contact Compliance team

## References

- [Africa's Talking Documentation](https://developers.africastalking.com)
- [WhatsApp Business API](https://developers.facebook.com/whatsapp)
- [USSD Best Practices](https://www.gsma.com/ussd/)
