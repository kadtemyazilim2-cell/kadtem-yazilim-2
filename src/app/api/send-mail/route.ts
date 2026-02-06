import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { smtpConfig, to, subject, text, attachments } = body;

        if (!smtpConfig || !to || !subject || !text) {
            return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: Number(smtpConfig.port),
            secure: smtpConfig.secure, // true for 465, false for other ports
            auth: {
                user: smtpConfig.auth.user,
                pass: smtpConfig.auth.pass,
            },
            tls: {
                rejectUnauthorized: false // Often needed for some servers
            }
        });

        // Verify connection configuration
        await transporter.verify();

        const mailOptions = {
            from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
            to: to,
            subject: subject,
            text: text,
            attachments: attachments ? attachments.map((att: any) => ({
                filename: att.filename,
                content: att.content,
                encoding: 'base64'
            })) : []
        };

        const info = await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, messageId: info.messageId });

    } catch (error: any) {
        console.error('SMTP Hatası:', error);
        return NextResponse.json({ error: 'Mail gönderilemedi: ' + error.message }, { status: 500 });
    }
}
