import nodemailer from "nodemailer";

const from = '"Api" <axif.javed@gmail.com>';

function setup() {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        // secure: process.env.EMAIL_SECURE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}
const tranport = setup();


export async function sendConfirmationEmail(user) {
    const email = {
        from,
        to: user.email,
        subject: "Welcome - Verify Email",
        text: `
    Welcome. Please, confirm your email.
    ${user.generateConfirmationUrl()}
    `
    };

    return await tranport.sendMail(email);
}

export async function sendResetPasswordEmail(user) {
    const email = {
        from,
        to: user.email,
        subject: "Reset Password",
        text: `
    To reset password follow this link
    ${user.generateResetPasswordUrl()}
    `
    };

    return await tranport.sendMail(email);
}