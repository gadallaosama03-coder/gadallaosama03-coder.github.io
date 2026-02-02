/** LOGIN.JS - Authentication & Gatekeeper (Worker Edition) */

/* Configurazione */
// INSERISCI QUI L'URL DEL TUO CLOUDFLARE WORKER
const WORKER_URL = "/send-email"; 

const doc = document, gebi = id => doc.getElementById(id), ce = tag => doc.createElement(tag);
let serverCodeHash = null; // Variabile per memorizzare il codice ricevuto (per verifica)

/* Main Entry Point */
doc.addEventListener('DOMContentLoaded', () => {
    injectHyperLoginStyles();
    
    // 1. Controllo Sessione (Se l'utente è già loggato in passato)
    if (localStorage.getItem('SESSION_KEY') === 'true') {
        loadMainScript();
    } else {
        createHyperLoginGate();
    }
});

/* Secure Loader - Carica il vero sito solo se autenticato */
function loadMainScript() {
    console.log(">>> Auth Verified. Loading Core System...");
    const s = ce('script');
    s.src = "script.js"; // Il file con il codice "segreto" del configuratore
    s.defer = true;
    s.onload = () => {
        doc.body.classList.remove('login-mode');
        // Rimuove il login overlay dal DOM per pulizia
        const overlay = gebi('hyper-gate-overlay');
        if(overlay) overlay.remove();
        console.log(">>> System Ready");
    };
    doc.body.appendChild(s);
}

/* UI Builder */
function createHyperLoginGate() {
    doc.body.classList.add('login-mode');
    const d = ce('div');
    d.id = 'hyper-gate-overlay';

    d.innerHTML = `
    <div class="login-header-right">
        <button class="login-icon-btn" onclick="toggleLoginHelp()" title="Help">?</button>
    </div>
    
    <div id="login-help-overlay" onclick="toggleLoginHelp()">
        <div class="help-modal-card" onclick="event.stopPropagation()">
            <div class="help-header"><span>Need Help?</span><span style="cursor:pointer;font-size:20px;" onclick="toggleLoginHelp()">&times;</span></div>
            <div class="help-body">
                <div class="help-text">Non ricevi il codice?</div>
                <ul class="help-list">
                    <li><b>Controlla lo Spam:</b> Spesso finisce lì.</li>
                    <li><b>Email Aziendale:</b> Usa la tua email @advantech.</li>
                    <li><b>Attendi:</b> Ci può mettere fino a 60 secondi.</li>
                </ul>
                <button class="btn-hyper-main" onclick="toggleLoginHelp()">Chiudi</button>
            </div>
        </div>
    </div>

    <div class="hyper-card">
        <div class="hyper-logo">ADVANTECH</div>
        <div class="hyper-subtitle">Product Configurator</div>
        
        <div class="wizard-container">
            <div class="wizard-slide active" id="slide-1">
                <div class="slide-icon">👋</div>
                <div class="slide-title">Welcome</div>
                <div class="slide-desc">Accedi per visualizzare prezzi e disponibilità in tempo reale.</div>
                <button class="btn-hyper-main" onclick="nextSlide(2)">Inizia</button>
            </div>

            <div class="wizard-slide" id="slide-2">
                <div class="slide-icon">⚡</div>
                <div class="slide-title">Smart Features</div>
                <div class="slide-desc">Datasheet tecnici, comparazioni e configurazioni salvate.</div>
                <div style="display:flex;gap:15px;width:100%">
                    <button class="btn-secondary" style="flex:1" onclick="nextSlide(1)">Indietro</button>
                    <button class="btn-hyper-main" style="flex:1" onclick="nextSlide(3)">Avanti</button>
                </div>
            </div>

            <div class="wizard-slide" id="slide-3">
                <div class="slide-icon">🔒</div>
                <div class="slide-title">Accesso Sicuro</div>
                
                <div id="step-email-container">
                    <div class="slide-desc" style="margin-bottom:15px">
                        Inserisci la tua email aziendale per ricevere il codice OTP.
                    </div>
                    <input type="email" id="magic-email" class="email-input" placeholder="name.surname@advantech.com" onkeyup="checkTerms()">
                    
                    <div class="terms-container">
                        <input type="checkbox" id="terms-check" onchange="checkTerms()">
                        <span>Accetto i <a href="#" class="terms-link">Termini di utilizzo</a>.</span>
                    </div>

                    <button id="btn-send-code" class="btn-hyper-main" onclick="requestOtpCode()" disabled>
                        <span>Invia Codice</span>
                    </button>
                </div>

                <div id="step-code-container" style="display:none; animation: slideIn 0.4s;">
                    <div class="slide-desc" style="margin-bottom:15px; color:#38BDF8">
                        Email inviata! Inserisci il codice a 6 cifre appena ricevuto.
                    </div>
                    
                    <input type="text" id="otp-input" class="email-input" placeholder="123456" maxlength="6" style="letter-spacing: 5px; font-weight: bold; font-size: 24px;">
                    
                    <button id="btn-verify-code" class="btn-hyper-main" onclick="verifyOtpCode()">
                        <span>Verifica & Accedi</span>
                    </button>
                    
                    <div style="margin-top:15px">
                        <span class="resend-link" onclick="resetLogin()">Email sbagliata? Ricomincia</span>
                    </div>
                </div>
                
                <div id="status-area" class="status-box"></div>

                <button class="btn-secondary" onclick="nextSlide(2)" style="margin-top:10px" id="back-btn-login">Indietro</button>
            </div>
        </div>

        <div class="dots-container">
            <div class="dot active" id="dot-1"></div>
            <div class="dot" id="dot-2"></div>
            <div class="dot" id="dot-3"></div>
        </div>
    </div>`;
    
    doc.body.appendChild(d);
}

