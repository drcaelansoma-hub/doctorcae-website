/**
 * 5-email nurture sequence (Resend). Server-only.
 * Env: RESEND_API_KEY, RESEND_FROM
 * Optional: FREE_GUIDE_DOWNLOAD_URL (PDF), FREE_GUIDE_THANK_YOU_URL (defaults to doctorcae.com paths)
 */
const { Resend } = require('resend');

const LOG = '[nurture-emails]';

/** Public URLs for Email 1 download line (override PDF via FREE_GUIDE_DOWNLOAD_URL in Vercel). */
function thankYouPageUrl() {
  var u = String(process.env.FREE_GUIDE_THANK_YOU_URL || '').trim();
  if (u) return u;
  return 'https://doctorcae.com/free-guide/thank-you';
}

function guidePdfUrl() {
  var u = String(process.env.FREE_GUIDE_DOWNLOAD_URL || '').trim();
  if (u) return u;
  return 'https://doctorcae.com/free-guide/body-first-framework-guide.pdf';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayName(firstName) {
  var n = String(firstName || '').trim();
  return n || 'there';
}

function getResend() {
  var key = String(process.env.RESEND_API_KEY || '').trim();
  var from = String(process.env.RESEND_FROM || '').trim();
  if (!key || !from) return null;
  return { client: new Resend(key), from: from };
}

async function sendWithResend(toEmail, subject, text, html) {
  var bundle = getResend();
  if (!bundle) {
    console.error(LOG, 'missing RESEND_API_KEY or RESEND_FROM');
    return { ok: false, error: 'Email not configured' };
  }
  try {
    var sent = await bundle.client.emails.send({
      from: bundle.from,
      to: toEmail,
      subject: subject,
      text: text,
      html: html,
    });
    if (sent.error) {
      console.error(LOG, 'Resend error', sent.error);
      return { ok: false, error: String(sent.error.message || sent.error) };
    }
    return { ok: true };
  } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    console.error(LOG, 'send exception', msg);
    return { ok: false, error: msg };
  }
}

/** Email 1 — immediate on signup */
function contentEmail1(name) {
  var n = displayName(name);
  var subject = "You're not doing it wrong";
  var text = [
    'Hi ' + n + ',',
    '',
    "I'm really glad you're here.",
    '',
    'Parenting big emotions can feel exhausting, especially when what used to work suddenly… doesn't.',
    '',
    "If you've ever found yourself thinking:",
    '"Why isn't this working anymore?"',
    'or',
    '"Am I doing something wrong?"',
    '',
    "You're not.",
    '',
    "What many parents aren't told is this:",
    '',
    "Emotional overwhelm doesn't start in the thinking brain.",
    'It starts in the body.',
    '',
    "And when a child's nervous system is overwhelmed, they literally cannot access the skills we're asking them to use.",
    '',
    "That's why reasoning, consequences, and even calm explanations can fall flat in the moment.",
    '',
    'Inside the guide, I walk you through:',
    "- what's actually happening underneath behavior",
    "- why your child isn't giving you a hard time (they're having a hard time)",
    '- where to begin instead',
    '',
    "You don't have to change everything at once.",
    '',
    'Just start noticing.',
    '',
    'Download your guide (PDF) here: ' + guidePdfUrl(),
    'Or open your thank-you page anytime: ' + thankYouPageUrl(),
    '',
    'Read more on the landing page: https://doctorcae.com/guide',
    '',
    "I'm so glad you're here.",
    '',
    'Dr. Cae',
  ].join('\n');

  var html =
    '<p>Hi ' +
    escapeHtml(n) +
    ',</p>' +
    "<p>I'm really glad you're here.</p>" +
    '<p>Parenting big emotions can feel exhausting, especially when what used to work suddenly… doesn&rsquo;t.</p>' +
    '<p>If you&rsquo;ve ever found yourself thinking:<br>&ldquo;Why isn&rsquo;t this working anymore?&rdquo;<br>or<br>&ldquo;Am I doing something wrong?&rdquo;</p>' +
    "<p>You&rsquo;re not.</p>" +
    "<p>What many parents aren&rsquo;t told is this:</p>" +
    '<p>Emotional overwhelm doesn&rsquo;t start in the thinking brain.<br>It starts in the body.</p>' +
    '<p>And when a child&rsquo;s nervous system is overwhelmed, they literally cannot access the skills we&rsquo;re asking them to use.</p>' +
    '<p>That&rsquo;s why reasoning, consequences, and even calm explanations can fall flat in the moment.</p>' +
    '<p>Inside the guide, I walk you through:</p>' +
    '<ul>' +
    '<li>what&rsquo;s actually happening underneath behavior</li>' +
    '<li>why your child isn&rsquo;t giving you a hard time (they&rsquo;re having a hard time)</li>' +
    '<li>where to begin instead</li>' +
    '</ul>' +
    "<p>You don&rsquo;t have to change everything at once.</p>" +
    '<p>Just start noticing.</p>' +
    '<p><strong>Your guide:</strong><br />' +
    '<a href="' +
    escapeHtml(guidePdfUrl()) +
    '">Download the PDF</a> &middot; ' +
    '<a href="' +
    escapeHtml(thankYouPageUrl()) +
    '">Open the thank-you page</a></p>' +
    '<p><a href="https://doctorcae.com/guide">https://doctorcae.com/guide</a></p>' +
    "<p>I'm so glad you're here.</p>" +
    '<p>Dr. Cae</p>';

  return { subject: subject, text: text, html: html };
}

