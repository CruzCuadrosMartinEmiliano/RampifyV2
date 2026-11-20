const nodemailer = require('nodemailer');

const transporte = nodemailer.createTransport({
  host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT) || 465, secure: Number(process.env.MAIL_PORT) !== 587,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

async function enviarCodigoRecuperacion(destino, codigo) {
  await transporte.sendMail({
    from: process.env.MAIL_FROM, to: destino, subject: 'Tu código de verificación de Rampify',
    text: `Tu código de verificación es ${codigo}. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.`,
    html: `<p>Tu código de verificación es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>
           <p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
  });
}
// RF_17: código de 6 dígitos para confirmar el nuevo correo (se envía al correo NUEVO)
async function enviarCodigoCorreo(destino, codigo) {
  await transporte.sendMail({
    from: process.env.MAIL_FROM, to: destino, subject: 'Confirma tu nuevo correo en Rampify',
    text: `Tu código para confirmar el nuevo correo es ${codigo}. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.`,
    html: `<p>Tu código para confirmar el nuevo correo es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>
           <p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
  });
}
async function enviarDecisionEmpleado(destino, aprobada, motivo) {
  const asunto = aprobada ? 'Tu cuenta de Rampify fue aprobada' : 'Tu solicitud de acceso a Rampify fue rechazada';
  const texto = aprobada ? 'Tu solicitud fue aprobada. Ya puedes iniciar sesión en la plataforma web de Rampify.'
                         : `Tu solicitud de acceso no fue aprobada. Motivo: ${motivo}`;
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  await transporte.sendMail({ from: process.env.MAIL_FROM, to: destino, subject: asunto, text: texto, html: `<p>${esc(texto)}</p>` });
}
const escHtml = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function enviarInvitacionAdmin(destino, enlace, invitador) {
  const texto = `${invitador} te invitó a ser Administrador del sistema de Rampify. Completa tu registro en este enlace (un solo uso, vence en 24 horas): ${enlace}`;
  await transporte.sendMail({ from: process.env.MAIL_FROM, to: destino, subject: 'Invitación para administrar Rampify', text: texto,
    html: `<p>${escHtml(invitador)} te invitó a ser <b>Administrador del sistema</b> de Rampify.</p><p><a href="${enlace}">Completar mi registro</a></p><p>El enlace es de un solo uso y vence en 24 horas.</p>` });
}
async function enviarAvisoInvitacion(destinos, invitador, correoInvitado) {
  const texto = `${invitador} invitó a ${correoInvitado} a ser Administrador del sistema.`;
  await transporte.sendMail({ from: process.env.MAIL_FROM, bcc: destinos, subject: 'Nueva invitación de administrador en Rampify', text: texto, html: `<p>${escHtml(texto)}</p>` });
}
module.exports = { enviarCodigoRecuperacion, enviarCodigoCorreo, enviarDecisionEmpleado, enviarInvitacionAdmin, enviarAvisoInvitacion };