/**
 * Maya Collections Voicebot - Interactive Frontend Simulator & Hub
 * Connects directly to local Node.js mock-server /webhook
 */

let callActive = false;
let callDuration = 0;
let timerInterval = null;
let currentStage = 1; // 1: Auth, 2: Disclosure, 3: Negotiation, 4: Wrapup
let isCustomerVerified = false;

// Global settings state representing the "CRM database records" for target borrower
let customerAccount = {
  account_id: 'ACC-88392',
  name: 'Rahul Sharma',
  phone: '+91 98765 43210',
  verification_code: '1234',
  balance: 8499.0,
  dueDate: '2026-08-03',
  paymentMethod: 'Digital Wallet'
};

// Analytics Data State
let analyticsData = {
  callsDialed: 0,
  totalPtpRecovered: 0,
  dispositions: {
    PTP_AGREED: 0,
    ALREADY_PAID: 0,
    DISPUTED: 0,
    HARDSHIP_ESCALATED: 0,
    WRONG_PERSON: 0,
    DO_NOT_CALL: 0,
    NO_RESPONSE: 0
  }
};

let activeCallDisposition = 'NO_RESPONSE';
let callHistory = [];

const synth = window.speechSynthesis;
let enableTTS = true;

// Web Speech Recognition
let recognition = null;
let isRecording = false;

// DOM Elements
const loginGateEl = document.getElementById('loginGate');
const userProfileEl = document.getElementById('userProfile');
const userAvatarEl = document.getElementById('userAvatar');
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const authFormEl = document.getElementById('authForm');
const authSubmitBtnEl = document.getElementById('authSubmitBtn');
const tabLoginEl = document.getElementById('tabLogin');
const tabSignupEl = document.getElementById('tabSignup');

const callTimerEl = document.getElementById('callTimer');
const transcriptFeedEl = document.getElementById('transcriptFeed');
const toolFeedEl = document.getElementById('toolFeed');
const voiceWaveEl = document.getElementById('voiceWave');
const userInputEl = document.getElementById('userInput');
const chipContainerEl = document.getElementById('chipContainer');
const authStatusBadgeEl = document.getElementById('authStatusBadge');
const accStatusTextEl = document.getElementById('accStatusText');
const accBalanceEl = document.getElementById('accBalance');
const accDueDateEl = document.getElementById('accDueDate');
const stepProgressFillEl = document.getElementById('stepProgressFill');
const toggleTtsCb = document.getElementById('toggleTts');
const micBtnEl = document.getElementById('micBtn');
const micStatusEl = document.getElementById('micStatus');

// Profile Editor display fields
const editCustNameEl = document.getElementById('editCustName');
const editCustPhoneEl = document.getElementById('editCustPhone');
const editAccIdEl = document.getElementById('editAccId');
const editCustPinEl = document.getElementById('editCustPin');
const editBalanceEl = document.getElementById('editBalance');
const editDueDateEl = document.getElementById('editDueDate');

const dispAccountIdEl = document.getElementById('dispAccountId');
const dispCustomerNameEl = document.getElementById('dispCustomerName');
const dispCustomerPhoneEl = document.getElementById('dispCustomerPhone');

// Analytics display fields
const statCallCountEl = document.getElementById('statCallCount');
const statRecoveryEl = document.getElementById('statRecovery');
const analyticsChartCanvas = document.getElementById('analyticsChart');

// Initialize Web Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRec();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecording = true;
    micBtnEl.classList.add('recording');
    micStatusEl.style.display = 'block';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInputEl.value = transcript;
    handleSendMessage();
  };

  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e);
    stopMic();
  };

  recognition.onend = () => {
    stopMic();
  };
} else {
  micBtnEl.style.display = 'none'; // Speech recognition not supported in browser
}

function stopMic() {
  isRecording = false;
  micBtnEl.classList.remove('recording');
  micStatusEl.style.display = 'none';
  if (recognition) recognition.stop();
}

function toggleMicrophone() {
  if (!callActive) {
    alert('Please start the outbound call first by clicking the green 📞 phone button.');
    return;
  }
  if (isRecording) {
    stopMic();
  } else {
    try {
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start issue:', err);
    }
  }
}

// Session Check
let authTab = 'login';
function checkSession() {
  const user = localStorage.getItem('kapture_user');
  if (user) {
    const userData = JSON.parse(user);
    loginGateEl.style.display = 'none';
    userProfileEl.style.display = 'flex';
    userAvatarEl.src = userData.picture || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    userNameEl.innerText = userData.name;
    userEmailEl.innerText = userData.email;
  } else {
    loginGateEl.style.display = 'flex';
    userProfileEl.style.display = 'none';
  }
}

