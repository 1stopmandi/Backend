const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';

function formatE164(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') ? `+${digits}` : `+91${digits}`;
}

async function sendOtpSms(phone, code) {
  if (SMS_PROVIDER === 'mock') {
    console.log(`[MOCK SMS] OTP for ${phone}: ${code}`);
    return true;
  }

  if (SMS_PROVIDER === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[Twilio] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER');
      throw new Error('SMS configuration error. Please contact support.');
    }

    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);
    const to = formatE164(phone);

    const message = `Your 1StopMandi OTP is: ${code}. Valid for 10 minutes. Do not share.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to,
    });

    return true;
  }

  if (SMS_PROVIDER === 'msg91') {
    console.log(`[MSG91] Not implemented - OTP for ${phone}: ${code}`);
    return true;
  }

  console.log(`[MOCK SMS] OTP for ${phone}: ${code} (provider ${SMS_PROVIDER} not implemented)`);
  return true;
}

module.exports = { sendOtpSms };
