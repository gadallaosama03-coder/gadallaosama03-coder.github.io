/**
 * SCRIPT.JS - Part 1/2
 * Logic, UI, Event Listeners.
 */

let CURRENT_LANG = localStorage.getItem(LANG_KEY) || 'EN';
let INDISPENSABLE_FILTERS=[], OPTIONAL_FILTERS_STATE={}, GLOBAL_DATA=[], DB2_STRUCTURE={}, ACTIVE_FILTERS={}, CURRENT_VISIBLE_DATA=[], CURRENT_CATEGORY=null, loadingTimeout;
let TABLE_LIMIT = 30, CURRENT_PAGE = 1;
let CLIENT_IP = 'Unknown'; 

// HELPER: 
const cleanStr = (s) => String(s||'').toLowerCase().replace(/["'”’‘`]/g,'').replace(/\b(inch|inches|cm|mm)\b/g,'').replace(/[()\[\]]/g,' ').replace(/\s+/g,' ').trim();
const doc=document, gebi=id=>doc.getElementById(id), ce=tag=>doc.createElement(tag);
const t = (key) => (TRANSLATIONS[CURRENT_LANG] && TRANSLATIONS[CURRENT_LANG].labels[key]) ? TRANSLATIONS[CURRENT_LANG].labels[key] : (TRANSLATIONS['EN'].labels[key] || key);
const setLang = (l) => { CURRENT_LANG=l; localStorage.setItem(LANG_KEY,l); location.reload(); };

doc.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('popstate', e => { (e.state && e.state.view === 'list') ? (e.state.category && selectCategory(e.state.category, false)) : returnToHome(false); });
doc.addEventListener('click', (e) => { if(!e.target.closest('.lang-wrapper')) { const m = doc.querySelector('.lang-menu'); if(m && m.classList.contains('show')) m.classList.remove('show'); } });

// App initialization
async function initApp(){
    console.log(">>> SCRIPT FINALIZED: UNIFIED BUTTON STYLES <<<");
    if(TRANSLATIONS[CURRENT_LANG].dir === 'rtl') { doc.documentElement.setAttribute('dir', 'rtl'); }
    injectStyles(); injectHyperLoginStyles(); 
    injectAutocompleteStyles(); // <--- ADD THIS LINE HERE
    injectHelpModal(); injectSupportModal(); injectBugModal(); injectSmartNav(); injectLanguageSelector(); injectHeaderControls(); updateTableHeaders();
    
    fetchClientIP(); 

    if(!checkSession()){ createHyperLoginGate(); return; }
    doc.body.classList.remove('login-mode'); history.replaceState({view:'home'},'','#home'); startMainAppLogic();
}

function updateTableHeaders(){
    const row=doc.querySelector('#main-table-container thead tr'); if(!row)return;
    
    // Common styles
    const style = 'style="text-align:center;"';
    const sticky = 'class="sticky-col" style="text-align:center;"';

    if(CURRENT_CATEGORY === 'monitor'){
        // MONITOR: Status, PN, Size, Resolution, Touch, Actions
        row.innerHTML = `
            <th ${style}>${t('Status')}</th>
            <th ${style}>${t('PN')}</th>
            <th ${style}>${t('size')}</th>
            <th ${style}>${t('Resolution')}</th>
            <th ${style}>${t('Touch')}</th>
            <th ${sticky}>${t('Actions')}</th>`;
    } else {
        // HMI: Status, PN, LTB, Size, Res, CPU, APPLICATION, Touch, Actions
        row.innerHTML = `
            <th ${style}>${t('Status')}</th>
            <th ${style}>${t('PN')}</th>
            <th ${style}>${t('LTB')}</th>
            <th ${style}>${t('size')}</th>
            <th ${style}>${t('Resolution')}</th>
            <th ${style}>${t('CPU')}</th>
            <th ${style}>${t('APPLICATION')}</th>
            <th ${style}>${t('Touch').toUpperCase()}</th>
            <th ${sticky}>${t('Actions')}</th>`;
    }
}
// HELPER: Fetch Client IP
async function fetchClientIP(){
    try{
        const r = await fetch('https://api.ipify.org?format=json'); 
        if(r.ok){ 
            const d = await r.json(); 
            CLIENT_IP = d.ip; 
            console.log("Client IP Detected:", CLIENT_IP);
        }
    }catch(e){ 
        console.warn("Could not fetch IP:", e); 
    }
}
// Start main logic and search listeners
function startMainAppLogic(){
    const savedTheme=localStorage.getItem('theme')||'dark'; doc.documentElement.setAttribute('data-theme',savedTheme); updateThemeIcon(savedTheme);
    const search=gebi('pn-search');
    if(search){
        search.placeholder = t('Search');
        search.addEventListener('focus', ()=>search.value.trim()===''&&showSearchHistory());
        search.addEventListener('input', (e) => {
            const val=e.target.value.trim(), landing=gebi('landing-page');
            if(landing&&landing.style.display!=='none'&&val.length>0){ landing.style.display='none'; gebi('main-app-container').style.display='block'; gebi('controls').style.display='block'; if(!CURRENT_CATEGORY)selectCategory('hmi',true,true); }
            if(val.length>0)resetFilterValuesOnly();
            val===''? (showSearchHistory(),applyFilters()) : (showSuggestions(val),applyFilters());
        });
        search.addEventListener('keypress',e=>{ if(e.key==='Enter'){ gebi('search-suggestions-box').style.display='none'; saveToHistory(search.value); resetFilterValuesOnly(); applyFilters(true); } });
        doc.addEventListener('click',e=>{if(!e.target.closest('.search-wrapper'))gebi('search-suggestions-box').style.display='none';});
    }
    loadingTimeout=setTimeout(()=>{if(gebi('loading').style.display!=='none')showMaintenanceScreen();},3000); loadDatabase();
}

// Show maintenance screen on error
function showMaintenanceScreen(){
    const l=gebi('loading'); if(l) l.style.display='none';
    const existing=gebi('maint-overlay'); if(existing) return;
    const div=ce('div'); div.id='maint-overlay';
    div.innerHTML=`<div class="maint-icon">🛠️</div><div class="maint-title">System Maintenance</div><div class="maint-desc">The product catalog is currently synchronizing. <br>Please check back in a few moments.</div><button class="btn-retry" onclick="location.reload()">Retry Connection</button>`;
    doc.body.appendChild(div);
}

// Inject floating nav
function injectSmartNav(){
    const div=ce('div'); div.className='smart-nav-floater';
    div.innerHTML=`<button onclick="window.history.back()" title="${t('')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> <span style="font-size:12px;font-weight:700;margin-left:5px;">${t('').toUpperCase()}</span></button>`;
    doc.body.appendChild(div);
}

// Inject language selector
function injectLanguageSelector(){
    const themeBtn = doc.querySelector('.theme-toggle'), container = themeBtn ? themeBtn.parentNode : doc.body; 
    const wrapper = ce('div'); wrapper.className = 'lang-wrapper';
    let menuItems = Object.keys(TRANSLATIONS).map(k => `<div class="lang-opt ${CURRENT_LANG===k?'active':''}" onclick="setLang('${k}')"><span>${TRANSLATIONS[k].name}</span>${CURRENT_LANG===k ? '<span>✓</span>' : ''}</div>`).join('');
    wrapper.innerHTML = `<button class="std-header-btn" onclick="toggleLangMenu(this)" title="Change Language" style="border-radius:10px;"><span class="lang-code">${CURRENT_LANG}</span></button><div class="lang-menu"><div class="lang-header">Select Language</div><div class="lang-list">${menuItems}</div></div>`;
    if(themeBtn && themeBtn.parentNode) { container.insertBefore(wrapper, themeBtn); } else { wrapper.style.cssText = "position:fixed;top:20px;left:20px;z-index:110000;"; doc.body.appendChild(wrapper); }
}

// Toggle language menu
function toggleLangMenu(btn){ const wrapper = btn.closest('.lang-wrapper'); const menu = wrapper.querySelector('.lang-menu'); menu.classList.toggle('show'); }

// Inject Help Modal (Guide)
function injectHelpModal(){
    ['help-banner', 'guide-banner', 'support-hub'].forEach(id => { const el = gebi(id); if(el) el.remove(); });
    const modalStyle = "display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:650px;max-width:90%;max-height:85vh;overflow-y:auto;background:var(--bg-card);border:2px solid var(--border);border-radius:16px;padding:30px;z-index:100002;box-shadow:0 25px 50px rgba(0,0,0,0.5);text-align:left;color:var(--text-main);";
    const guideDiv=ce('div'); guideDiv.id='guide-banner'; guideDiv.style.cssText=modalStyle;
    const videoWrapperStyle = `position: relative; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6); background: black; width: 100%; display: flex; justify-content: center; align-items: center;`;
    const overlayStyle = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); cursor: pointer; z-index: 10; transition: opacity 0.4s ease, visibility 0.4s;`;
    const playBtnStyle = `width: 80px; height: 80px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 8px 32px rgba(0,0,0,0.3); transition: transform 0.2s;`;
    const badgeStyle = `display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg, var(--primary), #3b82f6); color:white; padding:6px 14px; border-radius:20px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px; box-shadow:0 4px 15px rgba(0,112,224,0.4); border:1px solid rgba(255,255,255,0.2);`;
    guideDiv.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;"><h3 style="margin:0;font-size:20px;">Quick Guide</h3><span onclick="toggleGuide()" style="cursor:pointer;font-size:28px;line-height:1;">&times;</span></div><div style="background:var(--hover-row);padding:15px;border-radius:8px;margin-bottom:25px;border:1px solid var(--border);"><ul style="margin:0;padding-left:20px;line-height:1.6;font-size:14px;"></li><li><b>Smart Search:</b> Type P/N or keywords freely. Spaces and special characters are ignored.</li><li><b>Filters:</b> Use "Customize Filters" to refine results by adding or removing them.</li><li><b>Tip:</b> For best results, use filters separately from the Smart Search.</li><li><b>Details:</b> Click on any P/N to access product specifics.</li></ul></div><div style="margin-bottom:25px; border-top:1px solid var(--border); padding-top:20px;"><div style="${videoWrapperStyle}"><video id="guide-video" style="width:100%; max-height:380px; object-fit:contain;" preload="auto" controlsList="nodownload" onended="resetGuideVideo()" onplaying="hideGuideOverlay()" onerror="handleVideoError()"><source src="VIDEOGUIDE.mp4" type="video/mp4"></video><div id="vid-overlay" style="${overlayStyle}" onclick="playGuideVideo()" onmouseover="this.querySelector('.play-icon').style.transform='scale(1.1)'" onmouseout="this.querySelector('.play-icon').style.transform='scale(1)'"><div class="play-icon" style="${playBtnStyle}"><svg width="35" height="35" viewBox="0 0 24 24" fill="white" style="margin-left:5px;"><path d="M8 5v14l11-7z"/></svg></div></div><div id="vid-error" style="display:none; position:absolute; inset:0; flex-direction:column; align-items:center; justify-content:center; color:#F87171; background:rgba(0,0,0,0.8); text-align:center;"><div style="font-size:24px; margin-bottom:10px;">⚠️</div><div style="font-weight:bold; font-size:13px;">Video not found</div><div style="font-size:11px; font-family:monospace; margin-top:5px; opacity:0.8;">VIDEOGUIDA.mp4</div></div></div></div><div style="padding-top:15px; border-top:1px solid var(--border); font-size:11px; color:var(--text-muted); text-align:center; line-height:1.4;"><strong>Disclaimer:</strong> This website is an assistive tool. Always check and refer to official Advantech sources.</div>`;
    doc.body.appendChild(guideDiv);
    const hubDiv=ce('div'); hubDiv.id='support-hub'; hubDiv.style.cssText=modalStyle;
    hubDiv.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;"><h3 style="margin:0;font-size:20px;">Support Hub</h3><span onclick="toggleHelp()" style="cursor:pointer;font-size:28px;line-height:1;">&times;</span></div><div class="help-cards-container"><div class="help-card" onclick="openSupportWindow(null)"><div class="help-icon">✉️</div><div class="help-content"><div class="help-title">${t('Contact')}</div><div class="help-desc">Request support.</div></div></div><div class="help-card" onclick="openBugWindow()"><div class="help-icon">🐞</div><div class="help-content"><div class="help-title">${t('Report')}</div><div class="help-desc">Websites errors/bugs.</div></div></div></div>`;
    doc.body.appendChild(hubDiv);
}

// Inject Support Modal
function injectSupportModal(){
    const existing=gebi('support-overlay'); if(existing) existing.remove();
    const div=ce('div'); div.id='support-overlay'; div.style.display='none';
    div.innerHTML=`<div class="support-card-container"><div class="support-header"><span>${t('Support').toUpperCase()} REQUEST</span><span class="close-support" onclick="closeSupportWindow()">&times;</span></div><div class="support-body"><div class="form-group"><label>Selected Product <span style="color:#ef4444">*</span></label><div class="custom-ac-wrapper"><input type="text" id="supp-pn" placeholder="Search product..." autocomplete="off" oninput="handleAcSearch(this)" onblur="setTimeout(()=>closeAc(),200)" style="font-weight:bold;color:var(--primary);"><div id="ac-results" class="custom-ac-box"></div></div></div><div class="form-row"><div class="form-group half"><label>Channel Partner <span style="color:#ef4444">*</span></label><input type="text" id="supp-cp" placeholder="Partner Name"></div><div class="form-group half"><label>End Customer <span style="color:#ef4444">*</span></label><input type="text" id="supp-customer" placeholder="End Client"></div></div><div class="form-row"><div class="form-group half"><label>PCS/EUR<span style="color:#ef4444">*</span></label><input type="text" id="supp-qty" placeholder="Qty/Value"></div><div class="form-group half"><label>Competitor <span style="color:#ef4444">*</span></label><input type="text" id="supp-competitor" placeholder="Competitor Name"></div></div><div class="form-group"><label>Comment</label><textarea id="supp-comment" rows="3" placeholder="Describe the issue..."></textarea></div><div class="form-group attach-group"><label>Attachment</label><p style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:2px;">* Attach picture in email.</p></div><div class="support-disclaimer"><p>Information sent to <b>PSM</b>.</p></div><button class="btn-send-support" onclick="handleSupportSubmit()">SEND REQUEST</button></div></div>`;
    doc.body.appendChild(div);
}

// Inject Bug Report Modal
function injectBugModal(){
    const existing=gebi('bug-overlay'); if(existing) existing.remove();
    const div=ce('div'); div.id='bug-overlay'; div.style.display='none';
    div.innerHTML=`<div class="support-card-container"><div class="support-header" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><span>${t('Report').toUpperCase()}</span><span class="close-support" onclick="closeBugWindow()">&times;</span></div><div class="support-body" style="padding:15px 25px;"><div class="bug-accordions"><details><summary>1. Cannot find a Product?</summary><p>Try reducing keywords or clearing active filters.</p></details><details><summary>2. Data discrepancy?</summary><p>Try refreshing the page (CTRL+F5) to sync the latest catalog.</p></details><details><summary>3. Preview Image missing?</summary><p>Some products may not have an image available.</p></details><details><summary>4. Interface issue?</summary><p>Please reload the Website.</p></details></div><hr style="border:0;border-top:1px solid var(--border);margin:15px 0;"><div style="font-size:12px;font-weight:800;color:var(--text-muted);margin-bottom:10px;">REPORT IT:</div><div class="form-group"><label>Category</label><select id="bug-cat" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:10px;color:var(--text-main);width:100%;cursor:pointer;"><option value="Bug">Software Bug</option><option value="Data">Incorrect Data</option><option value="Feature">Feature Request</option><option value="Other">Other</option></select></div><div class="form-group"><label>Description</label><textarea id="bug-desc" rows="3" placeholder="Describe..."></textarea></div><button class="btn-send-support" style="background:#F59E0B;" onclick="handleBugSubmit()">REPORT ISSUE</button></div></div>`;
    doc.body.appendChild(div);
}

// Inject Login CSS
function injectHyperLoginStyles(){
    const style=ce('style');
    style.innerHTML=`body.login-mode .search-wrapper,body.login-mode #controls{display:none!important}body.login-mode header{opacity:0!important;pointer-events:none!important}#hyper-gate-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at center,rgba(15,23,42,0.95),rgba(2,6,23,0.99));backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;opacity:0;animation:hyperFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards;transition:background 0.5s ease}html[data-theme="light"] #hyper-gate-overlay{background:radial-gradient(circle at center,#F8FAFC,#E2E8F0)!important}html[data-theme="light"] .hyper-text{color:#475569!important}html[data-theme="light"] .hyper-subtitle{color:#64748B!important}html[data-theme="light"] .login-icon-btn{color:#475569;border-color:#CBD5E1;background:rgba(255,255,255,0.5)}html[data-theme="light"] .login-icon-btn:hover{background:#fff;color:#0070E0}.hyper-card{background:transparent;border:none;box-shadow:none;padding:40px;width:400px;max-width:90%;text-align:center;position:relative;overflow:visible;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:translateY(20px);animation:hyperSlideUp 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) forwards;max-height:90vh;overflow-y:auto}.hyper-logo{font-size:42px;font-weight:900;background:linear-gradient(135deg,#38BDF8,#0070E0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;letter-spacing:-1px}.hyper-subtitle{color:#94A3B8;font-size:14px;font-weight:600;margin-bottom:35px;letter-spacing:2px;text-transform:uppercase}.hyper-text{color:#CBD5E1;font-size:15px;line-height:1.6;margin-bottom:25px}.btn-hyper-main{background:#0070E0;color:white;border:none;width:100%;padding:16px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s ease;box-shadow:0 4px 20px rgba(0,112,224,0.3);display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;position:relative;overflow:hidden;margin:0 auto}.btn-hyper-main:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,112,224,0.5);background:#0060c0}.btn-hyper-verify{background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);margin-top:15px}.btn-hyper-verify:hover{background:rgba(255,255,255,0.2)}.btn-hyper-verify.disabled{opacity:0.5;cursor:not-allowed}html[data-theme="light"] .btn-hyper-verify{background:rgba(0,0,0,0.05);color:#334155;border-color:rgba(0,0,0,0.1)}html[data-theme="light"] .btn-hyper-verify:hover{background:rgba(0,0,0,0.1)}.btn-skip-login{background:transparent;border:none;color:#64748B;margin-top:15px;cursor:pointer;font-size:13px;text-decoration:underline;transition:color 0.2s}.btn-skip-login:hover{color:#94A3B8}.hyper-loader{width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:hyperSpin 0.8s linear infinite;display:none}.login-header-left{position:absolute;top:30px;left:40px;z-index:100000}.login-header-right{position:absolute;top:30px;right:40px;z-index:100000;display:flex;gap:15px;align-items:center}.login-logo-img{height:40px;width:auto;transition:opacity 0.2s}.login-logo-img:hover{opacity:0.8}.login-icon-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94A3B8;width:40px;height:40px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.2s ease;backdrop-filter:blur(5px);outline:none}.login-icon-btn:hover{background:rgba(255,255,255,0.15);color:white;transform:translateY(-2px);box-shadow:0 4px 15px rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.3)}#help-banner{z-index:100002!important}@keyframes hyperFadeIn{to{opacity:1}}@keyframes hyperSlideUp{to{transform:translateY(0)}}@keyframes hyperSpin{to{transform:rotate(360deg)}}.step-container{transition:all 0.4s ease;width:100%;display:flex;flex-direction:column;align-items:center}.hidden-step{display:none;opacity:0;transform:translateY(10px)}.visible-step{display:flex;animation:hyperFadeIn 0.4s forwards}`;
    doc.head.appendChild(style);
}

// Check session
function checkSession(){return sessionStorage.getItem(SESSION_KEY)==='true';}

// Create Hyper Login Gate
function createHyperLoginGate(){
    doc.body.classList.add('login-mode');
    const landing=gebi('landing-page'); if(landing) landing.style.display='none';
    const savedTheme=localStorage.getItem('theme')||'dark', themeIcon=savedTheme==='dark'?'🌙':'☀', div=ce('div'); div.id='hyper-gate-overlay';
    div.innerHTML=`<a href="https://www.advantech.eu" target="_blank" class="login-header-left"><img src="logo.png" class="login-logo-img" alt="Advantech Europe"></a><div class="login-header-right"><button class="login-icon-btn theme-toggle-login" onclick="toggleThemeLogin(this)" title="Toggle Theme">${themeIcon}</button><button class="login-icon-btn" onclick="toggleHelp()" title="Support Hub">?</button><button class="login-icon-btn" onclick="toggleGuide()" title="Quick Guide">📖</button></div><div class="hyper-card"><div class="hyper-logo">ADVANTECH</div><div class="hyper-subtitle">${t('LoginTitle')}</div><div id="hyper-step-1" class="step-container"><p class="hyper-text">We recommend logging in via MyAdvantech to view real-time pricing and availability.</p><a href="https://mya.advantech.com/" target="_blank" class="btn-hyper-main" onclick="onMyaLinkClick()"><span>${t('LoginBtn')}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a><button class="btn-skip-login" onclick="skipLoginProcess()">${t('Skip')}</button><div style="font-size:10px; color:#64748b; margin-top:25px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; line-height:1.3;"><strong>Security Note:</strong> This tool provides helpful links. It does not store personal information or browsing history. When necessary, you will be directed to the official website to sign in or complete actions.</div></div><div id="hyper-step-2" class="step-container hidden-step"><div style="margin-bottom:20px;"><div style="background:rgba(16,185,129,0.2);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px auto;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div><p class="hyper-text" style="margin-bottom:5px;font-weight:700;color:white;font-size:18px;">Authentication Window Active</p><p class="hyper-text" style="font-size:13px;color:#94A3B8;">Once logged in, click below to access.</p></div><button id="btn-verify" class="btn-hyper-main btn-hyper-verify" onclick="verifyLoginProcess()"><span id="verify-text">${t('Verify')}</span><div id="verify-loader" class="hyper-loader"></div></button><button onclick="resetHyperGate()" style="background:none;border:none;color:#64748B;font-size:12px;margin-top:20px;cursor:pointer;text-decoration:underline;">Re-open Login</button></div></div>`;
    doc.body.appendChild(div);
}

// Login Helper Functions
function toggleThemeLogin(btn){ toggleTheme(); btn.innerHTML = localStorage.getItem('theme')==='dark'?'🌙':'☀'; }
function onMyaLinkClick(){ gebi('hyper-step-1').style.display='none'; const s2=gebi('hyper-step-2'); s2.classList.remove('hidden-step'); s2.classList.add('visible-step'); }
function resetHyperGate(){ gebi('hyper-step-2').classList.add('hidden-step'); gebi('hyper-step-2').classList.remove('visible-step'); setTimeout(()=>{ gebi('hyper-step-2').style.display='none'; const s1=gebi('hyper-step-1'); s1.style.display='flex'; s1.style.animation='hyperFadeIn 0.4s forwards'; },100); }
function skipLoginProcess(){ sessionStorage.setItem(SESSION_KEY,'true'); const o=gebi('hyper-gate-overlay'); o.style.transition='opacity 0.4s ease'; o.style.opacity='0'; setTimeout(()=>{ o.remove(); doc.body.classList.remove('login-mode'); startMainAppLogic(); },400); }
function verifyLoginProcess(){ const btn=gebi('btn-verify'), txt=gebi('verify-text'), l=gebi('verify-loader'); btn.classList.add('disabled'); btn.onclick=null; txt.innerText="Loading...."; l.style.display='block'; setTimeout(()=>{ txt.innerText="Access"; l.style.display='none'; btn.style.background='#10B981'; btn.style.borderColor='#10B981'; sessionStorage.setItem(SESSION_KEY,'true'); setTimeout(()=>{ const o=gebi('hyper-gate-overlay'); o.style.opacity='0'; o.style.transform='scale(1.1)'; setTimeout(()=>{ o.remove(); doc.body.classList.remove('login-mode'); startMainAppLogic(); },500); },800); },2000); }

// Return to Home view
function returnToHome(push=true){
    if(push) history.pushState({view:'home'},'','#home');
    gebi('main-app-container').style.display='none'; gebi('landing-page').style.display='flex';
    const n=doc.querySelector('.smart-nav-floater'); if(n) n.classList.remove('nav-visible');
    gebi('pn-search').value = ''; 
}

// Select Product Category
function selectCategory(mode, push=true, keepInput=false){
    ACTIVE_FILTERS={}; OPTIONAL_FILTERS_STATE={}; 
    if(!keepInput) gebi('pn-search').value=''; 
    CURRENT_CATEGORY=mode;
    INDISPENSABLE_FILTERS = (mode==='monitor') ? ['size','Type','Mounting'] : ['size','Type','Mounting','CPU'];
    updateTableHeaders();
    if(push) history.pushState({view:'list',category:mode},'','#list');
    gebi('landing-page').style.display='none'; gebi('main-app-container').style.display='block'; gebi('controls').style.display='block';
    const n=doc.querySelector('.smart-nav-floater'); if(n) n.classList.add('nav-visible');
    buildFilters(); applyFilters();
}

// Inject Main CSS
function injectStyles(){
    const style=ce('style');
    style.innerHTML=`
    @keyframes bounceIcon{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
    .btn-impact{background:linear-gradient(135deg,var(--primary) 0%,var(--accent) 100%);color:white;border:none;padding:10px 24px;border-radius:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-decoration:none;display:inline-flex;align-items:center;gap:10px;font-size:13px;transition:all 0.2s ease;box-shadow:0 4px 15px rgba(0,112,224,0.25)}.btn-impact:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,112,224,0.4)}.btn-impact svg{width:18px;height:18px;transition:transform 0.3s}.btn-impact:hover svg{animation:bounceIcon 0.8s infinite}
    .btn-filter-manage{display:flex;align-items:center;gap:10px;background:var(--bg-card);color:var(--text-muted);border:2px solid var(--border);padding:10px 24px;border-radius:28px;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s ease;box-shadow:0 4px 12px rgba(0,0,0,0.08);white-space:nowrap;height:44px}.btn-filter-manage:hover{border-color:var(--primary);color:var(--primary);background:var(--hover-row);transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,0.15)}
    .filter-dropdown-menu{display:none;position:absolute;top:120%;right:0;width:300px;background:var(--bg-card);border:2px solid var(--border);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,0.3);z-index:1200;padding:14px;animation:fadeIn 0.2s ease}.filter-dropdown-menu.show{display:block}.filter-dropdown-header{padding:12px 16px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);font-weight:800;border-bottom:2px solid var(--border);margin-bottom:10px}.filter-dropdown-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:8px;cursor:pointer;transition:background 0.2s;color:var(--text-main);font-size:14px;font-weight:500}.filter-dropdown-item:hover{background:var(--hover-row)}.filter-dropdown-item input{accent-color:var(--primary);width:18px;height:18px;cursor:pointer}
    .modal-preview-card{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;height:auto;min-height:300px;position:relative;cursor:zoom-in;transition:transform 0.4s cubic-bezier(0.25,0.8,0.25,1)}.modal-preview-card:hover{transform:translateY(-5px)}.modal-product-img{max-width:100%;max-height:350px;object-fit:contain;filter:none!important;mix-blend-mode:multiply;transition:transform 0.4s ease}.modal-preview-card:hover .modal-product-img{transform:scale(1.1)}.zoom-hint{position:absolute;bottom:0;background:rgba(0,112,224,0.9);color:white;padding:6px 16px;border-radius:18px;font-size:12px;font-weight:700;text-transform:uppercase;opacity:0;transform:translateY(10px);transition:all 0.3s ease;box-shadow:0 4px 10px rgba(0,0,0,0.2)}.modal-preview-card:hover .zoom-hint{opacity:1;transform:translateY(-20px)}
    #lightbox-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(5px);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:fadeInLightbox 0.3s ease-out}.lightbox-content img{max-width:90vw;max-height:90vh;filter:drop-shadow(0 0 80px rgba(0,0,0,0.5));animation:scaleInLightbox 0.4s cubic-bezier(0.175,0.885,0.32,1.275)}@keyframes fadeInLightbox{from{opacity:0}to{opacity:1}}@keyframes scaleInLightbox{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
    .suggestion-card{margin-top:30px;border:1px solid #E2E8F0;border-top:4px solid var(--primary);border-radius:12px;overflow:hidden;background:#FFFFFF!important;display:flex;flex-direction:column;box-shadow:0 10px 30px -5px rgba(0,0,0,0.1);transition:all 0.3s ease}.suggestion-card:hover{transform:translateY(-4px);box-shadow:0 20px 40px -5px rgba(0,0,0,0.15)}.suggestion-badge{background:linear-gradient(135deg,var(--primary),#3b82f6);color:white;padding:8px 16px;font-weight:800;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-align:center}.suggestion-flex{display:flex;gap:20px;padding:20px;align-items:center}.suggestion-img-wrapper{flex:0 0 120px;display:flex;align-items:center;justify-content:center;background:white;border-radius:8px;padding:10px;height:120px}.suggestion-img{max-width:100%;max-height:100%;object-fit:contain}.suggestion-info{flex:1;display:flex;flex-direction:column;gap:10px}.suggestion-title{font-size:18px;font-weight:900;color:#0F172A!important;cursor:pointer;text-decoration:underline;text-decoration-style:solid;text-decoration-color:var(--primary)}.suggestion-title:hover{color:var(--primary)!important}
    .specs-diff-grid{display:grid;grid-template-columns:1fr;gap:6px;background:#F8FAFC!important;padding:10px;border-radius:8px;border:1px solid #E2E8F0}.spec-row{display:grid;grid-template-columns:60px 1fr 10px 1fr;align-items:center;font-size:12px;gap:5px}.spec-label{font-weight:700;color:#64748B!important;text-transform:uppercase;font-size:10px}.spec-val{color:#334155!important;font-weight:600;white-space:normal}.spec-arrow{color:#94A3B8;font-size:14px;text-align:center}.spec-val.upgrade{color:#10B981!important;font-weight:800}.spec-val.neutral{color:#64748B!important;opacity:0.8}.btn-view-new{margin-top:5px;background:var(--primary);color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;text-transform:uppercase;align-self:start;transition:all 0.2s;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.btn-view-new:hover{background:var(--accent);transform:translateY(-2px);box-shadow:0 8px 12px rgba(0,0,0,0.15)}
    .sticky-col{position:sticky;right:0;z-index:50;background:var(--bg-card);border-left:1px solid var(--border);padding:8px!important}.action-group{display:flex;gap:8px;align-items:center;justify-content:center;width:100%}.btn-stock-outline,.action-btn{flex:1;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 10px;font-size:11px;box-sizing:border-box;white-space:nowrap;min-width:80px;border-radius:6px;transition:all 0.2s}.btn-stock-outline{font-weight:800;color:#38BDF8;background:transparent;border:2px solid #38BDF8;text-decoration:none}.btn-stock-outline:hover{background:rgba(56,189,248,0.15);transform:translateY(-1px);box-shadow:0 4px 12px rgba(56,189,248,0.2)}.action-btn{background:#0070E0;color:white;border:none;font-weight:800;text-transform:uppercase;cursor:pointer}.action-btn:hover{background:#0060c0;transform:translateY(-2px)}
    table{width:100%;border-collapse:separate;border-spacing:0;table-layout:auto}td,th{min-width:90px;text-align:center;vertical-align:middle;padding:12px 8px;box-sizing:border-box}.status-tag{white-space:nowrap;display:inline-block}.semantic-tag{white-space:normal;display:inline-block;line-height:1.2;max-width:140px;text-align:center;margin:0 auto;}.detail-simple-tag{display:inline-block;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;margin:2px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)}.pn-cell div{justify-content:center!important;width:100%}
    #support-overlay,#bug-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:100003;display:flex;align-items:center;justify-content:center}.support-card-container{width:600px;max-width:90vw;max-height:85vh;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,0.5);overflow-x:hidden;animation:hyperSlideUp 0.3s ease-out;position:relative;margin:auto}.support-header{background:linear-gradient(135deg,var(--primary),var(--accent));padding:15px 20px;color:white;display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:1px}.close-support{font-size:24px;cursor:pointer;transition:transform 0.2s}.close-support:hover{transform:scale(1.1)}.support-body{padding:25px;display:flex;flex-direction:column;gap:15px}.form-group{display:flex;flex-direction:column;gap:6px}.form-row{display:flex;gap:15px;flex-wrap:wrap}.half{flex:1;min-width:200px}.support-body input,.support-body textarea,.support-body select{background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;padding:10px;color:var(--text-main);font-family:inherit;font-size:14px;width:100%;box-sizing:border-box}.support-body textarea{resize:vertical;max-height:200px;min-height:60px}.support-body input:focus,.support-body textarea:focus{outline:none;border-color:var(--primary);background:rgba(0,112,224,0.05)}.support-disclaimer{font-size:12px;color:#000000;background:#ffffff;border:1px solid #e2e8f0;padding:10px;border-radius:4px;line-height:1.4}.btn-send-support{background:#10B981;color:white;border:none;padding:14px;border-radius:8px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:all 0.2s;margin-top:5px}.help-cards-container{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:10px}.help-card{background:var(--hover-row);border:1px solid var(--border);border-radius:12px;padding:15px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:15px}.help-card:hover{border-color:var(--primary);transform:translateY(-3px);box-shadow:0 5px 15px rgba(0,0,0,0.1)}.help-icon{font-size:24px;background:rgba(255,255,255,0.05);padding:10px;border-radius:50%}.help-title{font-weight:800;font-size:14px;color:var(--primary);margin-bottom:4px}.help-desc{font-size:11px;color:var(--text-muted);line-height:1.3}.bug-accordions details{background:rgba(255,255,255,0.03);border:1px solid var(--border);margin-bottom:5px;border-radius:6px}.bug-accordions summary{padding:10px 15px;cursor:pointer;font-weight:600;font-size:13px;list-style:none;outline:none;position:relative}.bug-accordions summary::-webkit-details-marker{display:none}.bug-accordions summary:after{content:"+";position:absolute;right:15px;font-weight:bold}.bug-accordions details[open] summary:after{content:"-"}.bug-accordions p{padding:10px 15px;margin:0;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);background:rgba(0,0,0,0.1)}.btn-fake-attach{background:transparent;border:1px dashed var(--border);color:var(--text-muted);padding:8px;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-size:12px}.btn-fake-attach:hover{border-color:var(--primary);color:var(--primary)}.smart-nav-floater{position:fixed;bottom:20px;left:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:30px;display:none;align-items:center;padding:5px 10px;gap:5px;z-index:100001;transition:transform 0.2s ease;box-shadow:0 5px 20px rgba(0,0,0,0.3)}.smart-nav-floater.nav-visible{display:flex;animation:hyperFadeIn 0.3s ease}.smart-nav-floater:hover{transform:translateY(-2px)}.smart-nav-floater button{background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s}.smart-nav-floater button:hover{background:rgba(255,255,255,0.1);color:var(--primary)}.nav-divider{width:1px;height:16px;background:var(--border)}.lang-wrapper{position:relative;display:inline-block;margin:0 5px;list-style:none!important;text-decoration:none!important;}.lang-btn{background:transparent;border:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:5px;padding:8px;border-radius:8px;transition:all 0.2s;list-style:none!important;text-decoration:none!important;}.lang-btn:hover{background:rgba(255,255,255,0.1);color:var(--text-main)}.lang-btn svg{width:20px;height:20px}.lang-code{font-weight:700;font-size:12px;text-transform:uppercase;list-style:none!important;}.lang-code::before,.lang-code::after{content:none!important;display:none!important;}.lang-menu{position:absolute;top:110%;right:0;width:160px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:10000;padding:5px;display:none;flex-direction:column;animation:hyperFadeIn 0.2s ease}.lang-menu.show{display:flex}.lang-header{padding:8px 12px;font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);margin-bottom:5px}.lang-opt{padding:8px 12px;border-radius:6px;font-size:13px;color:var(--text-main);cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-weight:500;transition:background 0.2s;list-style:none!important;}.lang-opt:hover{background:var(--hover-row);color:var(--primary)}.lang-opt.active{color:var(--primary);font-weight:700;background:rgba(0,112,224,0.05)}.modal-container-grid{display:grid;grid-template-columns:350px 1fr;gap:25px;align-items:start;}@media(max-width:900px){.modal-container-grid{grid-template-columns:1fr;}}
    .pagination-container{display:flex;justify-content:center;gap:5px;padding:15px;align-items:center;background:var(--bg-card);}.page-btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-main);padding:8px 12px;border-radius:4px;cursor:pointer;font-weight:600;min-width:32px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}.page-btn:hover:not(:disabled){background:var(--hover-row);color:var(--primary);border-color:var(--primary);}.page-btn.active{background:var(--primary);color:white;border-color:var(--primary);}.page-btn:disabled{opacity:0.5;cursor:not-allowed;}.page-dots{color:var(--text-muted);padding:0 5px;}
    .std-header-btn { background: transparent; border: 1px solid var(--border); color: var(--text-muted); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s ease; backdrop-filter: blur(5px); } .std-header-btn:hover { background: var(--hover-row); color: var(--text-main); border-color: var(--text-muted); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    #maint-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at center,#1e293b 0%,#0f172a 50%,#020617 100%);z-index:200000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Inter',sans-serif;color:white;opacity:0;animation:fadeIn 0.5s ease-out forwards}
    .maint-icon{font-size:80px;margin-bottom:25px;animation:floatIcon 3s ease-in-out infinite;filter:drop-shadow(0 0 30px rgba(56,189,248,0.4))}
    .maint-title{font-size:36px;font-weight:900;letter-spacing:-1px;margin-bottom:15px;background:linear-gradient(to right,#38BDF8,#818CF8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-transform:uppercase}
    .maint-desc{color:#94A3B8;font-size:16px;max-width:450px;text-align:center;line-height:1.6;margin-bottom:40px}
    .maint-btn-row{display:flex;gap:15px;align-items:center;}
    .btn-retry{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#38BDF8;padding:14px 40px;border-radius:50px;cursor:pointer;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);backdrop-filter:blur(10px);box-shadow:0 4px 15px rgba(0,0,0,0.2)} .btn-retry:hover{background:rgba(56,189,248,0.1);border-color:#38BDF8;color:white;transform:translateY(-2px);box-shadow:0 0 30px rgba(56,189,248,0.4)}
    .btn-report-fail{background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);color:#F87171;padding:14px 40px;border-radius:50px;cursor:pointer;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;transition:all 0.3s;backdrop-filter:blur(10px)} .btn-report-fail:hover{background:rgba(220,38,38,0.2);border-color:#EF4444;color:white;transform:translateY(-2px);box-shadow:0 0 30px rgba(220,38,38,0.4)}
    #maint-report-area{margin-top:20px;width:100%;max-width:400px;display:none;flex-direction:column;gap:10px;animation:fadeIn 0.3s ease;}
    .maint-textarea{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;color:#fff;font-family:inherit;width:100%;resize:vertical;min-height:80px;box-sizing:border-box;} .maint-textarea:focus{outline:none;border-color:#F87171;box-shadow:0 0 10px rgba(248,113,113,0.2);}
    .btn-send-report{background:#EF4444;color:white;border:none;padding:10px;border-radius:6px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;} .btn-send-report:hover{background:#DC2626;}
    @keyframes floatIcon{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}@keyframes fadeIn{to{opacity:1}}
    video::-webkit-media-controls-loading-panel { display: none !important; opacity: 0 !important; }
    select option { background-color: #1e293b; color: #ffffff; }
    html[data-theme="light"] select option { background-color: #ffffff; color: #000000; }
    `;
    doc.head.appendChild(style);
}
function injectAutocompleteStyles(){
    const style=ce('style');
    style.innerHTML=`
    .custom-ac-wrapper { position: relative; width: 100%; }
    .custom-ac-box { position: absolute; top: 100%; left: 0; right: 0; background: #1e293b; border: 1px solid #334155; border-radius: 0 0 8px 8px; max-height: 250px; overflow-y: auto; z-index: 10005; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: none; margin-top: 2px; }
    .custom-ac-item { padding: 12px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 3px; transition: background 0.15s; }
    .custom-ac-item:last-child { border-bottom: none; }
    .custom-ac-item:hover { background: #334155; }
    .ac-main { color: #38BDF8; font-weight: 700; font-size: 13px; font-family: monospace; letter-spacing: 0.5px; }
    .ac-sub { color: #94A3B8; font-size: 11px; font-style: italic; }
    /* Scrollbar Styling */
    .custom-ac-box::-webkit-scrollbar { width: 6px; }
    .custom-ac-box::-webkit-scrollbar-track { background: #0f172a; }
    .custom-ac-box::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .custom-ac-box::-webkit-scrollbar-thumb:hover { background: #64748b; }
    `;
    doc.head.appendChild(style);
}
// Maintenance report helpers
function toggleMaintReport(){ const a=gebi('maint-report-area'); a.style.display = a.style.display==='flex'?'none':'flex'; }
function sendMaintReport(err){ const c=gebi('maint-comment').value; window.location.href=`mailto:Osama.GadAlla@advantech.it?subject=SYSTEM ALERT: Catalog Connection Failure&body=ERROR DETAILS: ${err}%0D%0A%0D%0AUSER COMMENT(IF NEEDED ATTACH SCREENSHOT):%0D%0A${c}`; }

// Lightbox
function openLightbox(url){if(!url)return;gebi('lightbox-img').src=url;gebi('lightbox-overlay').style.display='flex';}
function closeLightbox(){gebi('lightbox-overlay').style.display='none';gebi('lightbox-img').src='';}

// Date helpers
function parseDate(val){
    if(!val)return null; if(val instanceof Date)return val;
    if(typeof val==='string'&&val.includes('/')){const p=val.split('/');if(p.length===3)return new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));}
    return new Date(val);
}
function formatDate(val){
    if(!val||val==='-')return "-"; let d=parseDate(val);
    if(d&&!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    return val;
}

// Value simplifiers
function simplifyValue(val,key){
    if(!val)return ""; const s=String(val).trim(), low=s.toLowerCase();
    if(key==='size')return s.replace(/["']/g,'').trim();
    if(key==='Type'){if(low.includes('combo')||low.includes('pcap')||low.includes('projected'))return 'Pcap';if(low.includes('res')||low.includes('5-wire')||low.includes('analog'))return 'Resistive';return s;}
    if(key==='APPLICATION'){
        if(low.includes('class 1')||low.includes('c1d2'))return 'Explosion / Oil & Gas';
        if(low.includes('outdoor')||low.includes('sunlight'))return 'Outdoor / Harsher';
        if(low.includes('general')||low.includes('basic'))return 'General Automation';
        if(low.includes('embedded'))return 'Embedded'; return s;
    }
    return s;
}

function simplifyForFilter(val,key){
    let s=simplifyValue(val,key), low=s.toLowerCase();
    if(key.match(/os|operating|platform|support/i)){
        if(low.includes('android')) return 'Android'; if(low.includes('linux')) return 'Linux';
        if(low.includes('win') && low.includes('8')) return 'Win 8'; if(low.includes('win') && low.includes('11')) return 'Win 11'; if(low.includes('win') && low.includes('10')) return 'Win 10';
    }
    if(key==='CPU'){
        if(low.includes('i7'))return 'Core i7'; if(low.includes('i5'))return 'Core i5'; if(low.includes('i3')||low==='core i')return 'Core i3';
        if(low.includes('xeon'))return 'Xeon Server';
        if(low.includes('atom')||low.includes('celeron')||low.includes('pentium')||low.includes('intel 97')||low.includes('n97')) return 'Atom';
        return 'ARM-RISC';
    }
    if(key==='Memory'){ let m=s.match(/(\d+)/); if(m)return m[1]+" GB"; return s; }
    if(key==='Resolution'){
        if(low.includes('1920')&&low.includes('1080'))return 'FHD (1920x1080)'; if(low.includes('1024')&&low.includes('768'))return 'XGA (1024x768)';
        if(low.includes('1280')&&low.includes('800'))return 'WXGA (1280x800)'; if(low.includes('1366'))return 'HD (1366x768)';
        if(low.includes('800')&&low.includes('600'))return 'SVGA (800x600)';
    }
    return s;
}

// Semantic styling for tags
function getSemanticStyle(val,type){
    if(!val||val==='-'||val==='0')return 'color:var(--text-muted);opacity:0.7;font-style:italic;';
    const v=String(val).toLowerCase(), appStyle="font-weight:bold;font-size:11px;";
    const tagStyle = (c, b, ex='') => `color:${c};background:rgba(${b},0.1);padding:4px 8px;border-radius:6px;${ex}`;
    
    if(type==='APPLICATION'){
        if(v.includes('explosion')||v.includes('oil')||v.includes('class 1')) return tagStyle('#DC2626','220,38,38',appStyle);
        if(v.includes('outdoor')||v.includes('sunlight')||v.includes('harsher')) return tagStyle('#EA580C','234,88,12',appStyle);
        if(v.includes('embedded')||v.includes('open frame')) return tagStyle('#16A34A','22,163,74',appStyle);
        if(v.includes('bench')||v.includes('desktop')) return tagStyle('#7C3AED','124,58,237',appStyle);
        if(v.includes('arm')||v.includes('mount')) return tagStyle('#DB2777','219,39,119',appStyle);
        if(v.includes('cabinet')||v.includes('rack')) return tagStyle('#D97706','217,119,6',appStyle);
        if(v.includes('wall')) return tagStyle('#0891B2','8,145,178',appStyle);
        if(v.includes('control')||v.includes('desk')) return tagStyle('#3B82F6','79,70,229',appStyle);
        return tagStyle('#3B82F6','59,130,246',appStyle);
    }
    if(type==='MARKET'){
        if(v.includes('rail')||v.includes('transport')) return tagStyle('#B45309','180,83,9');
        if(v.includes('medic')||v.includes('health')) return tagStyle('#BE185D','190,24,93');
        if(v.includes('food')||v.includes('beverage')) return tagStyle('#047857','4,120,87');
        if(v.includes('automat')||v.includes('factory')) return tagStyle('#0284C7','2,132,199');
        if(v.includes('iot')) return tagStyle('#8B5CF6','139,92,246');
        if(v.includes('marine')) return tagStyle('#1E3A8A','30,58,138');
        if(v.includes('energy')||v.includes('power')) return tagStyle('#F59E0B','245,158,11');
        if(v.includes('retail')||v.includes('kiosk')) return tagStyle('#EC4899','236,72,153');
        return tagStyle('#475569','71,85,105');
    }
    if(type==='Series'){
        const bStyle = (c) => `color:${c};border:1px solid ${c};padding:2px 6px;border-radius:4px;`;
        if(v.startsWith('ppc')) return bStyle('#4338CA'); if(v.startsWith('fpm')) return bStyle('#0F766E');
        if(v.startsWith('tpc')) return bStyle('#C2410C'); if(v.startsWith('uno')) return bStyle('#4B5563');
        if(v.startsWith('utc')) return bStyle('#BE123C'); if(v.startsWith('aim')) return bStyle('#701A75');
        if(v.startsWith('hit')) return bStyle('#059669'); return bStyle('var(--primary)');
    }
    return '';
}

// URL Cleaner
function cleanExtractedUrl(url){
    if(!url||typeof url!=='string'||url.length<3)return "";
    let clean=url.trim(), bad=['n/a','-','0','undefined'];
    if(bad.includes(clean.toLowerCase()))return "";
    if(clean.toLowerCase()==='datasheet'||clean.toLowerCase()==='a')return "";
    clean=clean.replace(/^HTTPS\/\//i,"https://").replace(/^HTTP\/\//i,"http://");
    if(clean.startsWith('/'))return "https://www.advantech.com"+clean;
    if(!clean.match(/^https?:\/\//i)){if(clean.includes('advantech.com')||clean.includes('www.')||clean.includes('.pdf')||clean.includes('.jpg')||clean.includes('.png'))return "https://"+clean;}
    return clean;
}

async function loadDatabase(){
    try{
        if(window.location.protocol==='file:') throw new Error("CORS ERROR: Use Local Server.");
        if(typeof XLSX==='undefined') throw new Error("Library Error: xlsx.bundle.js missing.");
        
        const r=await fetch(EXCEL_FILE); if(!r.ok)throw new Error("Network error.");
        const wb=XLSX.read(await r.arrayBuffer(),{type:'array',cellDates:true});
        if(!wb.Sheets['DB']||!wb.Sheets['DB2']) throw new Error("Invalid Excel: Sheets missing.");
        
        clearTimeout(loadingTimeout);

        // Parse DB Sheet
        const ws=wb.Sheets['DB'], range=XLSX.utils.decode_range(ws['!ref']);
        let hIdx=0;
        for(let r=range.s.r;r<=Math.min(range.e.r,20);r++){
            for(let c=range.s.c;c<=range.e.c;c++){const cell=ws[XLSX.utils.encode_cell({r:r,c:c})];if(cell&&cell.v&&String(cell.v).toUpperCase().includes('P/N')){hIdx=r;break;}}
            if(hIdx>0)break;
        }
        const rawDB=XLSX.utils.sheet_to_json(ws,{range:hIdx,defval:"",blankrows:true});

        // Parse DB2 Sheet (Details)
        const sheet2=wb.Sheets['DB2'], range2=XLSX.utils.decode_range(sheet2['!ref']), cats=[], attrs=[];
        for(let C=range2.s.c;C<=range2.e.c;C++){
            const cv=sheet2[XLSX.utils.encode_cell({r:0,c:C})], av=sheet2[XLSX.utils.encode_cell({r:1,c:C})];
            cats[C]=cv?cv.v.toString().trim():(C>0?cats[C-1]:null); attrs[C]=av?av.v.toString().trim():null;
            if(cats[C]&&attrs[C]&&!cats[C].startsWith('__')&&!attrs[C].startsWith('__')){
                if(!DB2_STRUCTURE[cats[C]])DB2_STRUCTURE[cats[C]]=[]; DB2_STRUCTURE[cats[C]].push(attrs[C]);
            }
        }
        
        const db2Map={};
        XLSX.utils.sheet_to_json(sheet2,{range:1,defval:""}).forEach(row=>{
            let pnKey=Object.keys(row).find(k=>k.toUpperCase().includes('P/N'));
            if(pnKey&&row[pnKey]){
                let pn=String(row[pnKey]).replace(/\s/g,'').trim(); db2Map[pn]={};
                for(let k in row){
                    let v=String(row[k]).trim(), ck=k.trim(); if(ck.startsWith('__'))continue;
                    if(v&&!EXCLUSIONS.includes(v.toLowerCase())){
                        let found=false;
                        for(let c in DB2_STRUCTURE){
                            if(DB2_STRUCTURE[c].includes(ck)){if(!db2Map[pn][c])db2Map[pn][c]=[]; db2Map[pn][c].push({label:ck,value:v}); found=true;}
                        }
                        if(!found){if(!db2Map[pn][ck])db2Map[pn][ck]=[]; db2Map[pn][ck].push({label:ck,value:v});}
                    } else if(v.toLowerCase()==='a'){
                        for(let c in DB2_STRUCTURE){if(DB2_STRUCTURE[c].includes(ck)){if(!db2Map[pn][c])db2Map[pn][c]=[]; db2Map[pn][c].push({label:ck,value:v});}}
                    }
                }
            }
        });

        const today=new Date().setHours(0,0,0,0);
        
        // Map and Build Search Index
        GLOBAL_DATA=rawDB.map((row,idx)=>{
            let item={_id:idx}, keys=Object.keys(row), pnKey=keys.find(k=>k.toUpperCase().includes('P/N'));
            if(!pnKey||!row[pnKey]||String(row[pnKey]).trim().length===0)return null;
            
            item.PN=String(row[pnKey]).replace(/\s/g,'').trim();
            let imgKey=keys.find(k=>k.trim().toUpperCase()==='PRIMAGE'); item.ImageURL=imgKey?cleanExtractedUrl(String(row[imgKey])):"";
            
            for(let k in COL_MAP_DB){
                if(k==='PN')continue; let exK=COL_MAP_DB[k], fk=keys.find(x=>x.trim().toUpperCase()===exK.trim().toUpperCase());
                if(!fk)fk=keys.find(x=>x.trim().toUpperCase().includes(exK.trim().toUpperCase()));
                item[k]=normalize(row[fk||exK],k)||'-';
            }
            
            item._DIRECT_LINK=(!item.DirectLink||item.DirectLink.length<5)?"":cleanExtractedUrl(item.DirectLink);
            item.ManualLink=item.ManualLink.length>5?cleanExtractedUrl(item.ManualLink):"";
            item.TechLink=item.TechLink.length>5?cleanExtractedUrl(item.TechLink):"";
            item._DETAILS=db2Map[item.PN]||{};
            
            // --- LOGIC FIX: INDEX SIMPLIFIED VALUES ---
            const sApp = simplifyValue(item.APPLICATION, 'APPLICATION');
            const sCpu = simplifyValue(item.CPU, 'CPU');
            const sType = simplifyValue(item.Type, 'Type');
            const sRes = simplifyValue(item.Resolution, 'Resolution');

            // >>> NEW: Extract deep details for Search <<<
            let detailBlob = "";
            if(item._DETAILS) {
                Object.keys(item._DETAILS).forEach(cat => {
                    if(!cat.startsWith('__') && Array.isArray(item._DETAILS[cat])){
                        item._DETAILS[cat].forEach(det => {
                            if(det.value) detailBlob += ` ${det.value}`;
                            if(det.label) detailBlob += ` ${det.label}`; // Indexing label too allows searching for 'HDMI' or 'LAN'
                        });
                    }
                });
            }

            // Combine Raw Data + Simplified Data + Details Blob into search string
            item._SEARCH_STR=[
                item.PN, item.Status, 
                item.CPU, sCpu, 
                item.Memory, 
                item.size, 
                item.Resolution, sRes, 
                item.Type, sType, 
                item.APPLICATION, sApp, 
                item.MARKET, item.Series,
                detailBlob // Added Deep Details to index
            ].join(" || ").toLowerCase();
            // ------------------------------------------

            let ltb=parseDate(item.LTB); if(ltb&&ltb.getTime()<today)item.Status='EOL';
            return item;
        }).filter(i=>i!==null);

        gebi('loading').style.display='none'; gebi('landing-page').style.display='flex';
        const dl=gebi('product-list'); if(dl)dl.innerHTML=GLOBAL_DATA.map(d=>`<option value="${d.PN}">`).join('');
    } catch(e){ clearTimeout(loadingTimeout); console.error(e); showMaintenanceScreen(e.message); }
}
function normalize(val,key){if(val==null)return "";if(key==='LTB')return val;let s=String(val).trim();if(key==='size'){let n=parseFloat(s);if(!isNaN(n)&&!s.includes('"'))return n+'"';}return s;}
function startScrolling(dir){const c=gebi('main-table-container'), s=30; function anim(){if(dir==='left')c.scrollLeft-=s;else c.scrollLeft+=s;scrollAnimationId=requestAnimationFrame(anim);} stopScrolling(); anim();}
function stopScrolling(){if(scrollAnimationId){cancelAnimationFrame(scrollAnimationId);scrollAnimationId=null;}}
function toTitleCase(s){return s?s.replace(/\w\S*/g,t=>t.charAt(0).toUpperCase()+t.substr(1).toLowerCase()):'';}

// Search Suggestions
function showSuggestions(val){
    const box=gebi('search-suggestions-box'); if(!val||val.length<2){box.style.display='none';return;}
    const clean=val.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
    const m=GLOBAL_DATA.filter(i=>i.PN.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().includes(clean)).slice(0,8);
    if(m.length===0){box.style.display='none';return;}
    box.innerHTML=m.map(i=>`<div class="suggestion-item" onclick="selectSuggestion('${i.PN}')"><div><strong>${i.PN}</strong><span style="margin:0 5px;color:var(--border);">-</span><span class="text-metallic-blue" style="text-transform:none;">${i.CPU?toTitleCase(i.CPU):''}</span></div></div>`).join('');
    box.style.display='block';
}

function selectSuggestion(pn){
    gebi('pn-search').value=pn; gebi('search-suggestions-box').style.display='none'; saveToHistory(pn);
    const up=pn.toUpperCase().trim(), isMon=up.startsWith('FPM')||up.startsWith('IDS'), landing=gebi('landing-page');
    if(landing&&landing.style.display!=='none'){ selectCategory(isMon?'monitor':'hmi',true,true); }
    else { if(CURRENT_CATEGORY==='hmi'&&isMon) selectCategory('monitor',false,true); else if(CURRENT_CATEGORY==='monitor'&&!isMon) selectCategory('hmi',false,true); }
    resetFilterValuesOnly(); applyFilters(true);
}

function saveToHistory(term){if(!term||term.length<2)return;let h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');h=h.filter(x=>x.toLowerCase()!==term.toLowerCase());h.unshift(term);if(h.length>3)h=h.slice(0,3);localStorage.setItem(HISTORY_KEY,JSON.stringify(h));}
function showSearchHistory(){
    const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'), box=gebi('search-suggestions-box');
    if(h.length===0){box.style.display='none';return;}
    box.innerHTML=`<div style="padding:12px 16px;font-size:11px;font-weight:800;color:var(--accent);background:rgba(0,0,0,0.2);border-bottom:2px solid var(--border);letter-spacing:0.5px;">RECENT SEARCHES</div>`+h.map(t=>`<div class="suggestion-item" onclick="selectSuggestion('${t.replace(/"/g,'&quot;')}')"><strong>${t}</strong></div>`).join('');
    box.style.display='block';
}

// Filters Construction
// Filters Construction
function buildFilters(){
    const cont=gebi('filters-container'); cont.innerHTML='';
    const validData=GLOBAL_DATA.filter(i=>{
        if(!['MP','ES','NEW'].includes(String(i.Status).trim().toUpperCase()))return false;
        if(CURRENT_CATEGORY==='monitor'&&!i.PN.startsWith('FPM')&&!i.PN.startsWith('IDS'))return false;
        if(CURRENT_CATEGORY==='hmi'&&(i.PN.startsWith('FPM')||i.PN.startsWith('IDS')))return false;
        return true;
    });
    let allF=[];
    
    // Define base keys (removing LTB and APPLICATION if monitor)
    let baseKeys = ['LTB','size','Resolution','Type','CPU','APPLICATION'];
    if(CURRENT_CATEGORY === 'monitor') {
        baseKeys = baseKeys.filter(k => k !== 'LTB' && k !== 'APPLICATION');
    }

    baseKeys.forEach(k=>allF.push({key:k,isDB2:false}));

    let db2k=new Set(); validData.forEach(i=>{if(i._DETAILS)Object.keys(i._DETAILS).forEach(k=>{if(!k.startsWith('__')&&k.toLowerCase()!=='empty')db2k.add(k);});});
    db2k.forEach(k=>{if(k.toLowerCase()!=='p/n')allF.push({key:k,isDB2:true});});

    allF.forEach(f=>{
        if(INDISPENSABLE_FILTERS.some(i=>i.toLowerCase()===f.key.toLowerCase())||OPTIONAL_FILTERS_STATE[f.key]){
            // MODIFICATION START: Filter Certifications for Monitors
            if(f.key.toLowerCase().includes('certific')){ 
                let certsToShow = TARGET_CERTIFICATIONS;
                if(CURRENT_CATEGORY === 'monitor') {
                    // Remove hazardous locations certifications for monitors
                    certsToShow = certsToShow.filter(c => c !== 'C1/D2' && c !== 'IECEx/ATEX Zone 2/22');
                }
                createFilterUI(f.key, certsToShow, cont, f.isDB2); 
            }
            // MODIFICATION END
            else if(f.key.toLowerCase().includes('os')){ createFilterUI(f.key, TARGET_OS, cont, f.isDB2); }
            else { let u=getUniqueValues(validData,f.key,f.isDB2); if(u.length>0) createFilterUI(f.key,u,cont,f.isDB2); }
        }
    });

    const addBtn=ce('div'); addBtn.className='add-filter-container'; addBtn.style.alignSelf="flex-end";
    const avail=allF.filter(f=>{
        if(INDISPENSABLE_FILTERS.some(i=>i.toLowerCase()===f.key.toLowerCase()))return false;
        if(CURRENT_CATEGORY==='monitor') return MONITOR_ALLOWED_OPTIONAL.some(a=>a.toLowerCase()===f.key.toLowerCase());
        return true;
    }).sort((a,b)=>a.key.localeCompare(b.key));
    
    if(avail.length>0){
        const allSel=avail.every(f=>OPTIONAL_FILTERS_STATE[f.key]);
        const menu=avail.map(f=>`<label class="filter-dropdown-item"><input type="checkbox" ${OPTIONAL_FILTERS_STATE[f.key]?'checked':''} data-key="${f.key}" onchange="toggleOptionalFilter('${f.key}')">${t(f.key)}</label>`).join('');
        addBtn.innerHTML=`<button class="btn-filter-manage" onclick="toggleAddMenu()" title="${t('Customize')}"><span>✚</span> ${t('Customize')}</button><div id="add-filter-menu" class="filter-dropdown-menu"><div class="filter-dropdown-header">Manage View</div><label class="filter-dropdown-item select-all-option"><input type="checkbox" ${allSel?'checked':''} onchange="toggleSelectAllOptions(this)"> ${t('SelectAll')}</label>${menu}</div>`;
        cont.appendChild(addBtn);
    }
}

function toggleAddMenu(){const m=gebi('add-filter-menu'); doc.querySelectorAll('.multiselect-content').forEach(e=>e.classList.remove('show')); m.classList.toggle('show');}
doc.addEventListener('click',(e)=>{if(!e.target.closest('.add-filter-container')){const m=gebi('add-filter-menu');if(m)m.classList.remove('show');}});

function toggleOptionalFilter(key){
    OPTIONAL_FILTERS_STATE[key] ? delete OPTIONAL_FILTERS_STATE[key] : OPTIONAL_FILTERS_STATE[key]=true;
    if(!OPTIONAL_FILTERS_STATE[key] && ACTIVE_FILTERS[key]) delete ACTIVE_FILTERS[key];
    buildFilters(); applyFilters(); const m=gebi('add-filter-menu'); if(m)m.classList.add('show');
}
function toggleSelectAllOptions(src){
    const chk=src.checked, m=gebi('add-filter-menu');
    m.querySelectorAll('.filter-dropdown-item:not(.select-all-option) input').forEach(i=>{
        i.checked=chk; const k=i.getAttribute('data-key');
        if(k){ chk ? OPTIONAL_FILTERS_STATE[k]=true : (delete OPTIONAL_FILTERS_STATE[k], delete ACTIVE_FILTERS[k]); }
    });
    buildFilters(); applyFilters(); const m2=gebi('add-filter-menu'); if(m2)m2.classList.add('show');
}

function getUniqueValues(data,key,isDB2){
    let vals=new Set();
    data.forEach(i=>{
        if(!isDB2){
            let r=i[key]; if(r&&r!=='-'&&!EXCLUSIONS.includes(String(r).toLowerCase())) (key==='LTB'?vals.add(formatDate(r)):vals.add(simplifyForFilter(r,key)));
        }else if(i._DETAILS&&i._DETAILS[key]){
            i._DETAILS[key].forEach(a=>{
                if(key==='Mounting'&&String(a.value).toLowerCase().includes('wall'))return;
                let v=a.value; (v&&(v.toLowerCase()==='a'||v.toLowerCase()==='y'||v.toLowerCase()==='yes')) ? vals.add(a.label) : (v&&!EXCLUSIONS.includes(String(v).toLowerCase()) && vals.add(simplifyForFilter(v,key)));
            });
        }
    });
    return Array.from(vals).sort((a,b)=>{
        if(key==='LTB')return parseDDMMYYYY(b)-parseDDMMYYYY(a); if(key==='Memory')return parseInt(a)-parseInt(b);
        if(key==='CPU'){const pri=v=>{const s=v.toLowerCase();if(s.includes('core i7'))return 1;if(s.includes('core i5'))return 2;if(s.includes('core i3'))return 3;if(s.includes('xeon'))return 4;if(s.includes('atom')||s.includes('celeron'))return 5;return 10;};return pri(a)-pri(b);}
        return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
    });
}
function parseDDMMYYYY(s){if(!s)return 0;let p=s.split('/'); return p.length===3?new Date(p[2],p[1]-1,p[0]).getTime():0;}

function getFilterColor(key,val){
    const v=String(val).toLowerCase(), bs="font-weight:500;";
    if(key==='Memory'){ let n=parseInt(v); return bs+(n>=64?'color:#DC2626;font-weight:800;':(n===32?'color:#EA580C;':(n===16?'color:#16A34A;':(n===8?'color:#2563EB;':'color:#94A3B8;')))); }
    if(key==='CPU') return bs+((v.includes('i7')||v.includes('xeon'))?'color:#F87171;':(v.includes('i5')?'color:#FB923C;':(v.includes('i3')?'color:#FACC15;':((v.includes('atom')||v.includes('celeron'))?'color:#A3E635;':'color:#38BDF8;'))));
    if(key==='Resolution') return bs+((v.includes('1920')||v.includes('fhd'))?'color:#C084FC;':((v.includes('1280')||v.includes('wxga'))?'color:#818CF8;':'color:#94A3B8;'));
    if(key==='size'){ let n=parseFloat(v); return bs+(n<12?'color:#67E8F9;':(n>=12&&n<21?'color:#4ADE80;':'color:#F472B6;')); }
    if(key==='Type') return bs+(v.includes('pcap')?'color:#2DD4BF;':(v.includes('resistive')?'color:#FB923C;':'color:#A78BFA;'));
    const p=["#38BDF8","#818CF8","#34D399","#F472B6","#A78BFA","#FB923C","#60A5FA"]; let h=0; for(let i=0;i<v.length;i++)h=v.charCodeAt(i)+((h<<5)-h);
    return bs+`color:${p[Math.abs(h)%p.length]};`;
}

function createFilterUI(key,opts,cont,isDB2=false){
    if(opts.length===0)return;
    let label=t(key), div=ce('div'); div.className='filter-item';
    let onChg = key==='Memory' ? `toggleMemoryCascade(this.value, this.checked)` : `updateLocalState('${key}',${isDB2})`;
    div.innerHTML=`<span class="filter-label">${label}</span><button class="multiselect-btn" onclick="toggleDD('${key}')" id="btn-${key}">${t('All Selected') || 'All Selected'}</button><div class="multiselect-content" id="dd-${key}"><label class="select-all-option"><input type="checkbox" checked onchange="toggleSelectAll('${key}',this,${isDB2})"> ${t('SelectAll')}</label>${opts.map(v=>`<label class="multiselect-option" style="${getFilterColor(key,v)}"><input type="checkbox" value="${v}" checked onchange="${onChg}"> ${v}</label>`).join('')}</div>`;
    cont.appendChild(div);
}

function toggleDD(k){let el=gebi(`dd-${k}`), open=el.classList.contains('show'); doc.querySelectorAll('.multiselect-content').forEach(e=>e.classList.remove('show')); if(!open)el.classList.add('show');}
function toggleSelectAll(k,src,isDB2){doc.querySelectorAll(`#dd-${k} input:not(.select-all-option input)`).forEach(cb=>cb.checked=src.checked); updateLocalState(k,isDB2);}

function toggleMemoryCascade(val, chk){
    const target=parseInt(val);
    doc.querySelectorAll('#dd-Memory input[type="checkbox"]:not(.select-all-option input)').forEach(b=>{ const bv=parseInt(b.value); if(chk&&!isNaN(bv)&&bv<=target) b.checked=true; });
    updateLocalState('Memory',false);
}

function updateLocalState(k,isDB2){
    let chk=doc.querySelectorAll(`#dd-${k} input:not(.select-all-option input):checked`), btn=gebi(`btn-${k}`), all=doc.querySelectorAll(`#dd-${k} input:not(.select-all-option input)`).length, selAll=doc.querySelector(`#dd-${k} .select-all-option input`);
    if(selAll) selAll.checked=(chk.length===all);
    btn.innerText = chk.length===0 ? t('None') : (chk.length===all ? t('Selected') : `${chk.length} ${t('Selected')}`);
    ACTIVE_FILTERS[k]={vals:Array.from(chk).map(c=>c.value),isDB2:isDB2}; applyFilters();
}
function resetFilters(){ACTIVE_FILTERS={};gebi('pn-search').value='';gebi('sort-order').value='status';OPTIONAL_FILTERS_STATE={};buildFilters();doc.querySelectorAll('input[type="checkbox"]').forEach(c=>c.checked=true);doc.querySelectorAll('.multiselect-btn').forEach(b=>b.innerText=t('Selected'));applyFilters();gebi('main-table-container').scrollLeft=0;}
function resetFilterValuesOnly(){doc.querySelectorAll('input[type="checkbox"]:not(.filter-dropdown-item input)').forEach(c=>c.checked=true);doc.querySelectorAll('.multiselect-btn').forEach(b=>b.innerText=t('Selected'));ACTIVE_FILTERS={};}

function applyFilters(override=false){
    CURRENT_PAGE=1; const raw=gebi('pn-search').value.trim(), tokens=raw?cleanStr(raw).split(' ').filter(t=>t.length):[];
    const run=(cat)=>GLOBAL_DATA.filter(i=>{
        if(cat==='monitor'&&!i.PN.startsWith('FPM')&&!i.PN.startsWith('IDS'))return false;
        if(cat==='hmi'&&(i.PN.startsWith('FPM')||i.PN.startsWith('IDS')))return false;
        if(!override&&!raw&&i.Status==='EOL')return false;
        if(tokens.length){
            if(i.PN.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().includes(raw.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()))return true;
            const dStr=cleanStr(i._SEARCH_STR); if(!tokens.every(t=>(/^i[3579]$|^\d+gb$/.test(t))?new RegExp(`\\b${t}\\b`).test(dStr):dStr.includes(t)))return false;
        }
        const isMod=MODULAR_BOX_PCS.includes(i.PN);
        for(let k in ACTIVE_FILTERS){
            let f=ACTIVE_FILTERS[k],all=f.vals; if(!all.length)return false;
            if(isMod&&(k==='size'||k==='Resolution'||k==='Type'))continue;
            if(k.toLowerCase().includes('certific')&&TARGET_CERTIFICATIONS.every(c=>all.includes(c)))continue;
            if(k.toLowerCase().includes('os')&&TARGET_OS.every(c=>all.includes(c)))continue;
            if(!f.isDB2){if(!all.includes(k==='LTB'?formatDate(i[k]):simplifyForFilter(i[k],k)))return false;}
            else{let feats=(i._DETAILS[k]||[]).map(d=>{let v=d.value,l=d.label; return (v&&/^[ay]|^yes$/i.test(v))?(l.match(/win.*(?:10|11)/i)?(l.includes('10')?'Win 10':'Win 11'):l):simplifyForFilter(v,k);}); if(!all.some(v=>feats.includes(v)))return false;}
        }
        return true;
    });
    let res=run(CURRENT_CATEGORY);
    if(!res.length&&tokens.length&&!Object.keys(ACTIVE_FILTERS).length){
        const alt=CURRENT_CATEGORY==='monitor'?'hmi':'monitor', altRes=run(alt);
        if(altRes.length){ selectCategory(alt,false,true); res=altRes; buildFilters(); }
    }
    applySort(res);
}
function applySort(data){
    CURRENT_PAGE = 1; const s=gebi('sort-order').value;
    data.sort((a,b)=>{
        switch(s){
            case 'status': const r=x=>{x=String(x).toUpperCase();return x==='NEW'?1:(x==='ES'?2:(x==='MP'?3:(x==='LTB'?4:5)))}; return r(a.Status)-r(b.Status);
            case 'original': return (a._id||0)-(b._id||0);
            case 'pn_asc': return a.PN.localeCompare(b.PN); case 'pn_desc': return b.PN.localeCompare(a.PN);
            case 'ltb_desc': return (parseDate(b.LTB)||new Date(2099,0,1))-(parseDate(a.LTB)||new Date(2099,0,1));
            case 'ltb_asc': return (parseDate(a.LTB)||new Date(2099,0,1))-(parseDate(b.LTB)||new Date(2099,0,1));
            default: return 0;
        }
    });
    renderTable(data);
}

// Render Table with Pagination & Footer
function renderTable(data){
    CURRENT_VISIBLE_DATA=data; const body=gebi('table-body'); body.innerHTML='';
    if(!data||data.length===0){body.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:70px;color:var(--text-muted);font-size:16px;">${t('NoResults')}</td></tr>`;return;}
    
    const totalPages = Math.ceil(data.length / TABLE_LIMIT);
    if(CURRENT_PAGE > totalPages) CURRENT_PAGE = 1;
    const startIndex = (CURRENT_PAGE - 1) * TABLE_LIMIT, endIndex = startIndex + TABLE_LIMIT, visibleData = data.slice(startIndex, endIndex);
    const fmt=v=>(!v||v==='-'||v==='0'||String(v).trim()==='')?'<span class="empty-val">N/A</span>':v;
    
    visibleData.forEach(row=>{
        try{
            let tr=ce('tr'); tr.style.verticalAlign="middle"; tr.style.textAlign="center";
            let safePN=String(row.PN||"N/A"), link=(row._DIRECT_LINK&&row._DIRECT_LINK.length>5)?row._DIRECT_LINK:(safePN!=="N/A"?`https://www.google.com/search?q=site:advantech.com+${safePN}&btnI=1`:"#");
            let stockBtn = row.Status!=='EOL' ? `<a href="${row.AvailLink||`https://mya.advantech.com/en-us/search?q=${safePN}`}" target="_blank" class="btn-stock-outline" title="Configure on MyA" style="display:inline-flex;align-items:center;justify-content:center;gap:5px;"><img src="MyA.png" alt="MyA" style="height:14px;width:auto;border-radius:2px;">CONFIGURE</a>` : '';
            
            let ltbCol = (CURRENT_CATEGORY!=='monitor') ? `<td style="vertical-align:middle;text-align:center;">${fmt(formatDate(row.LTB))}</td>` : '';
            let cpuMem = (CURRENT_CATEGORY!=='monitor') 
                ? `<td class="cpu-cell" style="vertical-align:middle;text-align:center;">${fmt(simplifyValue(row.CPU,'CPU'))}</td><td style="vertical-align:middle;padding:0;"><div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:40px;"><span class="semantic-tag" style="${getSemanticStyle(row.APPLICATION,'APPLICATION')}">${fmt(simplifyValue(row.APPLICATION,'APPLICATION')).toUpperCase()}</span></div></td>` 
                : '';

            tr.innerHTML=`<td style="vertical-align:middle;text-align:center;"><span class="status-tag" style="${getStatusColor(row.Status)}">${row.Status||'-'}</span></td><td class="pn-cell" style="vertical-align:middle;text-align:center;"><div style="display:flex;align-items:center;justify-content:center!important;width:100%;gap:6px;"><a href="${link}" target="_blank" class="pn-link" title="Open Product Page">${safePN}</a><button class="btn-copy-pn" onclick="copyToClipboard('${safePN}')" title="Copy P/N"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div></td>${ltbCol}<td style="vertical-align:middle;text-align:center;">${fmt(row.size)}</td><td style="vertical-align:middle;text-align:center;">${fmt(row.Resolution)}</td>${cpuMem}<td style="vertical-align:middle;text-align:center;">${fmt(simplifyValue(row.Type,'Type'))}</td><td class="sticky-col" style="vertical-align:middle;text-align:center;"><div class="action-group">${stockBtn}<button class="action-btn" onclick="openModal('${safePN}')">DETAILS</button></div></td>`;
            body.appendChild(tr);
        }catch(e){console.warn("Skipping bad row:",row,e);}
    });

    if(totalPages > 1){
        let trPager = ce('tr'), pagerHtml = `<div class="pagination-container">`;
        pagerHtml += `<button class="page-btn" onclick="changePage(${CURRENT_PAGE-1})" ${CURRENT_PAGE===1?'disabled':''}>◀</button>`;
        let maxButtons = 5, startPage = Math.max(1, CURRENT_PAGE - Math.floor(maxButtons/2)), endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if(endPage - startPage + 1 < maxButtons){ startPage = Math.max(1, endPage - maxButtons + 1); }
        if(startPage > 1) { pagerHtml += `<button class="page-btn" onclick="changePage(1)">1</button>${startPage > 2 ? '<span class="page-dots">...</span>' : ''}`; }
        for(let i = startPage; i <= endPage; i++){ pagerHtml += `<button class="page-btn ${i===CURRENT_PAGE?'active':''}" onclick="changePage(${i})">${i}</button>`; }
        if(endPage < totalPages) { pagerHtml += `${endPage < totalPages - 1 ? '<span class="page-dots">...</span>' : ''}<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`; }
        pagerHtml += `<button class="page-btn" onclick="changePage(${CURRENT_PAGE+1})" ${CURRENT_PAGE===totalPages?'disabled':''}>▶</button></div>`;
        trPager.innerHTML = `<td colspan="10" style="padding:0;">${pagerHtml}</td>`;
        body.appendChild(trPager);
    }

    const now = new Date(), q = Math.floor((now.getMonth() + 3) / 3), qStr = `System Data: Q${q} ${now.getFullYear()}`;
    let footerRow = ce('tr');
    footerRow.innerHTML = `<td colspan="10" style="padding:0;"><div class="quarterly-footer" style="text-align:center; padding:20px; color:#94a3b8; font-size:11px; border-top:1px solid #e2e8f0; margin-top:20px;"><div style="margin-bottom:8px;"><span style="background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:4px; font-weight:bold; margin-right:8px;">${qStr}</span><span>Note: Official catalog updates are performed quarterly.</span></span></span></div><div style="opacity:0.6; font-style:italic;">Disclaimer:This website is an assistive tool. Always check and refer to official Advantech sources.</div></div></td>`;
    body.appendChild(footerRow);
}
function changePage(n){
    if(n < 1 || !CURRENT_VISIBLE_DATA) return;
    const total = Math.ceil(CURRENT_VISIBLE_DATA.length / TABLE_LIMIT);
    if(n > total) return;
    CURRENT_PAGE = n; renderTable(CURRENT_VISIBLE_DATA); gebi('main-table-container').scrollLeft=0;
}

function findBestAlternative(curr){
    const t=curr.Suggested; if(!t||t.length<3)return null;
    const m=GLOBAL_DATA.find(i=>i.PN.toUpperCase()===t.toUpperCase().trim());
    return m?{item:m}:null;
}
function triggerInternalSearch(pn){closeModal();const s=gebi('pn-search');s.value=pn;saveToHistory(pn);resetFilterValuesOnly();applyFilters(true);gebi('main-table-container').scrollLeft=0;window.scrollTo({top:100,behavior:'smooth'});}

// Modal Logic
function openModal(pn){
    let item=GLOBAL_DATA.find(i=>i.PN===pn); if(!item)return;
    gebi('modal-overlay').style.display='flex';
    let pLink=(item._DIRECT_LINK&&item._DIRECT_LINK.length>5)?item._DIRECT_LINK:(pn!=="N/A"?`https://www.google.com/search?q=site:advantech.com+${pn}&btnI=1`:"#");
    const mkBtn=(u,l,i,c)=>(!u||typeof u!=='string'||u.length<5||u.toLowerCase().includes('n/a'))?"":`<a href="${u.trim()}" target="_blank" rel="noopener noreferrer" class="${c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${i}</svg><span>${l}</span></a>`;
    const iDS=`<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path><polyline points="7 11 12 16 17 11"></polyline><line x1="12" y1="4" x2="12" y2="16"></line>`,
          iTec=`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>`,
          iSup=`<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>`;
    
    let btns=mkBtn(item.ManualLink,t('Datasheet'),iDS,"btn-impact") + mkBtn(item.TechLink,"TECH.MATERIAL",iTec,"btn-impact");
    btns+=`<button class="btn-impact" onclick="openSupportWindow('${item.PN}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iSup}</svg><span>${t('Support')}</span></button>`;
    
    let headHtml=btns?`<div class="header-btn-group" style="display:flex;gap:10px;">${btns}</div>`:'';
    let hasImg=(item.ImageURL&&typeof item.ImageURL==='string'&&item.ImageURL.length>10&&!item.ImageURL.toLowerCase().includes('undefined'));
    let comHtml=(item.Comment&&item.Comment!=='-'&&!EXCLUSIONS.includes(item.Comment.toLowerCase()))?`<div class="modal-comment-box"><span class="modal-comment-title">Note</span>${item.Comment}</div>`:'';
    
    let imgC = hasImg ? `<div class="modal-preview-card" onclick="openLightbox('${item.ImageURL}')"><img src="${item.ImageURL}" class="modal-product-img" alt="${item.PN}" onerror="this.style.display='none';this.parentElement.style.display='none';"><div class="zoom-hint">🔍 Click to Expand</div></div>` : `<div class="modal-preview-card" style="border:2px dashed #475569;background:rgba(255,255,255,0.03);display:flex;align-items:center;justify-content:center;color:#64748B;font-weight:600;cursor:default;"><div style="text-align:center;"><span>No Image</span><br><span style="font-size:11px;opacity:0.7;">Available</span></div></div>`;
    let imgCol=`<div style="display:flex;flex-direction:column;gap:10px;">${imgC}${comHtml}</div>`, detHtml="";
    
    if((item.APPLICATION&&item.APPLICATION!=='-')||(item.MARKET&&item.MARKET!=='-')||(item.Series&&item.Series!=='-')){
        detHtml+=`<div class="detail-section-title">Application</div><div class="detail-grid" style="grid-template-columns:1fr;">`;
        if(item.Series&&item.Series!=='-')detHtml+=`<div style="margin-bottom:8px;"><span class="detail-label-small">${t('Series')}: </span><span class="semantic-tag" style="${getSemanticStyle(item.Series,'Series')}">${item.Series}</span></div>`;
        if(item.MARKET&&item.MARKET!=='-')detHtml+=`<div style="margin-bottom:8px;"><span class="detail-label-small">${t('MARKET')}: </span><span class="semantic-tag" style="${getSemanticStyle(item.MARKET,'MARKET')}">${item.MARKET}</span></div>`;
        if(item.APPLICATION&&item.APPLICATION!=='-')detHtml+=`<div style="margin-bottom:8px;"><span class="detail-label-small">${t('')}</span>`;
        let appBadges = [];
        if(!EXCLUSIONS.includes(item.APPLICATION.toLowerCase())){ appBadges.push(simplifyValue(item.APPLICATION,'APPLICATION')); }
        if(item.ExtraApp && item.ExtraApp!=='-' && !EXCLUSIONS.includes(item.ExtraApp.toLowerCase())){ let extras = item.ExtraApp.split(',').filter(x=>x.trim().length>0); appBadges = appBadges.concat(extras.map(e=>e.trim())); }
        if(appBadges.length > 0){ detHtml+=`<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:5px;">`; appBadges.forEach(bad=>{ detHtml+=`<span class="detail-simple-tag">${bad}</span>`; }); detHtml+=`</div></div>`; } else { detHtml+=`</div>`; }
        detHtml+=`</div>`;
    }

    for(let cat in item._DETAILS){
        if(cat.toUpperCase().includes('P/N')||cat.startsWith('__'))continue;
        if(item._DETAILS[cat].length>0){
            detHtml+=`<div class="detail-section-title">${cat}</div><div class="detail-grid">`;
            item._DETAILS[cat].forEach(f=>{let v=String(f.value).trim(); detHtml+=(v.length<5&&(v.toLowerCase()==='a'||v.toLowerCase()==='y'||v.toLowerCase()==='yes'))?`<div class="detail-simple-tag">${f.label}</div>`:`<div class="detail-card-value"><div class="detail-label-small">${f.label}</div><div class="detail-value-text">${f.value}</div></div>`;});
            detHtml+=`</div>`;
        }
    }

    const alt=findBestAlternative(item); let altHtml="";
    if(alt){
        const a=alt.item, getC=(o,n,t)=>{const sO=String(o||"-"),sN=String(n||"-"); return (sO===sN)?{cls:"neutral",val:sN}:((t==='cpu'||t==='res')?{cls:"upgrade",val:sN}:{cls:"neutral",val:sN});};
        const c1=getC(item.CPU,a.CPU,'cpu'), c2=getC(item.Resolution,a.Resolution,'res'), c3=getC(simplifyValue(item.Type,'Type'),simplifyValue(a.Type,'Type'),'type');
        const altImg=(a.ImageURL&&a.ImageURL.length>10)?`<img src="${a.ImageURL}" class="suggestion-img" alt="${a.PN}">`:`<div style="text-align:center;font-size:10px;color:#64748B;">No Image</div>`;
        altHtml=`<div class="suggestion-card"><div class="suggestion-badge">RECOMMENDED UPGRADE</div><div class="suggestion-flex"><div class="suggestion-img-wrapper">${altImg}</div><div class="suggestion-info"><div class="suggestion-title" onclick="triggerInternalSearch('${a.PN}')">${a.PN}</div><div class="specs-diff-grid"><div class="spec-row"><span class="spec-label">CPU</span><span class="spec-val" style="opacity:0.6">${simplifyValue(item.CPU,'CPU')}</span><span class="spec-val ${c1.cls}">${simplifyValue(a.CPU,'CPU')}</span></div><div class="spec-row"><span class="spec-label">Res</span><span class="spec-val" style="opacity:0.6">${item.Resolution||'-'}</span><span class="spec-val ${c2.cls}">${a.Resolution||'-'}</span></div><div class="spec-row"><span class="spec-label">Touch</span><span class="spec-val" style="opacity:0.6">${simplifyValue(item.Type,'Type')}</span><span class="spec-val ${c3.cls}">${simplifyValue(a.Type,'Type')}</span></div><div class="spec-row"><span class="spec-label">LTB</span><span class="spec-val" style="color:#EF4444!important">${formatDate(item.LTB)}</span><span class="spec-val" style="color:#10B981!important">${a.LTB?formatDate(a.LTB):'Active'}</span></div></div><button class="btn-view-new" onclick="triggerInternalSearch('${a.PN}')">View Product Details</button></div></div></div>`;
    }
    gebi('modal-content').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #E2E8F0;padding-bottom:22px;margin-bottom:25px;"><div><h2 style="margin:0;font-size:32px;line-height:1.2;"><a href="${pLink}" target="_blank" style="color:#0F172A;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#0070E0'" onmouseout="this.style.color='#0F172A'" title="Open Product Page">${pn}</a></h2><div style="color:#64748B;font-size:18px;margin-top:8px;font-weight:500;">${item.Status} <span style="margin:0 10px;color:#E2E8F0;">|</span> ${simplifyValue(item.CPU,'CPU')}</div></div>${headHtml}</div><div class="modal-container-grid modal-layout-split">${imgCol}<div style="display:flex;flex-direction:column;gap:0px;">${detHtml||'<div style="padding:30px;color:#64748B;font-size:18px;text-align:center;">No details found.</div>'}${altHtml}<div style="width:100%;text-align:center;margin-top:30px;padding:12px;border:none;font-size:11px;color:#000000;font-style:italic;background:#ffffff;position:relative;clear:both;border-radius:4px;">Disclaimer: This website is an assistive tool. Always check and refer to official Advantech sources.</div></div></div>`;
}
function openSupportWindow(pn){
    const i=gebi('supp-pn'); 
    if(pn){i.value=pn;i.readOnly=true;i.style.opacity="0.7";i.style.cursor="default";}else{i.value='';i.readOnly=false;i.style.opacity="1";i.style.cursor="text";closeBugWindow();toggleHelp();}
    ['supp-cp','supp-customer','supp-qty','supp-competitor','supp-comment'].forEach(id=>gebi(id).value='');
    gebi('support-overlay').style.display='flex';
}
function closeSupportWindow(){gebi('support-overlay').style.display='none';}
function openBugWindow(){closeSupportWindow();toggleHelp();gebi('bug-overlay').style.display='flex';}
function closeBugWindow(){gebi('bug-overlay').style.display='none';}
function handleSupportSubmit(){
    const pn=gebi('supp-pn').value, cp=gebi('supp-cp').value.trim(), c=gebi('supp-customer').value.trim(), q=gebi('supp-qty').value.trim(), comp=gebi('supp-competitor').value.trim(), cm=gebi('supp-comment').value.trim();
    if(!cp||!c||!q||!comp){alert("Fill required fields (*).");return;}
    
    // Body Text
    const body=`PRODUCT: ${pn}%0D%0ACHANNEL PARTNER: ${cp}%0D%0AEND CUSTOMER: ${c}%0D%0APROJECT VALUE: ${q}%0D%0ACOMPETITOR: ${comp}%0D%0ACLIENT IP: ${CLIENT_IP}%0D%0A%0D%0ACOMMENTS:%0D%0A${cm}%0D%0A%0D%0A[IF NEEDED ATTACH SCREENSHOT]`;
    
    // Subject with IP
    const subject = `SUPPORT REQUEST: ${CLIENT_IP} ${pn} ${cp}`;

    window.location.href=`mailto:Osama.GadAlla@advantech.it?subject=${subject}&body=${body}`;
    setTimeout(()=>{closeSupportWindow();showToast("Opening email...");},500);
}

function handleBugSubmit(){
    const cat=gebi('bug-cat').value, d=gebi('bug-desc').value.trim();
    
    // Subject with IP
    const subject = `BUG REPORT: ${CLIENT_IP} [${cat}]`;
    const body=`CATEGORY: ${cat}%0D%0A%0D%0A%0D%0ADESCRIPTION:%0D%0A${d}%0D%0A%0D%0A[IF NEEDED ATTACH SCREENSHOT]`;

    window.location.href=`mailto:Osama.GadAlla@advantech.it?subject=${subject}&body=${body}`;
    setTimeout(()=>{closeBugWindow();showToast("Opening email...");},500);
}
function showToast(msg){let t=gebi("toast"); if(!t){t=ce('div');t.id='toast';doc.body.appendChild(t);} t.innerText=msg; t.className="show"; setTimeout(()=>t.className=t.className.replace("show",""),3000);}
function closeModal(e){if(!e||e.target.id==='modal-overlay'||e.target.className.includes('close'))gebi('modal-overlay').style.display='none';}

// Header & Utility Controls
function injectHeaderControls(){
    const themeBtn = doc.querySelector('.theme-toggle'); if(!themeBtn) return; 
    themeBtn.classList.add('std-header-btn'); themeBtn.classList.remove('login-icon-btn'); themeBtn.style.border = "1px solid var(--border)"; themeBtn.style.background = "transparent";
    const mkBtn = (icon, action, tip) => { const b = ce('button'); b.className = 'std-header-btn'; b.innerHTML = icon; b.onclick = action; b.title = tip; b.style.marginLeft = "8px"; b.style.fontWeight = "bold"; return b; };
    const helpBtn = mkBtn('?', toggleHelp, 'Support Hub'), guideBtn = mkBtn('📖', toggleGuide, 'Quick Guide');
    themeBtn.insertAdjacentElement('afterend', helpBtn); helpBtn.insertAdjacentElement('afterend', guideBtn);
}
function toggleHelp(){ let h=gebi('support-hub'), g=gebi('guide-banner'); if(g) g.style.display='none'; if(h) h.style.display = h.style.display==='block'?'none':'block'; }
function toggleGuide(){ let h=gebi('support-hub'), g=gebi('guide-banner'); if(h) h.style.display='none'; if(g) g.style.display = g.style.display==='block'?'none':'block'; }
function toggleTheme(){const h=doc.documentElement, c=h.getAttribute('data-theme'), n=c==='dark'?'light':'dark'; h.setAttribute('data-theme',n); localStorage.setItem('theme',n); updateThemeIcon(n);}
function updateThemeIcon(t){doc.querySelector('.theme-toggle').innerHTML=t==='dark'?'☀':'🌙';}
function getStatusColor(s){const x=String(s||'').trim().toUpperCase();if(x==='MP')return 'color:#10B981;background:rgba(16,185,129,0.1);';if(x==='LTB')return 'color:#F59E0B;background:rgba(245,158,11,0.1);';if(x==='NEW')return 'color:#38BDF8;background:rgba(56,189,248,0.1);';if(x==='ES')return 'color:#00C2FF;background:rgba(0,194,255,0.1);';return 'color:#EF4444;background:rgba(239,68,68,0.1);';}
function copyToClipboard(t){navigator.clipboard.writeText(t).then(()=>showToast("Copied!"));}
function showError(m){gebi('loading').style.display='none';const b=gebi('error-box');b.style.display='block';b.innerHTML=`<strong>ERROR:</strong> ${m}`;}

// Export Logic
function toggleExportMenu(){const m=gebi('export-menu');doc.querySelectorAll('.multiselect-content').forEach(e=>e.classList.remove('show'));m.classList.toggle('show');}
doc.addEventListener('click',e=>{if(!e.target.closest('.export-wrapper')){const m=gebi('export-menu');if(m)m.classList.remove('show');}});
function exportData(type){
    if(!CURRENT_VISIBLE_DATA||CURRENT_VISIBLE_DATA.length===0){alert("No data!");return;}
    try{
        const dStr=new Date().toISOString().split('T')[0], fName=`Advantech_List_${dStr}`;
        if(type==='pdf'){
            if(!window.jspdf || !window.jspdf.jsPDF){ alert("PDF Library missing (jspdf)!"); return; }
            const pdf = new window.jspdf.jsPDF({orientation:'landscape'}), img = doc.querySelector('.advantech-logo') || doc.querySelector('.login-logo-img') || doc.querySelector('img[alt*="Advantech"]');
            let iData=null;
            if(img && img.complete && img.naturalWidth > 0){ try{ const c = ce("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); iData = c.toDataURL("image/png"); } catch(e){ console.warn("Logo export skipped:", e); } }
            if(iData) pdf.addImage(iData, 'PNG', 14, 8, 35, 10);
            pdf.setFontSize(16); pdf.setTextColor(0, 86, 210); pdf.text(`Product List`, 14, 30); pdf.setFontSize(10); pdf.setTextColor(100); pdf.text(`Date: ${dStr}`, 14, 37);
            const head=[["Status","P/N","LTB","Size","Res","CPU","Touch","Mem"]], body=CURRENT_VISIBLE_DATA.map(r=>[r.Status,r.PN,formatDate(r.LTB),r.size,r.Resolution,r.CPU, r.Type,r.Memory]);
            if(typeof pdf.autoTable !== 'function'){ alert("AutoTable Plugin missing!"); return; }
            pdf.autoTable({head:head, body:body, startY:43, theme:'grid', styles:{fontSize:8,cellPadding:2,valign:'middle'}, headStyles:{fillColor:[0,112,224],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[241,245,249]}}); pdf.save(`${fName}.pdf`);
        } else {
            const clean=CURRENT_VISIBLE_DATA.map(r=>{
                let dStr=r._DETAILS ? Object.entries(r._DETAILS).map(([k,v])=>{ let vs=v.map(x=>(String(x.value).trim().length<3&&String(x.value).toUpperCase().includes('A'))?x.label:x.value).join(', '); return `${k.toUpperCase()}: ${vs}`; }).join(' | \n') : "";
                return { "Status":r.Status, "P/N":r.PN, "LTB":r.LTB instanceof Date?r.LTB.toLocaleDateString():r.LTB, "Size":r.size, "Res":r.Resolution, "CPU":r.CPU, "Touch":r.Type, "Mem":r.Memory, "App":r.APPLICATION, "Market":r.MARKET, "Series":r.Series, "Note":r.Comment, "Details":dStr };
            });
            const ws=XLSX.utils.json_to_sheet(clean);
            if(type==='csv'){ const c=XLSX.utils.sheet_to_csv(ws), b=new Blob(["\ufeff"+c],{type:'text/csv;charset=utf-8;'}), u=URL.createObjectURL(b), a=ce("a"); a.href=u; a.download=`${fName}.csv`; doc.body.appendChild(a); a.click(); doc.body.removeChild(a); }
            else { const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"ProductList"); XLSX.writeFile(wb,`${fName}.xlsx`); }
        }
    } catch(e){ console.error(e); alert("Export Error: "+e.message); } 
    const m=gebi('export-menu'); if(m) m.classList.remove('show');
}

// Video Player Logic
function playGuideVideo(){ const v = gebi('guide-video'); if(v) v.play(); }
function hideGuideOverlay(){ const o = gebi('vid-overlay'), v = gebi('guide-video'); if(v) v.setAttribute('controls', 'true'); if(o) { o.style.opacity = '0'; o.style.visibility = 'hidden'; o.style.pointerEvents = 'none'; } }
function resetGuideVideo(){ const v = gebi('guide-video'), o = gebi('vid-overlay'); if(v) { v.pause(); v.currentTime = 0; v.removeAttribute('controls'); } if(o) { o.style.visibility = 'visible'; o.style.opacity = '1'; o.style.pointerEvents = 'auto'; } }
function handleVideoError(){ const o = gebi('vid-overlay'), e = gebi('vid-error'), v = gebi('guide-video'); if(o) o.style.display = 'none'; if(v) v.style.display = 'none'; if(e) e.style.display = 'flex'; }
// Autocomplete Logic
function handleAcSearch(inp){
    const val = inp.value.trim().toLowerCase();
    const box = gebi('ac-results');
    if(val.length < 1) { box.style.display='none'; return; }
   // Search logic: matches PN, CPU, or Description
    const matches = GLOBAL_DATA.filter(i => 
        i.PN.toLowerCase().includes(val) || 
        (i.CPU && i.CPU.toLowerCase().includes(val))
    ).slice(0, 8); // Limit to 8 results for performance
    if(matches.length === 0) { box.style.display='none'; return; }   box.innerHTML = matches.map(m => `
        <div class="custom-ac-item" onclick="selectAcProduct('${m.PN}')">
            <span class="ac-main">${m.PN}</span>
            <span class="ac-sub">${m.CPU ? simplifyValue(m.CPU,'CPU') : 'System'} ${m.Description ? ' - '+m.Description : ''}</span>
        </div>
    `).join('');
    box.style.display = 'block';
}function selectAcProduct(pn){
    gebi('supp-pn').value = pn;
    gebi('ac-results').style.display = 'none';
}function closeAc(){
    const box = gebi('ac-results');
    if(box) box.style.display = 'none';
}
 


 