function switchAuthTab(tab) {
  authTab = tab;
  if (tab === 'login') {
    tabLoginEl.classList.add('active');
    tabSignupEl.classList.remove('active');
    authSubmitBtnEl.innerText = 'Continue with Email';
  } else {
    tabLoginEl.classList.remove('active');
    tabSignupEl.classList.add('active');
    authSubmitBtnEl.innerText = 'Register & Create Account';
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const dummyUser = {
    name: email.split('@')[0],
    email: email,
    picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
  };
  localStorage.setItem('kapture_user', JSON.stringify(dummyUser));
  checkSession();
}

function handleGoogleSignIn() {
  const googleBtn = document.querySelector('.btn-google-auth');
  if (!googleBtn) return;
  const originalContent = googleBtn.innerHTML;
  
  googleBtn.disabled = true;
  googleBtn.innerHTML = `
    <div style="border: 2px solid #4b5563; border-top: 2px solid #3b82f6; border-radius: 50%; width: 16px; height: 16px; animation: spin 0.8s linear infinite; display: inline-block;"></div>
    <span style="color: #4b5563; font-weight: 500;">Signing in...</span>
  `;

  setTimeout(() => {
    const mockUser = {
      name: "Alex Mercer",
      email: "alex.mercer@kapturefinance.com",
      picture: "https://lh3.googleusercontent.com/a/default-user=s96-c"
    };
    localStorage.setItem('kapture_user', JSON.stringify(mockUser));
    checkSession();
    
    // Restore button state
    googleBtn.disabled = false;
    googleBtn.innerHTML = originalContent;
  }, 1000);
}

function handleSignOut() {
  localStorage.removeItem('kapture_user');
  checkSession();
}

// Database Editor synchronizer
function syncDatabaseDetails() {
  if (!editCustNameEl || !editAccIdEl || !editCustPinEl || !editBalanceEl || !editDueDateEl) return;

  customerAccount.name = editCustNameEl.value;
  customerAccount.account_id = editAccIdEl.value;
  customerAccount.verification_code = editCustPinEl.value;
  customerAccount.balance = parseFloat(editBalanceEl.value) || 0;
  customerAccount.dueDate = editDueDateEl.value;
  if (editCustPhoneEl) customerAccount.phone = editCustPhoneEl.value;
  
  const editPayMethodEl = document.getElementById('editPaymentMethod');
  if (editPayMethodEl) {
    customerAccount.paymentMethod = editPayMethodEl.value;
    const dispPayMethodEl = document.getElementById('dispPaymentMethod');
    if (dispPayMethodEl) dispPayMethodEl.innerText = customerAccount.paymentMethod;
  }

  dispAccountIdEl.innerText = customerAccount.account_id;
  dispCustomerNameEl.innerText = customerAccount.name;
  if (dispCustomerPhoneEl && customerAccount.phone) {
    dispCustomerPhoneEl.innerText = customerAccount.phone;
  }

  if (isCustomerVerified) {
    accBalanceEl.innerText = fmtMoney(customerAccount.balance);
    accDueDateEl.innerText = customerAccount.dueDate;
  }

  // Auto calculate split plan
  calculateInstallments();
}

function getCurrencySymbol() {
  return customerAccount.account_id === 'ACC-88392' ? '₹' : '$';
}

function fmtMoney(amount) {
  const symbol = getCurrencySymbol();
  return `${symbol}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Calculate split installments dynamically
function calculateInstallments() {
  const splitFreqEl = document.getElementById('splitFrequency');
  const splitOutputEl = document.getElementById('splitScheduleOutput');
  if (!splitFreqEl || !splitOutputEl) return;

  const frequency = parseInt(splitFreqEl.value) || 2;
  const balance = customerAccount.balance;
  const splitAmount = balance / frequency;

  let text = '';
  if (frequency === 2) {
    text = `${fmtMoney(splitAmount)} every 14 days`;
  } else if (frequency === 3) {
    text = `${fmtMoney(splitAmount)} monthly (3 months)`;
  } else {
    text = `${fmtMoney(splitAmount)} monthly (4 months)`;
  }

  splitOutputEl.innerText = text;
}

let audioCtx = null;

// Play Dual-Tone Multi-Frequency (DTMF) keys audio using Web Audio API
function playDTMFTone(digit) {
  const dtmfFreqs = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
  };

  if (!dtmfFreqs[digit]) return;
  
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const [f1, f2] = dtmfFreqs[digit];

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = f1;

    osc2.type = 'sine';
    osc2.frequency.value = f2;

    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();

    osc1.stop(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + 0.12);
  } catch (err) {
    console.warn('[DTMF Audio Synth Failed]', err);
  }
}

// Clicks on the phone dials
function pressDialpadKey(digit) {
  if (!callActive) {
    // Alert the user to start a call first
    alert('Please dial a call first using the green 📞 phone button.');
    return;
  }

  // Play Tone
  playDTMFTone(digit);

  // Append character input to input textbox
  userInputEl.value += digit;

  // Auto submit verification PIN if exactly 4 digits entered in stage 1
  if (currentStage === 1 && userInputEl.value.trim().length === 4) {
    setTimeout(handleSendMessage, 350);
  }
}

// Master view router / navigation
function navigateTo(section) {
  const sections = ['home', 'simulator', 'analytics', 'database', 'docs'];
  
  sections.forEach((sec) => {
    const navBtn = document.getElementById(`nav${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
    const contentSec = document.getElementById(`section${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
    
    if (sec === section) {
      if (navBtn) navBtn.classList.add('active');
      if (contentSec) contentSec.classList.add('active');
    } else {
      if (navBtn) navBtn.classList.remove('active');
      if (contentSec) contentSec.classList.remove('active');
    }
  });

  // Update Page Title in Header
  const titleMap = {
    home: 'Product Home',
    simulator: 'Interactive Call Simulator Workspace',
    analytics: 'Collections Session Analytics',
    database: 'CRM Borrower Profiles Editor',
    docs: 'Integration Documentation & Schemas'
  };
  document.getElementById('pageTitle').innerText = titleMap[section] || 'Kapture AI';

  // Specific triggers
  if (section === 'analytics') {
    setTimeout(renderAnalyticsChart, 50);
  }
}

// Canvas-based analytics charts drawer
function renderAnalyticsChart() {
  const ctx = analyticsChartCanvas.getContext('2d');
  ctx.clearRect(0, 0, analyticsChartCanvas.width, analyticsChartCanvas.height);

  const entries = Object.entries(analyticsData.dispositions);
  const maxVal = Math.max(...entries.map(([_, val]) => val), 1);
  const chartHeight = 100;
  const startX = 50;
  const startY = 110;
  const barWidth = 24;
  const gap = 16;

  // Draw axis
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + 300, startY);
  ctx.stroke();

  entries.forEach(([key, val], idx) => {
    const x = startX + idx * (barWidth + gap);
    const height = (val / maxVal) * chartHeight;

    // Draw Bar
    const grad = ctx.createLinearGradient(x, startY, x, startY - height);
    grad.addColorStop(0, '#1d4ed8');
    grad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = grad;
    ctx.fillRect(x, startY - height, barWidth, height);

    // Label count
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(val, x + barWidth / 2, startY - height - 4);

    // X-Axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '7px sans-serif';
    ctx.fillText(key.slice(0, 7), x + barWidth / 2, startY + 12);
  });
}

function updateRecoveryStatistics(disposition, amount = 0) {
  if (analyticsData.dispositions[disposition] !== undefined) {
    analyticsData.dispositions[disposition]++;
  }
  if (amount > 0) {
    analyticsData.totalPtpRecovered += amount;
  }
  statCallCountEl.innerText = analyticsData.callsDialed;
  statRecoveryEl.innerText = fmtMoney(analyticsData.totalPtpRecovered);
  renderAnalyticsChart();
}

// Multilingual Localization Dictionaries
let selectedLang = 'en';

const translations = {
  en: {
    greeting: (name) => `Hello! Am I speaking with ${name}? This is Maya calling from Kapture Finance on a recorded line. For your security and privacy, could you please confirm your 4-digit verification PIN?`,
    whatRegarding: 'I am calling regarding an important update on your Kapture Finance account. For strict privacy and regulatory protection, I must verify your 4-digit PIN before disclosing any balance details.',
    wrongNumber: 'I apologize for the disturbance. I have updated our records. Have a good day.',
    authSuccess: (name, balance, date) => `Thank you for verifying, ${name}. I am calling regarding your personal loan balance of ${fmtMoney(balance)}, which was due on ${date}. We want to help you bring this account up to date today. Are you able to take care of this today, or set up a promise to pay?`,
    authFailed: 'I apologize, but that verification code does not match our records. For your protection, could you please re-confirm your 4-digit PIN?',
    sendLinkSuccess: (channel) => `I've sent a secure checkout link directly to your mobile number via ${channel}. You can open that link anytime within the next 24 hours to complete your payment. Is there anything else I can assist you with?`,
    ptpSuccess: (amount, date, ref) => `Thank you! I have scheduled your promise to pay of ${fmtMoney(amount)} for ${date} under reference ${ref}. A confirmation will also be sent to your phone.`,
    alreadyPaidSuccess: 'Thank you for letting us know. I have logged that you already completed this payment and our accounts team will verify the transaction within 24 hours.',
    hardshipSuccess: (ref) => `I understand completely. I have created priority escalation ticket ${ref} to connect you with our financial hardship restructuring specialist. Someone will reach out to you shortly.`,
    defaultResponse: 'I want to make sure we find the best solution for you. We can set up a future promise date or send a quick payment link to your phone.',
    closingGoodbye: 'Thank you for choosing Kapture Finance. Have a wonderful day. Goodbye!',
    authLocked: '🔒 LOCKED (Identity Unverified)',
    authVerified: '🔓 VERIFIED (Access Granted)',
    protectedMask: '•••••••• (Protected)',
    alertMicStart: 'Please start the outbound call first by clicking the green 📞 phone button.'
  },
  es: {
    greeting: (name) => `¡Hola! ¿Hablo con ${name}? Le habla Maya de Kapture Finance en una línea grabada. Para su seguridad y privacidad, ¿podría confirmar su código PIN de verificación de 4 dígitos?`,
    whatRegarding: 'Le llamo por una actualización importante en su cuenta de Kapture Finance. Por protección de privacidad, debo verificar su PIN antes de revelar detalles de su saldo.',
    wrongNumber: 'Disculpe la molestia. He actualizado nuestros registros. Que tenga un buen día.',
    authSuccess: (name, balance, date) => `Gracias por verificar, ${name}. Le llamo por su préstamo personal con saldo de ${fmtMoney(balance)}, vencido el ${date}. Queremos ayudarle a poner al día su cuenta hoy. ¿Puede pagar hoy o prefiere prometer una fecha de pago?`,
    authFailed: 'Lo siento, pero ese código no coincide. Por su seguridad, ¿podría confirmar su PIN de 4 dígitos nuevamente?',
    sendLinkSuccess: (channel) => `Le he enviado un enlace de pago seguro a su número móvil por ${channel}. Puede completarlo en las próximas 24 horas. ¿Le puedo ayudar en algo más?`,
    ptpSuccess: (amount, date, ref) => `¡Gracias! He registrado su promesa de pago de ${fmtMoney(amount)} para el ${date} bajo la referencia ${ref}. Se enviará una confirmación a su teléfono.`,
    alreadyPaidSuccess: 'Gracias por informarnos. He registrado que ya realizó este pago y nuestro equipo lo verificará en las próximas 24 horas.',
    hardshipSuccess: (ref) => `Entiendo perfectamente. He creado el ticket de escalación ${ref} para comunicarle con un especialista en reestructuración de deudas por dificultades financieras.`,
    defaultResponse: 'Quiero asegurarme de encontrar la mejor solución. Podemos agendar una promesa de pago o enviar un enlace de pago rápido a su teléfono.',
    closingGoodbye: 'Gracias por elegir Kapture Finance. ¡Que tenga un excelente día, hasta luego!',
    authLocked: '🔒 BLOQUEADO (Identidad sin verificar)',
    authVerified: '🔓 VERIFICADO (Acceso concedido)',
    protectedMask: '•••••••• (Protegido)',
    alertMicStart: 'Por favor, inicie la llamada haciendo clic en el botón verde de teléfono 📞.'
  },
  hi: {
    greeting: (name) => `नमस्ते! क्या मैं ${name} जी से बात कर रहा हूँ? मैं केप्चर फाइनेंस से माया बात कर रही हूँ। आपकी सुरक्षा और गोपनीयता के लिए, क्या आप अपने 4 अंकों के पिन की पुष्टि कर सकते हैं?`,
    whatRegarding: 'मैं आपके केप्चर फाइनेंस खाते के संबंध में कॉल कर रही हूँ। गोपनीयता नियमों के कारण, मैं सत्यापन से पहले खाते की जानकारी नहीं दे सकती।',
    wrongNumber: 'असुविधा के लिए खेद है। मैंने अपने रिकॉर्ड अपडेट कर दिए हैं। आपका दिन शुभ हो।',
    authSuccess: (name, balance, date) => `सत्यापन के लिए धन्यवाद, ${name} जी। मैं आपके ${fmtMoney(balance)} के ऋण बकाया के संबंध में बात कर रही हूँ, जो ${date} को देय था। क्या आप आज इसका भुगतान कर सकते हैं, या कोई वादा तिथि तय करना चाहेंगे?`,
    authFailed: 'माफ कीजिए, यह पिन हमारे रिकॉर्ड से मेल नहीं खाता। कृपया अपना सही 4 अंकों का पिन पुनः दर्ज करें।',
    sendLinkSuccess: (channel) => `मैंने ${channel} के माध्यम से आपके मोबाइल नंबर पर भुगतान लिंक भेज दिया है। आप 24 घंटे के भीतर भुगतान कर सकते हैं। क्या मैं आपकी कोई और सहायता कर सकती हूँ?`,
    ptpSuccess: (amount, date, ref) => `धन्यवाद! मैंने संदर्भ संख्या ${ref} के तहत ${date} को ${fmtMoney(amount)} के भुगतान का वादा दर्ज कर लिया है।`,
    alreadyPaidSuccess: 'जानकारी के लिए धन्यवाद। मैंने दर्ज कर लिया है कि आपने भुगतान कर दिया है, हमारी टीम 24 घंटे में इसकी पुष्टि करेगी।',
    hardshipSuccess: (ref) => `मैं समझ सकती हूँ। मैंने वित्तीय कठिनाई विशेषज्ञ से बात कराने के लिए टिकट संख्या ${ref} बना दी है। जल्द ही आपसे संपर्क किया जाएगा।`,
    defaultResponse: 'मैं आपके लिए सबसे अच्छा समाधान खोजना चाहती हूँ। हम भुगतान की तारीख तय कर सकते हैं या लिंक भेज सकते हैं।',
    closingGoodbye: 'केप्चर फाइनेंस चुनने के लिए धन्यवाद। आपका दिन शुभ हो, अलविदा!',
    authLocked: '🔒 लॉक (सत्यापन शेष)',
    authVerified: '🔓 सत्यापित (पहुंच स्वीकृत)',
    protectedMask: '•••••••• (गोपनीय)',
    alertMicStart: 'कृपया पहले कॉल शुरू करने के लिए हरे 📞 फोन बटन पर क्लिक करें।'
  },
  fr: {
    greeting: (name) => `Bonjour ! Est-ce que je parle à ${name} ? Ici Maya de Kapture Finance sur une ligne enregistrée. Pour votre sécurité, pourriez-vous confirmer votre code PIN de vérification à 4 chiffres ?`,
    whatRegarding: 'Je vous appelle concernant une mise à jour importante de votre compte Kapture Finance. Pour des raisons de confidentialité, je dois vérifier votre code PIN avant de divulguer des informations.',
    wrongNumber: 'Je m’excuse pour le dérangement. J’ai mis à jour nos dossiers. Bonne journée.',
    authSuccess: (name, balance, date) => `Merci pour la vérification, ${name}. Je vous appelle concernant le solde de votre prêt personnel de ${fmtMoney(balance)}, qui était dû le ${date}. Nous souhaitons vous aider à régulariser votre compte aujourd'hui. Êtes-vous en mesure de payer aujourd'hui ou de planifier une promesse de paiement ?`,
    authFailed: 'Désolé, mais ce code ne correspond pas. Pour votre protection, pourriez-vous confirmer à nouveau votre code PIN à 4 chiffres ?',
    sendLinkSuccess: (channel) => `Je vous ai envoyé un lien de paiement sécurisé sur votre mobile via ${channel}. Vous pouvez effectuer le paiement dans les prochaines 24 heures. Puis-je vous aider pour autre chose ?`,
    ptpSuccess: (amount, date, ref) => `Merci ! J'ai enregistré votre promesse de paiement de ${fmtMoney(amount)} pour le ${date} sous la référence ${ref}. Un SMS de confirmation vous sera envoyé.`,
    alreadyPaidSuccess: 'Merci de nous l’avoir signalé. J’ai noté que vous aviez déjà effectué ce paiement, notre équipe comptable effectuera la vérification sous 24 heures.',
    hardshipSuccess: (ref) => `Je comprends tout à fait. J'ai créé le ticket d'escalade prioritaire ${ref} pour vous mettre en relation avec notre spécialiste en restructuration financière.`,
    defaultResponse: 'Je souhaite trouver la meilleure solution pour vous. Nous pouvons planifier une promesse de paiement ou vous envoyer un lien de paiement rapide.',
    closingGoodbye: 'Merci d’avoir choisi Kapture Finance. Bonne fin de journée. Au revoir !',
    authLocked: '🔒 VERROUILLÉ (Identité non vérifiée)',
    authVerified: '🔓 VÉRIFIÉ (Accès autorisé)',
    protectedMask: '•••••••• (Protégé)',
    alertMicStart: 'Veuillez lancer l’appel en cliquant sur le bouton de téléphone vert 📞.'
  },
  pt: {
    greeting: (name) => `Olá! Falo com ${name}? Aqui é a Maya da Kapture Finance em uma linha gravada. Para sua segurança e privacidade, você poderia confirmar o seu PIN de verificação de 4 dígitos?`,
    whatRegarding: 'Estou ligando sobre uma atualização importante em sua conta Kapture Finance. Por motivos de privacidade, preciso verificar seu PIN antes de revelar detalhes de saldo.',
    wrongNumber: 'Peço desculpas pelo incômodo. Atualizei nossos registros. Tenha um bom dia.',
    authSuccess: (name, balance, date) => `Obrigada pela confirmação, ${name}. Ligo sobre o saldo do seu empréstimo pessoal de ${fmtMoney(balance)}, vencido em ${date}. Queremos ajudar a regularizar sua conta hoje. Você pode efetuar o pagamento hoje ou agendar uma promessa de pagamento?`,
    authFailed: 'Desculpe, mas este código não corresponde. Para sua segurança, poderia reconfirmar seu PIN de 4 dígitos?',
    sendLinkSuccess: (channel) => `Enviei um link de pagamento seguro para o seu celular via ${channel}. Você pode concluir o pagamento nas próximas 24 horas. Posso ajudar com algo mais?`,
    ptpSuccess: (amount, date, ref) => `Obrigada! Agendei sua promessa de pagamento de ${fmtMoney(amount)} para ${date} com a referência ${ref}. Um SMS de confirmação será enviado.`,
    alreadyPaidSuccess: 'Obrigada por nos informar. Registrei que você já realizou este pagamento, nosso time financeiro irá verificar em até 24 horas.',
    hardshipSuccess: (ref) => `Compreendo perfeitamente. Criei o ticket de prioridade ${ref} para encaminhá-lo ao nosso especialista em reestruturação financeira.`,
    defaultResponse: 'Quero garantir que encontremos a melhor solução. Podemos agendar uma promessa de pagamento ou enviar um link rápido ao seu celular.',
    closingGoodbye: 'Obrigada por escolher a Kapture Finance. Tenha um excelente dia. Tchau!',
    authLocked: '🔒 BLOQUEADO (Identidade não verificada)',
    authVerified: '🔓 VERIFICADO (Acesso concedido)',
    protectedMask: '•••••••• (Protegido)',
    alertMicStart: 'Por favor, inicie a ligação clicando no botão verde do telefone 📞.'
  },
  te: {
    greeting: (name) => `నమస్తే! నేను ${name} తో మాట్లాడుతున్నానా? నేను కేప్చర్ ఫైనాన్స్ నుండి మాయ మాట్లాడుతున్నాను. మీ భద్రత మరియు గోప్యత కోసం, దయచేసి మీ 4 అంకెల ధృవీకరణ పిన్ (PIN) ను నిర్ధారించగలరా?`,
    whatRegarding: 'నేను మీ కేప్చర్ ఫైనాన్స్ ఖాతాకు సంబంధించిన ముఖ్యమైన అప్‌డేట్ గురించి కాల్ చేస్తున్నాను. గోప్యతా రక్షణ కోసం, నేను మీ పిన్ నంబర్‌ను ధృవీకరించాలి.',
    wrongNumber: 'అంతరాయం కలిగించినందుకు క్షమించండి. నేను మా రికార్డులను అప్‌డేట్ చేసాను. మంచి రోజు.',
    authSuccess: (name, balance, date) => `ధృవీకరించినందుకు ధన్యవాదాలు, ${name}. మీ పర్సనల్ లోన్ బ్యాలెన్స్ ${fmtMoney(balance)} బకాయి గురించి నేను కాల్ చేస్తున్నాను, ఇది ${date} న చెల్లించాల్సి ఉంది. మీరు ఈ రోజు చెల్లింపు చేయగలరా, లేదా బకాయి చెల్లింపునకు తేదీని షెడ్యూల్ చేయాలనుకుంటున్నారా?`,
    authFailed: 'క్షమించండి, ఆ ధృవీకరణ కోడ్ మా రికార్డులతో సరిపోలడం లేదు. మీ రక్షణ కోసం, దయచేసి మీ 4 అంకెల పిన్ నంబర్‌ను మళ్లీ నిర్ధారించగలరా?',
    sendLinkSuccess: (channel) => `నేను మీ మొబైల్ నంబర్‌కు ${channel} ద్వారా సురక్షితమైన చెల్లింపు లింక్‌ను పంపించాను. మీరు తదుపరి 24 గంటల్లో చెల్లింపును పూర్తి చేయవచ్చు. నేను మీకు సహాయం చేయగలిగేది ఇంకా ఏదైనా ఉందా?`,
    ptpSuccess: (amount, date, ref) => `ధన్యవాదాలు! నేను ${date} నాడు $${amount.toFixed(2)} చెల్లించే మీ వాగ్దానాన్ని రిఫరెన్స్ సంఖ్య ${ref} కింద షెడ్యూల్ చేసాను. మీ ఫోన్‌కు కూడా దీని నిర్ధారణ పంపబడుతుంది.`,
    alreadyPaidSuccess: 'తెలియజేసినందుకు ధన్యవాదాలు. మీరు ఇప్పటికే ఈ చెల్లింపును పూర్తి చేసినట్లు నేను నమోదు చేసాను మరియు మా అకౌంట్స్ బృందం 24 గంటల్లో లావాదేవీని ధృవీకరిస్తుంది.',
    hardshipSuccess: (ref) => `నేను పూర్తిగా అర్థం చేసుకోగలను. లోన్ పునర్నిర్మాణ నిపుణులతో మిమ్మల్ని సంప్రదించడానికి నేను ప్రాధాన్యత ఎస్కలేషన్ టికెట్ ${ref} ను సృష్టించాను. త్వరలోనే మా ప్రతినిధి మిమ్మల్ని సంప్రదిస్తారు.`,
    defaultResponse: 'నేను మీ కోసం ఉత్తమమైన పరిష్కారాన్ని కనుగొనాలనుకుంటున్నాను. మనం బకాయి చెల్లింపునకు తేదీని షెడ్యూల్ చేయవచ్చు లేదా మీ ఫోన్‌కు శీఘ్ర చెల్లింపు లింక్‌ను పంపవచ్చు.',
    closingGoodbye: 'కేప్చర్ ఫైనాన్స్ ఎంచుకున్నందుకు ధన్యవాదాలు. శుభదినం, సెలవు!',
    authLocked: '🔒 లాక్ చేయబడింది (ధృవీకరించబడలేదు)',
    authVerified: '🔓 ధృవీకరించబడింది (యాక్సెస్ అనుమతించబడింది)',
    protectedMask: '•••••••• (సురక్షితమైనది)',
    alertMicStart: 'దయచేసి ముందుగా కాల్ ప్రారంభించడానికి ఆకుపచ్చ 📞 బటన్‌ను క్లిక్ చేయండి.'
  }
};

const voiceLocales = {
  en: 'en-US',
  es: 'es-ES',
  hi: 'hi-IN',
  fr: 'fr-FR',
  pt: 'pt-BR',
  te: 'te-IN'
};

function changeLanguage() {
  const langSelect = document.getElementById('langSelect');
  selectedLang = langSelect.value;

  if (recognition) {
    recognition.lang = voiceLocales[selectedLang];
  }

  if (!isCustomerVerified) {
    accStatusTextEl.innerText = translations[selectedLang].authLocked;
    accBalanceEl.innerText = translations[selectedLang].protectedMask;
    accDueDateEl.innerText = translations[selectedLang].protectedMask;
  } else {
    accStatusTextEl.innerText = translations[selectedLang].authVerified;
  }

  renderChips();
}

function speakText(text) {
  if (studioCallActive) return; // Prevent local voice speaking during Vapi WebRTC session
  if (!enableTTS || !synth) return;
  synth.cancel();
  
  const voices = synth.getVoices();
  let matchedVoice = voices.find(
    (v) => v.lang === voiceLocales[selectedLang] || v.lang.startsWith(voiceLocales[selectedLang]) || v.lang.startsWith(selectedLang)
  );

  if (matchedVoice) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLocales[selectedLang];
    utterance.rate = 0.98;
    utterance.pitch = 1.0;
    utterance.voice = matchedVoice;
    
    voiceWaveEl.classList.add('wave-active');
    utterance.onend = () => voiceWaveEl.classList.remove('wave-active');
    utterance.onerror = (err) => {
      console.error('[TTS Speech Error]', err);
      voiceWaveEl.classList.remove('wave-active');
    };
    
    synth.speak(utterance);
  } else {
    const encText = encodeURIComponent(text);
    const cloudTtsUrl = `/api/tts?lang=${selectedLang}&text=${encText}`;
    const audio = new Audio(cloudTtsUrl);
    voiceWaveEl.classList.add('wave-active');
    audio.onended = () => voiceWaveEl.classList.remove('wave-active');
    audio.onerror = (err) => {
      console.error('[Cloud TTS Fallback Audio Error]', err);
      voiceWaveEl.classList.remove('wave-active');
    };
    audio.play().catch((err) => {
      console.warn('[Autoplay Blocked] Click on the page first before starting audio playback.', err);
      voiceWaveEl.classList.remove('wave-active');
    });
  }
}

function appendMessage(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${sender.toLowerCase()}`;
  const senderLabel = document.createElement('div');
  senderLabel.className = 'msg-sender';
  
  if (sender === 'bot') {
    senderLabel.innerText = '🤖 Maya (Kapture AI)';
  } else if (sender === 'system') {
    senderLabel.innerText = '⚙️ System Outbound Notice';
  } else {
    senderLabel.innerText = '👤 Customer';
  }
  
  const textContent = document.createElement('div');
  textContent.innerText = text;
  bubble.appendChild(senderLabel);
  bubble.appendChild(textContent);
  transcriptFeedEl.appendChild(bubble);
  transcriptFeedEl.scrollTop = transcriptFeedEl.scrollHeight;
  if (sender === 'bot') speakText(text);
}

async function callWebhook(toolName, args) {
  const callId = `call_${Date.now()}`;
  const payload = { message: { type: 'tool-calls', toolCalls: [{ id: callId, type: 'function', function: { name: toolName, arguments: args } }] } };
  
  // Read the CRM Webhook Base URL from configuration
  const serverBase = (document.getElementById('studioServerBaseUrl')?.value || '').trim();
  const url = (serverBase ? serverBase.replace(/\/$/, '') : '') + '/webhook';
  
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    const parsedResult = JSON.parse(data.results[0].result);
    logToolCall(toolName, args, parsedResult);
    if (toolName === 'mark_disposition' && args.status) activeCallDisposition = args.status;
    return parsedResult;
  } catch (err) {
    console.error('Webhook error:', err);
    logToolCall(toolName, args, { error: err.message });
    return null;
  }
}

function updateStage(stage) {
  currentStage = stage;
  stepProgressFillEl.style.width = `${stage * 25}%`;
  document.querySelectorAll('.step-row span').forEach((span, idx) => {
    span.className = (idx + 1 === stage) ? 'active' : '';
  });
  renderChips();
}

function renderChips() {
  chipContainerEl.innerHTML = '';
  let options = [];
  const pin = customerAccount.verification_code;
  const balance = customerAccount.balance;

  const chipDefs = {
    en: {
      pinValidLabel: `🔢 PIN: ${pin} (Valid)`, pinValidText: `My PIN is ${pin}`,
      pinInvalidLabel: '🔢 PIN: 9999 (Invalid)', pinInvalidText: 'My PIN is 9999',
      whatRegLabel: '❓ "What is this regarding?"', whatRegText: 'What is this regarding?',
      wrongNumLabel: '🚫 Wrong Person', wrongNumText: 'You have the wrong number',
      smsLinkLabel: '💳 "Send link on SMS"', smsLinkText: 'Can you text me a payment link on SMS?',
      waLinkLabel: '📲 "Send WhatsApp link"', waLinkText: 'Please send the link on WhatsApp',
      payACHLabel: '🏦 "Pay via ACH Bank"', payACHText: 'Please send me a link to pay via ACH direct bank debit',
      payWalletLabel: '📱 "Pay via UPI / GPay"', payWalletText: 'I want to pay using Google Pay or my digital wallet',
      payDateLabel: `📅 "Pay ${fmtMoney(balance).split('.')[0]} on 25th"`, payDateText: `I can pay ${fmtMoney(balance).split('.')[0]} on August 25th`,
      paidLabel: '✅ "Already paid this"', paidText: 'I already paid this yesterday',
      hardshipLabel: '⚠️ "Lost job (Hardship)"', hardshipText: 'I lost my job and cannot afford this right now',
      thanksLabel: '👍 "Thank you Maya, goodbye"', thanksText: 'Thank you for your help, goodbye!'
    },
    es: {
      pinValidLabel: `🔢 PIN: ${pin} (Válido)`, pinValidText: `Mi PIN es ${pin}`,
      pinInvalidLabel: '🔢 PIN: 9999 (Inválido)', pinInvalidText: 'Mi PIN es 9999',
      whatRegLabel: '❓ "¿De qué se trata?"', whatRegText: '¿De qué se trata esto?',
      wrongNumLabel: '🚫 Persona equivocada', wrongNumText: 'Tiene el número equivocado',
      smsLinkLabel: '💳 "Enviar link por SMS"', smsLinkText: '¿Puede enviarme un enlace de pago por SMS?',
      waLinkLabel: '📲 "Enviar link por WhatsApp"', waLinkText: 'Por favor envíe el enlace por WhatsApp',
      payACHLabel: '🏦 "Pagar por banco (ACH)"', payACHText: 'Por favor envíeme un enlace para pagar mediante débito bancario ACH',
      payWalletLabel: '📱 "Pagar por billetera (GPay)"', payWalletText: 'Quiero pagar usando Google Pay o mi billetera digital',
      payDateLabel: `📅 "Pagar ${fmtMoney(balance).split('.')[0]} el día 25"`, payDateText: `Puedo pagar ${fmtMoney(balance).split('.')[0]} el 25 de agosto`,
      paidLabel: '✅ "Ya pagué esto"', paidText: 'Ya pagué esto ayer',
      hardshipLabel: '⚠️ "Perdida de trabajo"', hardshipText: 'Perdí mi trabajo y no puedo pagar ahora mismo',
      thanksLabel: '👍 "Gracias Maya, adiós"', thanksText: 'Gracias por su ayuda, ¡adiós!'
    },
    hi: {
      pinValidLabel: `🔢 पिन: ${pin} (सही)`, pinValidText: `मेरा पिन ${pin} है`,
      pinInvalidLabel: '🔢 पिन: 9999 (गलत)', pinInvalidText: 'मेरा पिन 9999 है',
      whatRegLabel: '❓ "यह किस बारे में है?"', whatRegText: 'यह किस बारे में है?',
      wrongNumLabel: '🚫 गलत व्यक्ति', wrongNumText: 'आपका गलत नंबर है',
      smsLinkLabel: '💳 "एसएमएस पर लिंक भेजें"', smsLinkText: 'क्या आप मुझे एसएमएस पर भुगतान लिंक भेज सकते हैं?',
      waLinkLabel: '📲 "व्हाट्सएप लिंक भेजें"', waLinkText: 'कृपया व्हाट्सएप पर लिंक भेजें',
      payACHLabel: '🏦 "बैंक (ACH) से भुगतान करें"', payACHText: 'कृपया मुझे बैंक खाते (ACH) से भुगतान करने का लिंक भेजें',
      payWalletLabel: '📱 "UPI / GPay से भुगतान करें"', payWalletText: 'मैं गूगल पे या यूपीआई वॉलेट से भुगतान करना चाहता हूँ',
      payDateLabel: `📅 "25 तारीख को ${fmtMoney(balance).split('.')[0]} दें"`, payDateText: `मैं 25 अगस्त को ${fmtMoney(balance).split('.')[0]} का भुगतान कर सकता हूँ`,
      paidLabel: '✅ "भुगतान पहले ही कर दिया"', paidText: 'मैंने कल ही इसका भुगतान कर दिया है',
      hardshipLabel: '⚠️ "नौकरी चली गई (कठिनाई)"', hardshipText: 'मेरी नौकरी चली गई है और मैं अभी भुगतान नहीं कर सकता',
      thanksLabel: '👍 "धन्यवाद माया, अलविदा"', thanksText: 'आपकी मदद के लिए धन्यवाद, अलविदा!'
    },
    fr: {
      pinValidLabel: `🔢 PIN: ${pin} (Valide)`, pinValidText: `Mon code PIN est ${pin}`,
      pinInvalidLabel: '🔢 PIN: 9999 (Invalide)', pinInvalidText: 'Mon code PIN est 9999',
      whatRegLabel: '❓ "De quoi s\'agit-il?"', whatRegText: 'De quoi s\'agit-il?',
      wrongNumLabel: '🚫 Mauvaise personne', wrongNumText: 'Vous avez le mauvais numéro',
      smsLinkLabel: '💳 "Envoyer le lien par SMS"', smsLinkText: 'Pouvez-vous m\'envoyer un lien de paiement par SMS?',
      waLinkLabel: '📲 "Envoyer par WhatsApp"', waLinkText: 'Veuillez envoyer le lien sur WhatsApp',
      payACHLabel: '🏦 "Payer par banque (ACH)"', payACHText: 'Veuillez m\'envoyer un lien pour payer par débit bancaire ACH',
      payWalletLabel: '📱 "Payer par portefeuille (GPay)"', payWalletText: 'Je souhaite payer avec Google Pay ou mon portefeuille numérique',
      payDateLabel: `📅 "Payer ${fmtMoney(balance).split('.')[0]} le 25"`, payDateText: `Je peux payer ${fmtMoney(balance).split('.')[0]} le 25 août`,
      paidLabel: '✅ "Déjà payé cela"', paidText: 'J\'ai déjà payé cela hier',
      hardshipLabel: '⚠️ "Perte d\'emploi (Difficulté)"', hardshipText: 'J\'ai perdu mon emploi et je ne peux pas payer maintenant',
      thanksLabel: '👍 "Merci Maya, au revoir"', thanksText: 'Merci pour votre aide, au revoir!'
    },
    pt: {
      pinValidLabel: `🔢 PIN: ${pin} (Válido)`, pinValidText: `Meu PIN é ${pin}`,
      pinInvalidLabel: '🔢 PIN: 9999 (Inválido)', pinInvalidText: 'Meu PIN é 9999',
      whatRegLabel: '❓ "Do que se trata?"', whatRegText: 'Do que se trata?',
      wrongNumLabel: '🚫 Pessoa errada', wrongNumText: 'Você tem o número errado',
      smsLinkLabel: '💳 "Enviar link por SMS"', smsLinkText: 'Você pode me enviar um link de pagamento por SMS?',
      waLinkLabel: '📲 "Enviar link por WhatsApp"', waLinkText: 'Por favor envie o link pelo WhatsApp',
      payACHLabel: '🏦 "Pagar via banco (ACH)"', payACHText: 'Por favor envie um link para pagar via débito bancário ACH',
      payWalletLabel: '📱 "Pagar via Pix / GPay"', payWalletText: 'Quero pagar usando o Google Pay ou minha carteira digital',
      payDateLabel: `📅 "Pagar ${fmtMoney(balance).split('.')[0]} no dia 25"`, payDateText: `Posso pagar ${fmtMoney(balance).split('.')[0]} no dia 25 de agosto`,
      paidLabel: '✅ "Já paguei isso"', paidText: 'Eu já paguei isso ontem',
      hardshipLabel: '⚠️ "Perdi emprego (Dificuldade)"', hardshipText: 'Perdi meu emprego e não posso pagar agora',
      thanksLabel: '👍 "Obrigado Maya, tchau"', thanksText: 'Obrigado por sua ajuda, tchau!'
    },
    te: {
      pinValidLabel: `🔢 పిన్: ${pin} (సరైనది)`, pinValidText: `నా పిన్ సంఖ్య ${pin}`,
      pinInvalidLabel: '🔢 పిన్: 9999 (తప్పు)', pinInvalidText: 'నా పిన్ సంఖ్య 9999',
      whatRegLabel: '❓ "ఇది దేనికి సంబంధించింది?"', whatRegText: 'ఇది దేనికి సంబంధించింది?',
      wrongNumLabel: '🚫 తప్పు నంబర్', wrongNumText: 'మీరు తప్పు సంఖ్యకు కాల్ చేసారు',
      smsLinkLabel: '💳 "SMS ద్వారా లింక్ పంపండి"', smsLinkText: 'నాకు SMS ద్వారా చెల్లింపు లింక్ పంపగలరా?',
      waLinkLabel: '📲 "WhatsApp ద్వారా లింక్ పంపండి"', waLinkText: 'దయచేసి వాట్సాప్ (WhatsApp) ద్వారా లింక్ పంపండి',
      payACHLabel: '🏦 "బ్యాంక్ (ACH) ద్వారా కడతాను"', payACHText: 'నాకు డైరెక్ట్ బ్యాంక్ డెబిట్ (ACH) ద్వారా చెల్లించడానికి లింక్ పంపండి',
      payWalletLabel: '📱 "గూగుల్ పే / UPI ద్వారా కడతాను"', payWalletText: 'నేను గూగుల్ పే (Google Pay) లేదా డిజిటల్ వాలెట్ ద్వారా చెల్లించాలనుకుంటున్నాను',
      payDateLabel: `📅 "25న ${fmtMoney(balance).split('.')[0]} కడతాను"`, payDateText: `నేను ఆగస్టు 25న ${fmtMoney(balance).split('.')[0]} చెల్లించగలను`,
      paidLabel: '✅ "ఇదివరకే చెల్లించాను"', paidText: 'నేను నిన్ననే దీనిని చెల్లించాను',
      hardshipLabel: '⚠️ "ఉద్యోగం పోయింది (కష్టం)"', hardshipText: 'నా ఉద్యోగం పోయింది, నేను ఇప్పుడు చెల్లించలేను',
      thanksLabel: '👍 "ధన్యవాదాలు మాయ, సెలవు"', thanksText: 'మీ సహాయానికి ధన్యవాదాలు, సెలవు!'
    }
  };

  const activeChips = chipDefs[selectedLang] || chipDefs.en;

  if (currentStage === 1) {
    options = [
      { label: activeChips.pinValidLabel, text: activeChips.pinValidText },
      { label: activeChips.pinInvalidLabel, text: activeChips.pinInvalidText },
      { label: activeChips.whatRegLabel, text: activeChips.whatRegText },
      { label: activeChips.wrongNumLabel, text: activeChips.wrongNumText }
    ];
  } else if (currentStage === 2 || currentStage === 3) {
    options = [
      { label: activeChips.smsLinkLabel, text: activeChips.smsLinkText },
      { label: activeChips.waLinkLabel, text: activeChips.waLinkText },
      { label: activeChips.payACHLabel, text: activeChips.payACHText },
      { label: activeChips.payWalletLabel, text: activeChips.payWalletText },
      { label: activeChips.payDateLabel, text: activeChips.payDateText },
      { label: activeChips.paidLabel, text: activeChips.paidText },
      { label: activeChips.hardshipLabel, text: activeChips.hardshipText }
    ];
  } else if (currentStage === 4) {
    options = [
      { label: activeChips.thanksLabel, text: activeChips.thanksText }
    ];
  }

  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.innerText = opt.label;
    btn.onclick = () => {
      userInputEl.value = opt.text;
      handleSendMessage();
    };
    chipContainerEl.appendChild(btn);
  });
}

function renderCallHistory() {
  const body = document.getElementById('callHistoryBody');
  if (!body) return;
  
  if (callHistory.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 20px;">No historical calls recorded in this session.</td></tr>`;
    return;
  }

  body.innerHTML = callHistory.map(h => `
    <tr>
      <td><code>${h.timestamp}</code></td>
      <td><strong>${h.name}</strong></td>
      <td><span class="status-pill" style="background: rgba(255,255,255,0.05); color: #fff; border-color: transparent; padding: 2px 8px; font-size:10px;">${h.language}</span></td>
      <td><span style="color: ${h.status.includes('Verified') ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${h.status}</span></td>
      <td><span class="status-pill" style="background: ${h.disposition === 'NO_RESPONSE' ? 'var(--danger-bg)' : 'var(--success-bg)'}; color: ${h.disposition === 'NO_RESPONSE' ? 'var(--danger)' : 'var(--success)'}; border: none; padding: 2px 8px; font-size:10px;">${h.disposition}</span></td>
    </tr>
  `).join('');
}