function contentEmail2(name) {
  var n = displayName(name);
  var subject = 'When nothing seems to work';
  var text = [
    'Hi ' + n + ',',
    '',
    'One of the most common things I hear from parents is:',
    '',
    '"I\'ve tried everything… and nothing works."',
    '',
    'And I believe you.',
    '',
    'Because if we\'re only looking at behavior, it can feel confusing and frustrating.',
    '',
    'But when we shift the lens just slightly, something important becomes clearer:',
    '',
    "It's not defiance.",
    "It's dysregulation.",
    '',
    'For example, think about the after-school meltdown.',
    '',
    'Your child walks in, drops their bag, and suddenly everything escalates over something small.',
    '',
    'From the outside, it can look like overreacting.',
    '',
    'But underneath?',
    '',
    "Their nervous system has been working all day to hold it together.",
    '',
    "By the time they get home, there's nothing left to keep it contained.",
    '',
    "That's why one of the most powerful shifts you can make is this:",
    '',
    'Instead of asking questions right away,',
    'start by noticing the body.',
    '',
    '"I\'m noticing your shoulders look really tight."',
    '"That was a long day, huh?"',
    '',
    'This is where regulation begins.',
    '',
    "You don't have to fix it.",
    'Just start there.',
    '',
    'Dr. Cae',
  ].join('\n');

  var html =
    '<p>Hi ' +
    escapeHtml(n) +
    ',</p>' +
    '<p>One of the most common things I hear from parents is:</p>' +
    '<p>&ldquo;I&rsquo;ve tried everything… and nothing works.&rdquo;</p>' +
    '<p>And I believe you.</p>' +
    '<p>Because if we&rsquo;re only looking at behavior, it can feel confusing and frustrating.</p>' +
    '<p>But when we shift the lens just slightly, something important becomes clearer:</p>' +
    '<p>It&rsquo;s not defiance.<br>It&rsquo;s dysregulation.</p>' +
    '<p>For example, think about the after-school meltdown.</p>' +
    '<p>Your child walks in, drops their bag, and suddenly everything escalates over something small.</p>' +
    '<p>From the outside, it can look like overreacting.</p>' +
    '<p>But underneath?</p>' +
    '<p>Their nervous system has been working all day to hold it together.</p>' +
    '<p>By the time they get home, there&rsquo;s nothing left to keep it contained.</p>' +
    '<p>That&rsquo;s why one of the most powerful shifts you can make is this:</p>' +
    '<p>Instead of asking questions right away,<br>start by noticing the body.</p>' +
    '<p>&ldquo;I&rsquo;m noticing your shoulders look really tight.&rdquo;<br>&ldquo;That was a long day, huh?&rdquo;</p>' +
    '<p>This is where regulation begins.</p>' +
    "<p>You don't have to fix it.<br>Just start there.</p>" +
    '<p>Dr. Cae</p>';

  return { subject: subject, text: text, html: html };
}

