import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const EMAIL_USER = requireEnv("EMAIL_USER");
const EMAIL_PASSWORD = requireEnv("EMAIL_PASSWORD");

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  const mailOptions = {
    from: `Bottled Bloom <${EMAIL_USER}>`,
    to,
    subject,
    html,
  };
  await transporter.sendMail(mailOptions);
};