function startCall() {
  if (callActive) return;
  callActive = true;
  callDuration = 0;
  isCustomerVerified = false;
  currentStage = 1;
  activeCallDisposition = 'NO_RESPONSE';
  transcriptFeedEl.innerHTML = '';
  toolFeedEl.innerHTML = '';

  analyticsData.callsDialed++;
  statCallCountEl.innerText = analyticsData.callsDialed;

  authStatusBadgeEl.className = 'account-badge-box auth-locked';
  accStatusTextEl.innerText = translations[selectedLang].authLocked;
  accBalanceEl.innerText = translations[selectedLang].protectedMask;
  accDueDateEl.innerText = translations[selectedLang].protectedMask;

  timerInterval = setInterval(() => {
    callDuration++;
    const mins = String(Math.floor(callDuration / 60)).padStart(2, '0');
    const secs = String(callDuration % 60).padStart(2, '0');
    callTimerEl.innerText = `${mins}:${secs}`;
  }, 1000);

  updateStage(1);

  appendMessage('system', `Dialing outbound collections line: ${customerAccount.phone}...`);

  setTimeout(() => {
    appendMessage(
      'bot',
      translations[selectedLang].greeting(customerAccount.name)
    );
  }, 1200);
}

function endCall() {
  if (!callActive) return;
  callActive = false;
  clearInterval(timerInterval);
  synth.cancel();
  voiceWaveEl.classList.remove('wave-active');
  callTimerEl.innerText = '00:00 (Call Ended)';
  appendMessage('bot', translations[selectedLang].closingGoodbye);

  // Save call record to history list
  const record = {
    timestamp: new Date().toLocaleTimeString(),
    name: customerAccount.name,
    language: selectedLang.toUpperCase(),
    status: isCustomerVerified ? '🔓 Verified' : '🔒 Unverified',
    disposition: activeCallDisposition
  };
  callHistory.unshift(record);
  localStorage.setItem('kapture_call_history', JSON.stringify(callHistory));
  renderCallHistory();
}

