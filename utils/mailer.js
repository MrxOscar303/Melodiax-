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

// Har email me consistent branding (Melodiax logo + dark header) ke liye
// shared wrapper - taake future me koi naya email template banaye to
// wahan bhi automatically same look mile, alag se dobara likhne ki
// zaroorat na ho.
function brandedEmailWrapper(bodyHtml) {
    const logoUrl = `${process.env.BASE_URL}/assets/m-logo-favicon-source.png`;
    return `
        <div style="background-color:#0a0a0a;padding:32px 16px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <div style="max-width:480px;margin:0 auto;background-color:#121212;border-radius:16px;overflow:hidden;border:1px solid #262626;">
                <div style="background-color:#000000;padding:24px 32px;text-align:center;border-bottom:1px solid #1db954;">
                    <img src="${logoUrl}" alt="Melodiax" width="36" height="36" style="display:inline-block;vertical-align:middle;">
                    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;vertical-align:middle;margin-left:10px;">Melodiax</span>
                </div>
                <div style="padding:32px;">
                    ${bodyHtml}
                </div>
            </div>
        </div>
    `;
}

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
    const html = brandedEmailWrapper(`
        <h2 style="margin:0 0 8px;color:#ffffff;font-size:20px;">Hi ${username},</h2>
        <p style="margin:0 0 20px;color:#b3b3b3;font-size:14px;line-height:1.6;">
            Thanks for creating a Melodiax account! Confirm your email address to get started.
        </p>
        <div style="text-align:center;margin:28px 0;">
            <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#1db954 0%,#14833d 100%);color:#04210f;padding:14px 36px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">
                Verify Email
            </a>
        </div>
        <p style="margin:0 0 6px;color:#777;font-size:12px;">Or paste this link into your browser:</p>
        <p style="margin:0 0 24px;word-break:break-all;">
            <a href="${verifyUrl}" style="color:#1db954;font-size:12px;text-decoration:none;">${verifyUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #262626;margin:0 0 16px;">
        <p style="margin:0;color:#666;font-size:11px;line-height:1.6;">
            This link is valid for 24 hours. If you didn't create this account, you can safely ignore this email.
        </p>
    `);

    const sent = await sendBrevoEmail({
        to,
        subject: 'Verify your email - Melodiax',
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

    const html = brandedEmailWrapper(`
        <h2 style="margin:0 0 16px;color:#ffffff;font-size:18px;">New message from the contact form</h2>
        <p style="margin:0 0 8px;color:#b3b3b3;font-size:14px;"><strong style="color:#fff;">Name:</strong> ${name}</p>
        <p style="margin:0 0 16px;color:#b3b3b3;font-size:14px;"><strong style="color:#fff;">Email:</strong> ${email}</p>
        <p style="margin:0 0 8px;color:#fff;font-size:14px;font-weight:600;">Message:</p>
        <p style="margin:0;color:#b3b3b3;font-size:14px;line-height:1.6;white-space:pre-wrap;background-color:#1c1c1c;border:1px solid #262626;border-radius:8px;padding:14px;">${message}</p>
    `);

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
