// Email bhejne ka helper (Nodemailer). SMTP credentials .env se aate hain -
// koi bhi SMTP provider chalega (Gmail App Password, SendGrid, Mailgun, etc).
// Agar credentials set nahi hain to sirf console mein warning aayegi aur
// verification link console pe print ho jayega (local testing ke liye kaafi hai).

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: Number(process.env.EMAIL_PORT) === 465, // 465 = SSL, 587 = TLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    return transporter;
}

async function sendVerificationEmail(to, username, verifyUrl) {
    const t = getTransporter();

    if (!t) {
        // .env mein EMAIL_* set nahi hai - development ke liye link console
        // mein print kar dete hain taake bina real inbox ke bhi test ho sake.
        console.warn('⚠️  EMAIL_HOST/EMAIL_USER/EMAIL_PASS .env mein set nahi hain.');
        console.warn(`   ${to} ke liye verification link: ${verifyUrl}`);
        return;
    }

    await t.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject: 'Apna email verify karein - Melodiax',
        html: `
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
        `,
    });
}

async function sendContactMessage({ name, email, message }) {
    const t = getTransporter();
    const to = process.env.CONTACT_EMAIL || process.env.EMAIL_USER;

    if (!t || !to) {
        // SMTP configured nahi hai - message console mein print kar dete hain
        // taake abhi bhi kahin dikh jaye (local testing ke liye kaafi hai).
        console.warn('⚠️  EMAIL_HOST/EMAIL_USER/EMAIL_PASS (ya CONTACT_EMAIL) .env mein set nahi hain.');
        console.warn(`   Contact form message from ${name} <${email}>: ${message}`);
        return;
    }

    await t.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        replyTo: email,
        subject: `Melodiax contact form - ${name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
                <h2>New message from the Melodiax contact form</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
            </div>
        `,
    });
}

module.exports = { sendVerificationEmail, sendContactMessage };