async function handleSendMessage() {
  const text = userInputEl.value.trim();
  if (!text || !callActive) return;

  appendMessage('user', text);
  userInputEl.value = '';

  const lower = text.toLowerCase();

  // STAGE 1: AUTHENTICATION
  if (currentStage === 1) {
    if (lower.includes('what is this regarding') || lower.includes('who are you') || lower.includes('क्या मामला है') || lower.includes('de quoi s\'agit') || lower.includes('referente a') || lower.includes('ఏమిటి') || lower.includes('విషయం')) {
      setTimeout(() => {
        appendMessage('bot', translations[selectedLang].whatRegarding);
      }, 700);
      return;
    }

    if (lower.includes('wrong number') || lower.includes('wrong person') || lower.includes('incorrecto') || lower.includes('गलत नंबर') || lower.includes('mauvais numéro') || lower.includes('número errado') || lower.includes('తప్పు') || lower.includes('రాంగ్')) {
      const res = await callWebhook('mark_disposition', {
        account_id: customerAccount.account_id,
        status: 'WRONG_PERSON',
        notes: 'Customer stated reached wrong number.'
      });
      updateRecoveryStatistics('WRONG_PERSON');
      setTimeout(() => {
        appendMessage('bot', translations[selectedLang].wrongNumber);
        setTimeout(endCall, 2000);
      }, 600);
      return;
    }

    // Extract numbers from message
    const match = text.match(/\b\d{4}\b/);
    const code = match ? match[0] : (lower.includes(customerAccount.verification_code) ? customerAccount.verification_code : '9999');

    const authRes = await callWebhook('verify_customer', {
      account_id: customerAccount.account_id,
      verification_code: code
    });

    if (authRes && authRes.verified) {
      isCustomerVerified = true;
      authStatusBadgeEl.className = 'account-badge-box auth-unlocked';
      accStatusTextEl.innerText = translations[selectedLang].authVerified;
      accBalanceEl.innerText = fmtMoney(customerAccount.balance);
      accDueDateEl.innerText = customerAccount.dueDate;

      updateStage(2);

      setTimeout(() => {
        appendMessage(
          'bot',
          translations[selectedLang].authSuccess(customerAccount.name, customerAccount.balance, customerAccount.dueDate)
        );
        updateStage(3);
      }, 800);
    } else {
      setTimeout(() => {
        appendMessage('bot', translations[selectedLang].authFailed);
      }, 800);
    }
    return;
  }

  // STAGE 3: RESOLUTION & NEGOTIATION
  if (currentStage === 3 || currentStage === 2) {
    if (lower.includes('sms') || lower.includes('whatsapp') || lower.includes('link') || lower.includes('enlace') || lower.includes('लिंक') || lower.includes('lien') || lower.includes('లింక్') || lower.includes('పంపిం')) {
      const channel = lower.includes('whatsapp') ? 'WhatsApp' : 'SMS';
      
      // Parse payment method election from customer response keywords
      let method = customerAccount.paymentMethod;
      if (lower.includes('ach') || lower.includes('bank') || lower.includes('transfer') || lower.includes('direct debit') || lower.includes('బ్యాంక్')) {
        method = 'ACH';
      } else if (lower.includes('wallet') || lower.includes('gpay') || lower.includes('upi') || lower.includes('వాలెట్') || lower.includes('గూగుల్')) {
        method = 'Digital Wallet';
      } else if (lower.includes('card') || lower.includes('debit') || lower.includes('కార్డు')) {
        method = 'Debit Card';
      }

      const linkRes = await callWebhook('send_payment_link', {
        account_id: customerAccount.account_id,
        channel: channel,
        payment_method: method
      });

      await callWebhook('mark_disposition', {
        account_id: customerAccount.account_id,
        status: 'PTP_AGREED',
        notes: `Sent instant payment link via ${channel} with payment election: ${method}.`
      });

      updateRecoveryStatistics('PTP_AGREED', customerAccount.balance);
      updateStage(4);
      setTimeout(() => {
        appendMessage('bot', translations[selectedLang].sendLinkSuccess(channel));
      }, 700);
      return;
    }

    if (lower.includes('pay') || lower.includes('pagar') || lower.includes('भुगतान') || lower.includes('payer') || lower.includes('friday') || lower.includes('viernes') || lower.includes('शुक्रवार') || lower.includes('vendredi') || lower.includes('sexta') || lower.includes('చెల్లి') || lower.includes('కడతా') || lower.includes(String(customerAccount.balance))) {
      const ptpRes = await callWebhook('log_promise_to_pay', {
        account_id: customerAccount.account_id,
        ptp_date: '2026-08-25',
        amount: customerAccount.balance
      });

      await callWebhook('mark_disposition', {
        account_id: customerAccount.account_id,
        status: 'PTP_AGREED',
        notes: `Agreed on PTP of $${customerAccount.balance} on 2026-08-25.`
      });

      updateRecoveryStatistics('PTP_AGREED', customerAccount.balance);
      updateStage(4);
      setTimeout(() => {
        appendMessage(
          'bot',
          translations[selectedLang].ptpSuccess(customerAccount.balance, '2026-08-25', ptpRes.ptp_id)
        );
      }, 700);
      return;
    }

    if (lower.includes('already paid') || lower.includes('ya pagué') || lower.includes('पहले ही भुगतान') || lower.includes('déjà payé') || lower.includes('já paguei') || lower.includes('చెల్లించాను') || lower.includes('కట్టేసా') || lower.includes('yesterday') || lower.includes('ayer') || lower.includes('कल') || lower.includes('నిన్న')) {
      await callWebhook('mark_disposition', {
        account_id: customerAccount.account_id,
        status: 'ALREADY_PAID',
        notes: 'Customer states payment made yesterday.'
      });

      updateRecoveryStatistics('ALREADY_PAID');
      updateStage(4);
      setTimeout(() => {
        appendMessage('bot', translations[selectedLang].alreadyPaidSuccess);
      }, 700);
      return;
    }

    if (lower.includes('lost my job') || lower.includes('trabajo') || lower.includes('नौकरी') || lower.includes('travail') || lower.includes('trabalho') || lower.includes('ఉద్యోగం') || lower.includes('కష్టం') || lower.includes('hardship') || lower.includes('dificultad') || lower.includes('khas') || lower.includes('cannot afford')) {
      const escRes = await callWebhook('escalate_to_agent', {
        account_id: customerAccount.account_id,
        reason: 'Financial Hardship',
        notes: 'Borrower requested hardship loan restructuring.'
      });

      await callWebhook('mark_disposition', {
        account_id: customerAccount.account_id,
        status: 'HARDSHIP_ESCALATED',
        notes: `Escalation ticket created: ${escRes.ticket_id}`
      });

      updateRecoveryStatistics('HARDSHIP_ESCALATED');
      updateStage(4);
      setTimeout(() => {
        appendMessage('bot', translations[selectedLang].hardshipSuccess(escRes.ticket_id));
      }, 700);
      return;
    }

    // Default response
    setTimeout(() => {
      appendMessage('bot', translations[selectedLang].defaultResponse);
    }, 600);
    return;
  }

  // STAGE 4: WRAPUP
  if (currentStage === 4) {
    setTimeout(() => {
      appendMessage('bot', 'You are very welcome. Have a wonderful rest of your day! Goodbye.');
      setTimeout(endCall, 2000);
    }, 600);
  }
}