/* --- LOGICA COMUNICAZIONE CON WORKER --- */

async function requestOtpCode() {
    const email = gebi('magic-email').value.trim();
    const btn = gebi('btn-send-code');
    
    // Validazione base
    if (!email.includes('@') || email.length < 5) {
        showStatus('Inserisci una email valida.', 'error');
        return;
    }

    // UI Loading
    btn.innerText = "Invio in corso...";
    btn.disabled = true;
    showStatus('', 'none');

    try {
        // Chiamata al Cloudflare Worker
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();

        if (response.ok && (data.success || data.status === "Inviato")) {
            // SUCCESS: Email inviata
            // Nota: Se stiamo usando la versione "debug_code" del worker, salviamo il codice per verifica client-side
            // Se usi un sistema KV server-side, questa parte cambia.
            // Per ora, assumiamo che il worker ti risponda con { debug_code: 123456 } come nel tuo esempio
            
            if(data.debug_code) {
                serverCodeHash = String(data.debug_code); 
                // NOTA SICUREZZA: In un sistema bancario, non manderemmo il codice al client.
                // Ma per questo use-case, ci permette di verificare senza database.
            }

            // Cambia interfaccia: Nascondi Email, Mostra Codice
            gebi('step-email-container').style.display = 'none';
            gebi('step-code-container').style.display = 'block';
            gebi('back-btn-login').style.display = 'none'; // Nascondi tasto indietro per non incasinare il flusso
            
            showStatus('Controlla la tua posta (anche Spam).', 'success');

        } else {
            throw new Error(data.details || "Errore sconosciuto");
        }

    } catch (error) {
        console.error(error);
        showStatus('Errore invio: ' + error.message, 'error');
        btn.innerText = "Riprova";
        btn.disabled = false;
    }
}

function verifyOtpCode() {
    const userCode = gebi('otp-input').value.trim();
    
    if (userCode.length < 4) {
        showStatus('Inserisci il codice completo.', 'error');
        return;
    }

    // VERIFICA DEL CODICE
    // Qui confrontiamo quello che l'utente ha scritto con quello che il Worker ci ha "suggerito"
    // (O, se evolviamo il sistema, faremmo una seconda chiamata API al worker per verificare)
    
    if (serverCodeHash && userCode === serverCodeHash) {
        // SUCCESS!
        showStatus('Codice Corretto! Accesso in corso...', 'success');
        
        // Salva la sessione per il futuro
        localStorage.setItem('SESSION_KEY', 'true');
        
        // Carica lo script vero
        setTimeout(() => {
            loadMainScript();
        }, 1000); // Piccolo ritardo scenico
        
    } else {
        showStatus('Codice Errato. Riprova.', 'error');
        gebi('otp-input').value = '';
        gebi('otp-input').focus();
    }
}

function resetLogin() {
    gebi('step-email-container').style.display = 'block';
    gebi('step-code-container').style.display = 'none';
    gebi('btn-send-code').innerText = "Invia Codice";
    gebi('btn-send-code').disabled = false;
    gebi('back-btn-login').style.display = 'inline-block';
    showStatus('', 'none');
}

/* Helpers Grafici e Logici (Invariati) */
function checkTerms() {
    const c = gebi('terms-check'), m = gebi('magic-email').value.trim(), b = gebi('btn-send-code');
    if (c.checked && m.includes('@') && m.length > 5) {
        b.disabled = false;
        b.style.opacity = "1";
    } else {
        b.disabled = true;
        b.style.opacity = "0.5";
    }
}

function nextSlide(n) {
    doc.querySelectorAll('.wizard-slide').forEach(s => s.classList.remove('active'));
    doc.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
    const t = gebi('slide-' + n), d = gebi('dot-' + n);
    if (t) t.classList.add('active');
    if (d) d.classList.add('active');
}

function toggleLoginHelp() {
    const o = gebi('login-help-overlay');
    o.style.display = (o.style.display === 'flex') ? 'none' : 'flex';
}

function showStatus(msg, type) {
    const b = gebi('status-area');
    if (type === 'none') { b.style.display = 'none'; return; }
    b.innerHTML = msg;
    b.className = 'status-box ' + type;
    b.style.display = 'block';
}

