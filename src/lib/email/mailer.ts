import nodemailer from "nodemailer";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function sendSignupVerificationCode(email: string, code: string) {
  const port = Number(process.env.SMTP_PORT || "587");
  const transporter = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM?.trim() || required("SMTP_USER"),
    to: email,
    subject: "[HAMS] 회원가입 이메일 인증번호",
    text: `HAMS 회원가입 인증번호는 ${code}입니다. 인증번호는 10분 동안 유효합니다.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>HAMS 이메일 인증</h2><p>회원가입 인증번호입니다.</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>인증번호는 10분 동안 유효합니다.</p></div>`,
  });
}