function contentEmail3(name) {
  var n = displayName(name);
  var subject = 'Why consequences fall apart in the moment';
  var text = [
    'Hi ' + n + ',',
    '',
    'Have you ever noticed that the more dysregulated your child becomes,',
    'the less anything you say seems to land?',
    '',
    "There's a reason for that.",
    '',
    'When the nervous system moves into a stress response (fight, flight, freeze),',
    'the thinking part of the brain goes offline.',
    '',
    'So even if your child *knows* the rule…',
    "even if you've explained it a hundred times…",
    '',
    "They can't access it in that moment.",
    '',
    'This is why consequences often fall apart during emotional overwhelm.',
    '',
    "Not because you're doing it wrong.",
    "But because the brain isn't available for learning right then.",
    '',
    'Regulation has to come first.',
    '',
    'Then comes reflection.',
    'Then comes teaching.',
    '',
    "It's a different order than many of us were taught.",
    '',
    'But it changes everything.',
    '',
    'Dr. Cae',
  ].join('\n');

  var html =
    '<p>Hi ' +
    escapeHtml(n) +
    ',</p>' +
    '<p>Have you ever noticed that the more dysregulated your child becomes,<br>the less anything you say seems to land?</p>' +
    "<p>There's a reason for that.</p>" +
    '<p>When the nervous system moves into a stress response (fight, flight, freeze),<br>the thinking part of the brain goes offline.</p>' +
    '<p>So even if your child <em>knows</em> the rule…<br>even if you&rsquo;ve explained it a hundred times…</p>' +
    "<p>They can't access it in that moment.</p>" +
    '<p>This is why consequences often fall apart during emotional overwhelm.</p>' +
    "<p>Not because you're doing it wrong.<br>But because the brain isn't available for learning right then.</p>" +
    '<p>Regulation has to come first.</p>' +
    '<p>Then comes reflection.<br>Then comes teaching.</p>' +
    "<p>It's a different order than many of us were taught.</p>" +
    '<p>But it changes everything.</p>' +
    '<p>Dr. Cae</p>';

  return { subject: subject, text: text, html: html };
}

function contentEmail4(name) {
  var n = displayName(name);
  var subject = 'What actually helps in the moment';
  var text = [
    'Hi ' + n + ',',
    '',
    'When a child is overwhelmed, the goal is not to correct the behavior right away.',
    '',
    'The goal is to help their nervous system settle.',
    '',
    'This is where co-regulation comes in.',
    '',
    "And it doesn't have to be complicated.",
    '',
    'Sometimes it sounds like:',
    '',
    '"I\'m right here."',
    '"Your body is having a hard time."',
    '"We\'ll figure this out together."',
    '',
    'These moments of connection are what help the nervous system feel safe enough to come back down.',
    '',
    'And once that happens…',
    '',
    "That's when learning becomes possible again.",
    '',
    "This doesn't mean there are no boundaries.",
    '',
    'It just means we are thoughtful about *when* we teach and *how* we support.',
    '',
    'This is the foundation of everything I do with families.',
    '',
    'Dr. Cae',
  ].join('\n');

  var html =
    '<p>Hi ' +
    escapeHtml(n) +
    ',</p>' +
    '<p>When a child is overwhelmed, the goal is not to correct the behavior right away.</p>' +
    '<p>The goal is to help their nervous system settle.</p>' +
    '<p>This is where co-regulation comes in.</p>' +
    "<p>And it doesn't have to be complicated.</p>" +
    '<p>Sometimes it sounds like:</p>' +
    '<p>&ldquo;I&rsquo;m right here.&rdquo;<br>&ldquo;Your body is having a hard time.&rdquo;<br>&ldquo;We&rsquo;ll figure this out together.&rdquo;</p>' +
    '<p>These moments of connection are what help the nervous system feel safe enough to come back down.</p>' +
    '<p>And once that happens…</p>' +
    "<p>That's when learning becomes possible again.</p>" +
    "<p>This doesn't mean there are no boundaries.</p>" +
    '<p>It just means we are thoughtful about <em>when</em> we teach and <em>how</em> we support.</p>' +
    '<p>This is the foundation of everything I do with families.</p>' +
    '<p>Dr. Cae</p>';

  return { subject: subject, text: text, html: html };
}

