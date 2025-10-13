module.exports = async function (context, req) {
  context.log('Email received from Power Automate.');

  const { from, subject, body } = req.body || {};

  if (!from || !subject) {
    context.res = {
      status: 400,
      body: 'Invalid request — missing email details.',
    };
    return;
  }

  // Example: create an automatic reply message
  const reply = `
    Hi ${from},
    Thanks for your email about "${subject}".
    We'll review your message and get back to you soon.
  `;

  // Here you could call another API, store data in SharePoint, etc.
  context.log('Auto reply message:', reply);

  context.res = {
    status: 200,
    body: {
      success: true,
      message: 'Email processed successfully.',
      replyMessage: reply,
    },
  };
};