// Enter key trigger
userInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleSendMessage();
  }
});

// Run session check on page load
checkSession();
syncDatabaseDetails();
renderChips();
loadStudioSettings();

// Load persistent call history log ledger
try {
  const cachedHistory = localStorage.getItem('kapture_call_history');
  if (cachedHistory) {
    callHistory = JSON.parse(cachedHistory);
    renderCallHistory();
  }
} catch (e) {
  console.warn('[Call History cache empty/failed]', e);
}

// Force loading of speech voices list asynchronously (specifically for Chrome/Edge async behavior)
if (synth) {
  synth.getVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = () => {
      console.log('Available Speech Voices loaded count:', synth.getVoices().length);
    };
  }
}

// Manual Webhook Tool Trigger Console
async function triggerManualTool(toolName) {
  if (!callActive) {
    alert(translations[selectedLang].alertMicStart);
    return;
  }

  let args = {};
  if (toolName === 'verify_customer') {
    const pin = document.getElementById('toolVerifyPin').value.trim();
    if (!pin) {
      alert('Please enter a 4-digit PIN first.');
      return;
    }
    args = {
      account_id: customerAccount.account_id,
      verification_code: pin
    };
  } else if (toolName === 'log_promise_to_pay') {
    const ptpDate = document.getElementById('toolPtpDate').value;
    const ptpAmt = parseFloat(document.getElementById('toolPtpAmount').value) || 0;
    args = {
      account_id: customerAccount.account_id,
      ptp_date: ptpDate,
      amount: ptpAmt
    };
  } else if (toolName === 'send_payment_link') {
    const channel = document.getElementById('toolLinkChannel').value;
    const method = document.getElementById('toolLinkMethod').value;
    args = {
      account_id: customerAccount.account_id,
      channel: channel,
      payment_method: method
    };
  } else if (toolName === 'escalate_to_agent') {
    const reason = document.getElementById('toolEscalateReason').value;
    args = {
      account_id: customerAccount.account_id,
      reason: reason,
      notes: 'Manually triggered via Call Simulator console.'
    };
  } else if (toolName === 'mark_disposition') {
    const status = document.getElementById('toolDispStatus').value;
    args = {
      account_id: customerAccount.account_id,
      status: status,
      notes: 'Manually marked via Call Simulator console.'
    };
  }

  // Print system notice of manual execution
  appendMessage('system', `[CONSOLE] Manually executing tool: "${toolName}"...`);

  // Call Webhook
  const result = await callWebhook(toolName, args);
  
  if (result) {
    // Dynamic side-effects
    if (toolName === 'verify_customer' && result.verified) {
      isCustomerVerified = true;
      authStatusBadgeEl.className = 'account-badge-box auth-unlocked';
      accStatusTextEl.innerText = translations[selectedLang].authVerified;
      accBalanceEl.innerText = fmtMoney(customerAccount.balance);
      accDueDateEl.innerText = customerAccount.dueDate;
      updateStage(2);
      appendMessage('bot', `[SYSTEM AUTH] Customer manually verified via API console. Balance disclosed.`);
    } else if (toolName === 'log_promise_to_pay' && result.success) {
      updateRecoveryStatistics('PTP_AGREED', result.amount);
      appendMessage('bot', `[SYSTEM PTP] Promise to pay logged successfully in CRM ledger for ${result.confirmed_date}.`);
    } else if (toolName === 'send_payment_link' && result.success) {
      appendMessage('bot', `[SYSTEM LINK] Payment checkout dispatched to user phone. URL: ${result.payment_url}`);
    } else if (toolName === 'mark_disposition' && result.success) {
      appendMessage('bot', `[SYSTEM DISPOSITION] CRM call outcome updated to: ${result.disposition_status}.`);
      if (['WRONG_PERSON', 'DO_NOT_CALL'].includes(result.disposition_status)) {
        setTimeout(endCall, 2000);
      }
    } else if (toolName === 'escalate_to_agent' && result.success) {
      appendMessage('bot', `[SYSTEM ESCALATION] Support ticket ${result.ticket_id} created. Routing to live team.`);
    }
  } else {
    appendMessage('system', `[CONSOLE] Tool execution failed.`);
  }
}