function contentEmail5(name) {
  var n = displayName(name);
  var subject = 'A different way to think about parenting big feelings';
  var courseUrl =
    'https://guide.doctorcae.com/body-first-framework-7-steps-to-help-kids-and-teens-regulate-emotions-and-behavior';
  var text = [
    'Hi ' + n + ',',
    '',
    'Over time, I began to notice something:',
    '',
    "The parents who felt more confident weren't doing more.",
    '',
    'They were doing things in a different order.',
    '',
    'They were starting with the body first.',
    '',
    'This became what I now call the Body First Framework.',
    '',
    'A simple way to think about it:',
    '',
    'Start with the body',
    'Notice stress signals early',
    'Support regulation',
    'Teach after calm',
    '',
    "It's not about being perfect.",
    '',
    "It's about having a roadmap when things feel overwhelming.",
    '',
    "If you're wanting more structure and step-by-step support,",
    'this is exactly what I walk through inside my course.',
    '',
    courseUrl,
    '',
    '',
    "You're doing more right than you think.",
    '',
    'Dr. Cae',
  ].join('\n');

  var html =
    '<p>Hi ' +
    escapeHtml(n) +
    ',</p>' +
    '<p>Over time, I began to notice something:</p>' +
    "<p>The parents who felt more confident weren't doing more.</p>" +
    '<p>They were doing things in a different order.</p>' +
    '<p>They were starting with the body first.</p>' +
    '<p>This became what I now call the Body First Framework.</p>' +
    '<p>A simple way to think about it:</p>' +
    '<p>Start with the body<br>Notice stress signals early<br>Support regulation<br>Teach after calm</p>' +
    "<p>It's not about being perfect.</p>" +
    "<p>It's about having a roadmap when things feel overwhelming.</p>" +
    "<p>If you're wanting more structure and step-by-step support,<br>this is exactly what I walk through inside my course.</p>" +
    '<p><a href="' +
    escapeHtml(courseUrl) +
    '">' +
    escapeHtml(courseUrl) +
    '</a></p>' +
    '<p>&nbsp;</p>' +
    "<p>You're doing more right than you think.</p>" +
    '<p>Dr. Cae</p>';

  return { subject: subject, text: text, html: html };
}

async function sendEmailStep1(name, email) {
  var c = contentEmail1(name);
  return sendWithResend(email, c.subject, c.text, c.html);
}

async function sendEmailStep2(name, email) {
  var c = contentEmail2(name);
  return sendWithResend(email, c.subject, c.text, c.html);
}

async function sendEmailStep3(name, email) {
  var c = contentEmail3(name);
  return sendWithResend(email, c.subject, c.text, c.html);
}

async function sendEmailStep4(name, email) {
  var c = contentEmail4(name);
  return sendWithResend(email, c.subject, c.text, c.html);
}

async function sendEmailStep5(name, email) {
  var c = contentEmail5(name);
  return sendWithResend(email, c.subject, c.text, c.html);
}

module.exports = {
  sendEmailStep1,
  sendEmailStep2,
  sendEmailStep3,
  sendEmailStep4,
  sendEmailStep5,
  displayName,
};