/* CSS Styles - Stesso design di prima */
function injectHyperLoginStyles() {
    const s = ce('style');
    s.innerHTML = `
    body.login-mode .search-wrapper,body.login-mode #controls,body.login-mode header,body.login-mode #main-table-container{display:none!important} 
    #hyper-gate-overlay{position:fixed;inset:0;background:radial-gradient(circle at center,#0f172a,#020617);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;animation:hyperFadeIn .6s forwards} 
    
    .hyper-card{width:480px;max-width:90%;background:#1e293b;border:1px solid #334155;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);padding:40px;text-align:center;position:relative;display:flex;flex-direction:column;align-items:center;} 
    
    .hyper-logo{font-size:36px;font-weight:900;background:linear-gradient(135deg,#38BDF8,#0070E0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:5px;letter-spacing:-1px;} 
    .hyper-subtitle{color:#94A3B8;font-size:12px;font-weight:700;margin-bottom:30px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #334155;padding-bottom:15px;width:100%;} 
    
    .wizard-container{width:100%;min-height:320px;position:relative} 
    .wizard-slide{display:none;flex-direction:column;align-items:center;animation:slideIn .4s ease;width:100%} 
    .wizard-slide.active{display:flex} 
    
    .slide-icon{font-size:48px;margin-bottom:20px;filter:drop-shadow(0 0 30px rgba(56,189,248,0.2))} 
    .slide-title{color:#fff;font-size:20px;font-weight:700;margin-bottom:12px;} 
    .slide-desc{color:#94A3B8;font-size:14px;line-height:1.6;margin-bottom:30px;max-width:380px;} 
    
    .dots-container{display:flex;gap:8px;margin-top:30px;} 
    .dot{width:8px;height:8px;border-radius:50%;background:#334155;transition:all .3s} 
    .dot.active{background:#38BDF8;width:24px;border-radius:10px} 
    
    /* Input Styling */
    .email-input{background:#0f172a;border:1px solid #334155;color:#fff;padding:16px;width:100%;border-radius:10px;margin-bottom:15px;text-align:center;outline:none;font-size:15px;transition:all 0.2s;box-sizing:border-box;} 
    .email-input:focus{border-color:#38BDF8;box-shadow:0 0 0 2px rgba(56,189,248,0.2);} 
    
    /* Checkbox & Terms */
    .terms-container{display:flex;align-items:start;gap:12px;text-align:left;font-size:13px;color:#94A3B8;margin-bottom:25px;width:100%;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #334155;box-sizing:border-box;} 
    .terms-container input{margin-top:3px;accent-color:#38BDF8;cursor:pointer;width:16px;height:16px;} 
    .terms-link{color:#38BDF8;text-decoration:none;font-weight:600;} 
    .terms-link:hover{text-decoration:underline;}
    
    /* Buttons */
    .btn-hyper-main{background:linear-gradient(135deg,#0070E0,#0284C7);color:#fff;border:none;width:100%;padding:16px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(0,112,224,0.3);margin-top:5px;text-transform:uppercase;letter-spacing:0.5px;} 
    .btn-hyper-main:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,112,224,0.5);} 
    .btn-hyper-main:disabled{opacity:0.5;cursor:not-allowed;background:#334155;transform:none;box-shadow:none;filter:grayscale(1);} 
    
    .btn-secondary{background:transparent;border:1px solid #334155;color:#94A3B8;padding:10px 20px;border-radius:8px;cursor:pointer;margin-top:15px;font-size:12px;font-weight:600;transition:all 0.2s;} 
    .btn-secondary:hover{border-color:#fff;color:#fff;} 
    
    /* Help Button (Corner) */
    .login-header-right{position:absolute;top:20px;right:20px;z-index:100001;}
    .login-icon-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94A3B8;width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all 0.2s;}
    .login-icon-btn:hover{background:rgba(255,255,255,0.15);color:white;border-color:white;}
    
    /* Status Box */
    .status-box{margin-top:15px;padding:15px;border-radius:10px;font-size:13px;width:100%;box-sizing:border-box;display:none;line-height:1.5;text-align:left;}
    .status-box.success{background:rgba(16,185,129,0.1);border:1px solid #10B981;color:#10B981;}
    .status-box.error{background:rgba(239,68,68,0.1);border:1px solid #EF4444;color:#EF4444;}
    .resend-link{color:#38BDF8;text-decoration:underline;cursor:pointer;margin-top:10px;display:inline-block;font-size:12px;font-weight:600;}
    
    /* Help Modal */
    #login-help-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:100002;align-items:center;justify-content:center;animation:hyperFadeIn 0.3s;}
    .help-modal-card{width:400px;background:#1e293b;border:1px solid #334155;border-radius:16px;box-shadow:0 25px 50px rgba(0,0,0,0.6);overflow:hidden;}
    .help-header{background:linear-gradient(135deg,#0070E0,#0284C7);padding:15px 20px;color:white;display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:1px;}
    .help-body{padding:25px;}
    .help-text{font-size:14px;color:#cbd5e1;line-height:1.6;margin-bottom:20px;}
    .help-list{margin:0;padding-left:20px;color:#94a3b8;font-size:13px;margin-bottom:20px;}
    .help-list li{margin-bottom:8px;}
    
    @keyframes hyperFadeIn{to{opacity:1}} 
    @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`;
    doc.head.appendChild(s);
}