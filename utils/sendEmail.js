let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (error) {
    console.warn("nodemailer is not installed. Please run 'npm install nodemailer' if you want emails to work.");
}

/**
 * Configure email gateway credentials via Environment variables.
 * For example, add the following to your .env file:
 * 
 * SMTP_HOST=smtp.mailtrap.io
 * SMTP_PORT=2525
 * SMTP_USER=your_smtp_user
 * SMTP_PASS=your_smtp_password
 * EMAIL_FROM=noreply@yourcompany.com
 */

const sendEmail = async (options) => {
    try {
        if (!nodemailer) {
            console.error("nodemailer is not installed. skipping email.");
            return false;
        }

        // Create a transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email', // fallback or placeholder
            port: process.env.SMTP_PORT || 587,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Define the email options
        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME || 'Offtix HR'} <${process.env.EMAIL_FROM || 'noreply@offtix.com'}>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html // Optional HTML content
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error.message);
        // Note: We swallow or re-throw depending on if we want email failure to block the whole API request
        // For now, we will return false to indicate it failed, but not crash.
        return false;
    }
};

module.exports = sendEmail;
