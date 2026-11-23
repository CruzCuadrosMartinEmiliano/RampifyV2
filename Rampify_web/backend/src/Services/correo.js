// Envío de correos por la API HTTPS de Brevo (Render bloquea SMTP en el plan gratis).
// Variables: BREVO_API_KEY, MAIL_FROM_EMAIL (remitente verificado en Brevo) y MAIL_FROM_NAME (opcional).
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const escHtml = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function enviar({ to, bcc, subject, text, html }) {
  if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM_EMAIL) {
    throw new Error('Correo no configurado: faltan BREVO_API_KEY o MAIL_FROM_EMAIL');
  }
  const cuerpo = {
    sender: { name: process.env.MAIL_FROM_NAME || 'Rampify', email: process.env.MAIL_FROM_EMAIL },
    to: [].concat(to).map((email) => ({ email })),
    subject, textContent: text, htmlContent: html,
  };
  if (bcc && bcc.length) cuerpo.bcc = [].concat(bcc).map((email) => ({ email }));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) throw new Error(`Brevo respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } finally { clearTimeout(timer); }
}

async function enviarCodigoRecuperacion(destino, codigo) {
  await enviar({
    to: destino, subject: 'Tu código de verificación de Rampify',
    text: `Tu código de verificación es ${codigo}. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.`,
    html: `<p>Tu código de verificación es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${escHtml(codigo)}</p>
           <p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
  });
}
// RF_17: código de 6 dígitos para confirmar el nuevo correo (se envía al correo NUEVO)
async function enviarCodigoCorreo(destino, codigo) {
  await enviar({
    to: destino, subject: 'Confirma tu nuevo correo en Rampify',
    text: `Tu código para confirmar el nuevo correo es ${codigo}. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.`,
    html: `<p>Tu código para confirmar el nuevo correo es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${escHtml(codigo)}</p>
           <p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
  });
}
async function enviarDecisionEmpleado(destino, aprobada, motivo) {
  const asunto = aprobada ? 'Tu cuenta de Rampify fue aprobada' : 'Tu solicitud de acceso a Rampify fue rechazada';
  const texto = aprobada ? 'Tu solicitud fue aprobada. Ya puedes iniciar sesión en la plataforma web de Rampify.'
                         : `Tu solicitud de acceso no fue aprobada. Motivo: ${motivo}`;
  await enviar({ to: destino, subject: asunto, text: texto, html: `<p>${escHtml(texto)}</p>` });
}
async function enviarInvitacionAdmin(destino, enlace, invitador) {
  const texto = `${invitador} te invitó a ser Administrador del sistema de Rampify. Completa tu registro en este enlace (un solo uso, vence en 24 horas): ${enlace}`;
  await enviar({
    to: destino, subject: 'Invitación para administrar Rampify', text: texto,
    html: `<p>${escHtml(invitador)} te invitó a ser <b>Administrador del sistema</b> de Rampify.</p><p><a href="${enlace}">Completar mi registro</a></p><p>El enlace es de un solo uso y vence en 24 horas.</p>`,
  });
}
async function enviarAvisoInvitacion(destinos, invitador, correoInvitado) {
  const texto = `${invitador} invitó a ${correoInvitado} a ser Administrador del sistema.`;
  // Brevo exige al menos un "to": se usa el propio remitente y los administradores van en copia oculta
  await enviar({ to: process.env.MAIL_FROM_EMAIL, bcc: destinos, subject: 'Nueva invitación de administrador en Rampify', text: texto, html: `<p>${escHtml(texto)}</p>` });
}
module.exports = { enviarCodigoRecuperacion, enviarCodigoCorreo, enviarDecisionEmpleado, enviarInvitacionAdmin, enviarAvisoInvitacion };