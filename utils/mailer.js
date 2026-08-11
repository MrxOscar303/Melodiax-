// Email bhejne ka helper - Brevo (Sendinblue) ke HTTP API se bhejta hai.
// Render jaise platforms outgoing SMTP ports (25/465/587) block kar dete
// hain (spam-prevention), isliye raw SMTP (nodemailer) fail ho jata hai.
// Brevo ka HTTP API HTTPS (port 443) use karta hai, jo block nahi hota.
//
// .env / Render env vars mein zaroori:
//   BREVO_API_KEY   - Brevo dashboard > SMTP & API > API Keys se milegi
//   EMAIL_FROM      - Brevo mein verify kiya hua sender email
//   CONTACT_EMAIL   - jahan contact-form messages jayenge (optional, warna EMAIL_FROM use hoga)
//
// Agar BREVO_API_KEY set nahi hai to sirf console mein warning aayegi aur
// message console pe print ho jayega (local testing ke liye kaafi hai).

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendBrevoEmail({ to, subject, html, replyTo }) {
    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.EMAIL_FROM;

    if (!apiKey || !fromEmail) {
        return false; // caller decides fallback behaviour
    }

    const payload = {
        sender: { email: fromEmail, name: 'Melodiax' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
    };
    if (replyTo) payload.replyTo = { email: replyTo };

    const res = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Brevo API error (${res.status}): ${errText}`);
    }
    return true;
}

async function sendVerificationEmail(to, username, verifyUrl) {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2>Hi ${username},</h2>
            <p>Melodiax par account banane ka shukriya! Neeche diye button par click karke apna email verify karein:</p>
            <p style="margin: 24px 0;">
                <a href="${verifyUrl}" style="background:#1db954;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    Email Verify Karein
                </a>
            </p>
            <p>Ya ye link browser mein paste karein:<br>${verifyUrl}</p>
            <p style="color:#888;font-size:12px;">Ye link 24 ghante ke liye valid hai. Agar aapne ye account nahi banaya to is email ko ignore karein.</p>
        </div>
    `;

    const sent = await sendBrevoEmail({
        to,
        subject: 'Apna email verify karein - Melodiax',
        html,
    });

    if (!sent) {
        console.warn('⚠️  BREVO_API_KEY/EMAIL_FROM .env mein set nahi hain.');
        console.warn(`   ${to} ke liye verification link: ${verifyUrl}`);
    }
}

async function sendContactMessage({ name, email, message }) {
    const to = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM;

    if (!to) {
        console.warn('⚠️  CONTACT_EMAIL (ya EMAIL_FROM) .env mein set nahi hai.');
        console.warn(`   Contact form message from ${name} <${email}>: ${message}`);
        return;
    }

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2>New message from the Melodiax contact form</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
        </div>
    `;

    const sent = await sendBrevoEmail({
        to,
        subject: `Melodiax contact form - ${name}`,
        html,
        replyTo: email,
    });

    if (!sent) {
        console.warn('⚠️  BREVO_API_KEY/EMAIL_FROM .env mein set nahi hain.');
        console.warn(`   Contact form message from ${name} <${email}>: ${message}`);
    }
}

module.exports = { sendVerificationEmail, sendContactMessage };