// ==========================================
// VAPI AGENT STUDIO INTEGRATION LOGIC
// ==========================================

let studioCallActive = false;
let studioVapiInstance = null;
let studioSyncInterval = null;

// Load settings on startup
function loadStudioSettings() {
  const savedKey = localStorage.getItem('kapture_studio_vapi_key');
  let savedAssId = localStorage.getItem('kapture_studio_vapi_ass_id');
  const savedBase = localStorage.getItem('kapture_studio_server_base');
  const savedFirst = localStorage.getItem('kapture_studio_first_msg');
  const savedPrompt = localStorage.getItem('kapture_studio_system_prompt');
  
  const savedLang = localStorage.getItem('kapture_studio_transcriber_lang');
  const savedModel = localStorage.getItem('kapture_studio_model');
  const savedVoice = localStorage.getItem('kapture_studio_voice');

  // Self-heal: Clean up any saved placeholder text to ensure fallback works
  if (savedAssId === 'Maya Assistant ID' || savedAssId === 'Enter Assistant ID') {
    localStorage.removeItem('kapture_studio_vapi_ass_id');
    savedAssId = null;
  }

  if (savedKey) document.getElementById('studioVapiPublicKey').value = savedKey;
  
  // Prefill the newly created Assistant ID as default fallback
  document.getElementById('studioVapiAssistantId').value = savedAssId || 'e27f5da2-6991-4a5e-9f7e-591704ddf80f';
  
  // Prefill the Render server base URL as default fallback
  document.getElementById('studioServerBaseUrl').value = savedBase || 'https://kapture-collections-voicebot-lxjv.onrender.com';
  
  if (savedFirst) document.getElementById('studioFirstMessage').value = savedFirst;
  if (savedLang) document.getElementById('studioTranscriberLang').value = savedLang;
  if (savedModel) document.getElementById('studioModelSelect').value = savedModel;
  if (savedVoice) document.getElementById('studioVoiceSelect').value = savedVoice;
  
  if (savedPrompt) {
    document.getElementById('studioSystemPrompt').value = savedPrompt;
  } else {
    loadSystemPrompt(false); // Fetch from backend server
  }
}

// Save settings to LocalStorage
function saveStudioSettings() {
  const key = document.getElementById('studioVapiPublicKey').value.trim();
  const assId = document.getElementById('studioVapiAssistantId').value.trim();
  const base = document.getElementById('studioServerBaseUrl').value.trim();
  const first = document.getElementById('studioFirstMessage').value;
  const prompt = document.getElementById('studioSystemPrompt').value;
  
  const lang = document.getElementById('studioTranscriberLang').value;
  const model = document.getElementById('studioModelSelect').value;
  const voice = document.getElementById('studioVoiceSelect').value;

  localStorage.setItem('kapture_studio_vapi_key', key);
  localStorage.setItem('kapture_studio_vapi_ass_id', assId);
  localStorage.setItem('kapture_studio_server_base', base);
  localStorage.setItem('kapture_studio_first_msg', first);
  localStorage.setItem('kapture_studio_system_prompt', prompt);
  
  localStorage.setItem('kapture_studio_transcriber_lang', lang);
  localStorage.setItem('kapture_studio_model', model);
  localStorage.setItem('kapture_studio_voice', voice);
}

// Load system prompt from backend
async function loadSystemPrompt(forceReset = false) {
  if (!forceReset && localStorage.getItem('kapture_studio_system_prompt')) {
    return;
  }
  
  try {
    const res = await fetch('/api/config/prompt');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('studioSystemPrompt').value = data.prompt;
      saveStudioSettings();
    }
  } catch (err) {
    console.error('Error fetching system prompt:', err);
  }
}

// Append messages to the Vapi Studio Chat feed
function appendStudioMessage(sender, text) {
  const feed = document.getElementById('studioTranscriptFeed');
  if (!feed) return;

  // Clear empty message prompt
  const emptyMsg = document.getElementById('studioEmptyTranscriptMsg');
  if (emptyMsg) emptyMsg.style.display = 'none';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${sender.toLowerCase()}`;
  
  const senderLabel = document.createElement('div');
  senderLabel.className = 'msg-sender';
  
  if (sender === 'bot') {
    senderLabel.innerText = '🤖 Assistant (Vapi)';
  } else if (sender === 'system') {
    senderLabel.innerText = '⚙️ System';
  } else {
    senderLabel.innerText = '👤 User';
  }
  
  const textEl = document.createElement('div');
  textEl.innerText = text;
  
  bubble.appendChild(senderLabel);
  bubble.appendChild(textEl);
  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

// Append tool executions to Vapi Studio Chat feed as badges
function appendStudioToolBadge(toolName, success = true, detail = 'Completed successfully') {
  const feed = document.getElementById('studioTranscriptFeed');
  if (!feed) return;

  const emptyMsg = document.getElementById('studioEmptyTranscriptMsg');
  if (emptyMsg) emptyMsg.style.display = 'none';

  const badge = document.createElement('div');
  badge.className = `tool-status-badge ${success ? 'success' : 'info'}`;
  
  badge.innerHTML = `
    <span class="tool-badge-icon">🔧</span>
    <div class="tool-badge-details">
      <strong>${toolName}</strong>
      <span style="font-size: 11px; margin-left: 10px;">${detail}</span>
      <span class="tool-badge-time">${new Date().toLocaleTimeString()}</span>
    </div>
  `;
  
  feed.appendChild(badge);
  feed.scrollTop = feed.scrollHeight;
}

// Missing local tool call logger function
function logToolCall(name, args, result) {
  if (!toolFeedEl) return;
  
  // Clear any default empty message
  if (toolFeedEl.querySelector('.text-dim') || toolFeedEl.innerText.includes('No tool triggers')) {
    toolFeedEl.innerHTML = '';
  }

  const toolItem = document.createElement('div');
  toolItem.className = 'tool-item';

  const toolHeader = document.createElement('div');
  toolHeader.className = 'tool-header';
  
  const title = document.createElement('span');
  title.innerText = `🛠️ ${name}`;
  
  const time = document.createElement('span');
  time.style.color = 'var(--text-muted)';
  time.innerText = new Date().toLocaleTimeString();
  
  toolHeader.appendChild(title);
  toolHeader.appendChild(time);
  toolItem.appendChild(toolHeader);

  const argsPre = document.createElement('pre');
  argsPre.className = 'tool-json';
  argsPre.innerText = JSON.stringify(args, null, 2);
  toolItem.appendChild(argsPre);

  const resPre = document.createElement('pre');
  resPre.className = 'tool-json';
  resPre.innerText = JSON.stringify(result, null, 2);
  toolItem.appendChild(resPre);

  toolFeedEl.appendChild(toolItem);
  toolFeedEl.scrollTop = toolFeedEl.scrollHeight;
  
  // Also push to Vapi Studio Chat feed if studio tab is active/used
  appendStudioToolBadge(name, !result.error, result.error ? `Failed: ${result.error}` : 'Completed successfully');
}

// Synchronize CRM database state with the mock backend
async function syncStudioLedger() {
  const serverBase = document.getElementById('studioServerBaseUrl').value.trim();
  const url = (serverBase ? serverBase.replace(/\/$/, '') : '') + '/api/ledger/state';
  
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const state = await res.json();
    
    // Sync outstanding balance and verification state
    const account = state.accounts[customerAccount.account_id] || state.accounts['ACC-80291'];
    if (account) {
      customerAccount.balance = account.outstanding_balance;
      
      const verifyLog = state.logs.find(log => log.account_id === customerAccount.account_id && log.transaction_id.startsWith('VERIFY') && log.status === 'SUCCESS');
      if (verifyLog) {
        isCustomerVerified = true;
        authStatusBadgeEl.className = 'account-badge-box auth-unlocked';
        accStatusTextEl.innerText = translations[selectedLang].authVerified;
        accBalanceEl.innerText = fmtMoney(customerAccount.balance);
        accDueDateEl.innerText = customerAccount.dueDate;
        
        if (currentStage === 1) {
          updateStage(2);
        }
      }
      
      if (account.payment_link_sent && currentStage < 3) {
        updateStage(3);
      }
      
      if (account.ptp_date) {
        if (currentStage < 4) {
          updateStage(4);
        }
        updateRecoveryStatistics('PTP_AGREED', 8499.0 - account.outstanding_balance);
      }
      
      if (account.last_disposition) {
        activeCallDisposition = account.last_disposition;
      }
      
      syncDatabaseDetails();
    }
  } catch (err) {
    console.error('CRM sync error:', err);
  }
}

// Setup Vapi WebRTC events
function setupStudioVapiEvents() {
  if (!studioVapiInstance) return;

  const talkBtn = document.getElementById('studioTalkBtn');
  const talkIcon = document.getElementById('studioTalkIcon');
  const talkText = document.getElementById('studioTalkText');

  studioVapiInstance.on('call-start', () => {
    console.log('[Vapi Studio] Call started');
    studioCallActive = true;
    
    // UI update
    talkBtn.classList.add('active');
    talkIcon.innerText = '🔴';
    talkText.innerText = 'Stop';
    
    appendStudioMessage('system', 'Outbound call connected. Vapi Live Assistant speaking...');
    
    // Start database polling to sync CRM state during the call
    clearInterval(studioSyncInterval);
    studioSyncInterval = setInterval(syncStudioLedger, 2500);
  });

  studioVapiInstance.on('call-end', () => {
    console.log('[Vapi Studio] Call ended');
    studioCallActive = false;
    
    talkBtn.classList.remove('active');
    talkIcon.innerText = '📞';
    talkText.innerText = 'Talk';
    
    appendStudioMessage('system', 'Outbound call disconnected.');
    
    clearInterval(studioSyncInterval);
    syncStudioLedger(); // final sync
  });

  studioVapiInstance.on('speech-start', () => {
    voiceWaveEl.classList.add('wave-active');
  });

  studioVapiInstance.on('speech-end', () => {
    voiceWaveEl.classList.remove('wave-active');
  });

  studioVapiInstance.on('message', (message) => {
    if (message.type === 'transcript' && message.transcriptType === 'final') {
      const sender = message.role === 'assistant' ? 'bot' : 'user';
      appendStudioMessage(sender, message.transcript);
    }
    
    if (message.type === 'tool-calls') {
      setTimeout(syncStudioLedger, 500);
    }
  });

  studioVapiInstance.on('error', (err) => {
    console.error('[Vapi Studio Error]', err);
    let errMsg = '';
    if (err && typeof err === 'object') {
      errMsg = err.message || err.error?.message || err.error || JSON.stringify(err);
    } else {
      errMsg = String(err);
    }
    appendStudioMessage('system', `Connection Error: ${errMsg}`);
    
    studioCallActive = false;
    talkBtn.classList.remove('active');
    talkIcon.innerText = '📞';
    talkText.innerText = 'Talk';
    clearInterval(studioSyncInterval);
  });
}

// Toggle WebRTC call connection from Vapi Agent Studio
function toggleStudioCall() {
  if (studioCallActive) {
    if (studioVapiInstance) {
      studioVapiInstance.stop();
    }
    return;
  }

  // Validate that Vapi library has loaded successfully
  if (!window.Vapi) {
    alert('The Vapi SDK library is still loading or failed to load from CDN. Please check your internet connection or console errors.');
    return;
  }

  const key = document.getElementById('studioVapiPublicKey').value.trim();
  const assId = document.getElementById('studioVapiAssistantId').value.trim();
  
  if (!key || !assId) {
    alert('Please enter your Vapi Public Key and Vapi Assistant ID in the Connection Settings block. Scroll down the right-hand panel to access these inputs.');
    return;
  }

  saveStudioSettings();

  if (!studioVapiInstance) {
    studioVapiInstance = new window.Vapi(key);
    setupStudioVapiEvents();
  }

  document.getElementById('studioTranscriptFeed').innerHTML = '';
  appendStudioMessage('system', `Dialing outbound collections lines for ${customerAccount.name}...`);

  const firstMsg = document.getElementById('studioFirstMessage').value.trim();
  const sysPrompt = document.getElementById('studioSystemPrompt').value;
  
  const selectedLang = document.getElementById('studioTranscriberLang').value;
  const selectedModel = document.getElementById('studioModelSelect').value;
  const selectedVoice = document.getElementById('studioVoiceSelect').value;

  // Build model configuration
  const modelConfig = {
    provider: 'openai',
    model: selectedModel,
    messages: [
      { role: 'system', content: sysPrompt }
    ]
  };

  // Build transcriber configuration
  const transcriberConfig = {
    provider: 'deepgram',
    model: 'nova-2',
    language: selectedLang
  };

  // Start Vapi Call with dynamic assistant configurations overriding
  const options = {
    customer: {
      number: customerAccount.phone,
      name: customerAccount.name
    },
    assistant: {
      firstMessage: firstMsg,
      model: modelConfig,
      transcriber: transcriberConfig,
      variableValues: {
        customer_name: customerAccount.name,
        account_id: customerAccount.account_id,
        outstanding_balance: customerAccount.balance,
        due_date: customerAccount.dueDate
      }
    }
  };

  // Optionally override the Voice parameter if custom is not selected
  if (selectedVoice !== 'custom') {
    options.assistant.voice = {
      provider: 'vapi',
      voiceId: selectedVoice
    };
  }

  studioVapiInstance.start(assId, options);
}
