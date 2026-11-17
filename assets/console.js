        // ============================================
        // FIREBASE CONFIG
        // ============================================
        const firebaseConfig = {
            apiKey: "AIzaSyDCOq720_5pxOsUYXovvi4DaUsryv1oPeA",
            authDomain: "stardust-store.firebaseapp.com",
            databaseURL: "https://stardust-store-default-rtdb.firebaseio.com",
            projectId: "stardust-store",
            storageBucket: "stardust-store.firebasestorage.app",
            messagingSenderId: "979834482722",
            appId: "1:979834482722:web:dabbc453543b7e03c91a7b",
            measurementId: "G-YKYR514S87"
        };

        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.database();

        // ============================================
        // IMGBB API KEY
        // ============================================
        // Several keys: uploads are spread across them and, if one runs out of its limit, the next one is used automatically.
        const IMGBB_KEYS = [
            "550a3bcd47c1b0a86a9f2ba7a41770b6",
            "742851e212792d6bfc672313108289c0",
            "bf18416a217228e4e067a94faa6c10a8",
            "d75c4ca4974dc5b81fd0e1739da86b52",
            "36645f7ee1bc25d4b4e76c05cfef33d4",
            "89a6970a7e668212364be3a74c198aba",
            "721373c358c1f1d72259d8d8523b677a",
            "207a855fc5ff274c3c2380cfad628b4b",
            "736e4e92f0e1d37c2ddf9d68962b02c7",
            "0c4ee72d5170a06cde2bb96ebba382e1",
            "9fa796204c10145c452d16e329d708ff"
        ];
        const imgbbBad = {}; // key -> time it last failed (skipped for 10 minutes)

        // ============================================
        // STATE
        // ============================================
        let currentUser = null;
        let allApps = [];
        let allReviews = {};
        let allNotifications = [];
        let currentReviewFilter = 'all';
        let currentPage = document.body.dataset.page || 'dashboard';
        let isLoginMode = true;
        let currentStep = 1;
        let editAppId = null;
        let updateAppId = null;
        let drafts = JSON.parse(localStorage.getItem('stardust_drafts') || '{}');
        let activityLog = JSON.parse(localStorage.getItem('stardust_activity_log') || '[]');

        // ============================================
        // DOM REFS
        // ============================================
        // Safe element lookup: every page only contains its own section, so a missing element returns a harmless stand-in
        const NULL_EL = new Proxy(function () {}, {
            get: (t, k) => k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains() { return false; } }
                : (k === 'style' || k === 'dataset') ? {} : k === 'files' ? [] : (k === 'value' || k === 'textContent' || k === 'innerHTML') ? ''
                : k === Symbol.toPrimitive ? () => '' : () => NULL_EL,
            set: () => true, apply: () => NULL_EL
        });
        const $ = id => document.getElementById(id) || NULL_EL;

        // ============================================
        // POPUPS (styled replacements for alert / confirm)
        // ============================================
        const ZD_ICO = {
            success: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', error: '<path d="M7 7l10 10M17 7L7 17"/>', warn: '<path d="M12 7.5v6M12 17v.01"/>',
            info: '<path d="M12 11v6M12 7.5v.01"/>', danger: '<path d="M4.5 7.5h15M9.5 7.5v-3h5v3M6.5 7.5l.8 12h9.4l.8-12M10 11v5M14 11v5"/>'
        };
        let zdOpenCount = 0;
        function zdShow(o) {
            return new Promise(res => {
                const type = o.type || 'info', ov = document.createElement('div');
                ov.className = 'zd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
                const steps = (o.steps || []).map((t, i) => `<li class="${i === 0 ? 'on' : ''}"><i>${i === 0 ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : i + 1}</i><span>${escHtml(t)}</span></li>`).join('');
                ov.innerHTML = `<div class="zd-card zd-${type}"><div class="zd-ic"><svg viewBox="0 0 24 24">${ZD_ICO[type] || ZD_ICO.info}</svg></div><h3>${escHtml(o.title || '')}</h3>${o.body ? `<p>${escHtml(o.body).replace(/\n/g, '<br>')}</p>` : ''}${steps ? `<ol class="zd-steps">${steps}</ol>` : ''}<div class="zd-act">${o.cancel ? `<button type="button" class="zd-b ghost" data-v="0">${escHtml(o.cancel)}</button>` : ''}<button type="button" class="zd-b ${o.danger ? 'danger' : 'main'}" data-v="1">${escHtml(o.ok || 'OK')}</button></div></div>`;
                document.body.appendChild(ov); zdOpenCount++; document.documentElement.classList.add('zd-lock');
                requestAnimationFrame(() => ov.classList.add('show'));
                const prevFocus = document.activeElement;
                const done = v => { document.removeEventListener('keydown', key, true); ov.classList.remove('show'); setTimeout(() => { ov.remove(); if (--zdOpenCount <= 0) document.documentElement.classList.remove('zd-lock'); }, 180); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) { } res(v); };
                const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(!o.cancel); } };
                document.addEventListener('keydown', key, true);
                ov.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v === '1'); else if (e.target === ov && !o.sticky) done(!o.cancel); });
                const main = ov.querySelector('.zd-b:not(.ghost)'); if (main) setTimeout(() => main.focus(), 60);
            });
        }
        // alert replacement: the first paragraph becomes the title when the message has two paragraphs
        function zdAlert(msg, o) {
            o = o || {}; msg = String(msg == null ? '' : msg);
            let title = o.title, body = msg;
            if (!title) { const parts = msg.split('\n\n'); if (parts.length > 1) { title = parts.shift().replace(/[.:]$/, ''); body = parts.join('\n\n'); } else { title = ''; } }
            let type = o.type;
            if (!type) type = /could not|couldn.t|failed|error|denied|permission/i.test(msg) ? 'error' : /^(please|set a|choose|enter|add |select|write)|too large|must |valid|at least|required/i.test(msg) ? 'warn' : 'success';
            if (!title) { title = body; body = ''; if (title.length > 70) { body = title; title = type === 'error' ? 'Something went wrong' : type === 'warn' ? 'Check this' : 'Done'; } }
            return zdShow({ type, title, body, ok: o.ok || 'OK', steps: o.steps });
        }
        function zdConfirm(msg, o) {
            o = o || {};
            const parts = String(msg).split('\n\n'), first = parts.shift();
            return zdShow({ type: o.danger ? 'danger' : (o.type || 'warn'), title: o.title || first, body: o.title ? msg : parts.join('\n\n'), ok: o.ok || 'Confirm', cancel: o.cancel || 'Cancel', danger: !!o.danger });
        }
        function zdToast(msg, type) {
            let w = document.getElementById('zdToasts'); if (!w) { w = document.createElement('div'); w.id = 'zdToasts'; document.body.appendChild(w); }
            const t = document.createElement('div'); t.className = 'zd-toast ' + (type || 'success');
            t.innerHTML = `<svg viewBox="0 0 24 24">${ZD_ICO[type === 'error' ? 'error' : 'success']}</svg><span>${escHtml(msg)}</span>`;
            w.appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
            setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2600);
        }

        const loginPage = $('loginPage');
        const appContainer = $('appContainer');
        const loadingOverlay = $('loadingOverlay');
        const loadingText = $('loadingText');

        // ============================================
        // LOADING
        // ============================================
        const SPLASH_MIN_MS = 900; // let the UptoZishu light sweep be seen on every page change
        function showLoading(show, text = '') {
            if (show) {
                loadingText.textContent = /^(Loading|Starting)/.test(text) ? '' : text;
                loadingOverlay.classList.add('show');
            } else {
                const wait = Math.max(0, SPLASH_MIN_MS - performance.now());
                setTimeout(() => loadingOverlay.classList.remove('show'), wait);
            }
        }

        // ============================================
        // AUTH
        // ============================================
        const USER_RE = /^[a-z0-9_.]{3,20}$/;
        let pendingSignup = false; // true while sign-up is still saving the profile, so the auth listener doesn't redirect early
        const cleanUser = u => String(u || '').trim().toLowerCase().replace(/^@+/, '');
        const userError = u => USER_RE.test(u) ? '' : 'Username must be 3–20 characters: lowercase letters, numbers, _ or .';
        function authMsg(err) {
            const c = err && err.code;
            if (c === 'auth/email-already-in-use') return 'This email already has an account. Tap "Sign in" instead. If you use the UptoZishu store with it, your store username is used here too.';
            if (c === 'auth/invalid-email') return 'Enter a valid email address.';
            if (c === 'auth/weak-password') return 'Password must be at least 6 characters.';
            if (c === 'auth/user-not-found' || c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials') return 'Wrong email or password.';
            if (c === 'auth/too-many-requests') return 'Too many tries. Please wait a bit and try again.';
            if (c === 'auth/network-request-failed') return 'No internet connection.';
            if (err && err.message === 'taken') return 'That username is already taken.';
            return (err && err.message) || 'Something went wrong. Please try again.';
        }
        // live "available / taken" hint under a username box
        function watchUsername(inputId, hintId, idleText) {
            const input = $(inputId), hint = $(hintId); let t = 0;
            if (!input || !hint) return;
            const set = (txt, cls) => { hint.textContent = txt; hint.className = 'hint' + (cls ? ' ' + cls : ''); };
            input.addEventListener('input', () => {
                clearTimeout(t);
                const u = cleanUser(input.value);
                if (!u) { set(idleText || '', ''); return; }
                const bad = userError(u); if (bad) { set(bad, 'bad'); return; }
                set('Checking…', '');
                t = setTimeout(() => {
                    db.ref('usernames/' + u).once('value').then(snap => {
                        if (cleanUser(input.value) !== u) return;
                        const owner = snap.val();
                        if (owner && (!auth.currentUser || owner !== auth.currentUser.uid)) set('@' + u + ' is already taken', 'bad'); else set('@' + u + ' is available', 'ok');
                    }).catch(() => set(idleText || '', ''));
                }, 400);
            });
        }
        watchUsername('signUser', 'signUserHint', '');
        watchUsername('compUser', 'compUserHint', '3–20 characters: lowercase letters, numbers, _ or .');

        function switchAuthMode() {
            isLoginMode = !isLoginMode;
            const btn = $('loginBtn');
            document.querySelectorAll('#loginForm .su').forEach(el => { el.hidden = isLoginMode; });
            $('googleLabel').textContent = isLoginMode ? 'Sign in with Google' : 'Sign up with Google';
            if (isLoginMode) {
                btn.textContent = 'Sign In';
                document.querySelector('.toggle-mode').innerHTML =
                    `Don't have an account? <span onclick="switchAuthMode()">Create one</span>`;
            } else {
                btn.textContent = 'Create Account';
                document.querySelector('.toggle-mode').innerHTML =
                    `Already have an account? <span onclick="switchAuthMode()">Sign in</span>`;
            }
            $('loginError').textContent = '';
        }

        // claim the username for this uid, then write the shared profile (same records the UptoZishu store uses)
        function saveDevProfile(user, name, uname, bio) {
            const uref = db.ref('usernames/' + uname);
            return uref.once('value').then(snap => {
                const owner = snap.val();
                if (owner && owner !== user.uid) throw new Error('taken');
                if (owner === user.uid) return;
                return uref.set(user.uid).catch(() => { throw new Error('taken'); });
            }).then(() => db.ref('users/' + user.uid).once('value')).then(snap => {
                const old = snap.val() || {};
                return db.ref('users/' + user.uid).set({ name, username: uname, bio, createdAt: old.createdAt || Date.now() });
            }).then(() => {
                db.ref('developers/' + user.uid).update({ displayName: name, bio, username: uname, email: user.email || '' }).catch(() => {});
                try { user.updateProfile({ displayName: name }); } catch (e) {}
            });
        }

        function showComplete(user, pre) {
            pre = pre || {};
            loginPage.style.display = 'none';
            $('completePage').style.display = 'flex';
            $('compName').value = pre.name || user.displayName || '';
            $('compBio').value = pre.bio || '';
            showLoading(false);
        }
        function signOutFromComplete() {
            auth.signOut().then(() => { try { localStorage.removeItem('stardust_uid'); } catch (e) {} location.replace('/auth/'); });
        }
        function handleComplete(e) {
            e.preventDefault();
            const user = auth.currentUser, err = $('compError'), btn = $('compBtn');
            if (!user) { err.textContent = 'Please sign in again.'; return; }
            const name = $('compName').value.trim(), uname = cleanUser($('compUser').value), bio = $('compBio').value.trim().slice(0, 140);
            if (name.length < 2) { err.textContent = 'Please enter your name.'; return; }
            const bad = userError(uname); if (bad) { err.textContent = bad; return; }
            btn.disabled = true; btn.textContent = 'Saving...'; err.textContent = '';
            saveDevProfile(user, name, uname, bio).then(() => goNext()).catch(x => {
                btn.disabled = false; btn.textContent = 'Continue'; err.textContent = authMsg(x);
            });
        }

        function handleAuth(e) {
            e.preventDefault();
            const email = $('loginEmail').value.trim();
            const password = $('loginPassword').value;
            const btn = $('loginBtn');
            const errorEl = $('loginError');

            if (!email || !password) { errorEl.textContent = 'Please fill all fields.'; return; }
            if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }

            if (isLoginMode) {
                btn.disabled = true; btn.textContent = 'Signing in...'; errorEl.textContent = '';
                auth.signInWithEmailAndPassword(email, password)
                    .then(() => { btn.disabled = false; btn.textContent = 'Sign In'; })
                    .catch(err => { btn.disabled = false; btn.textContent = 'Sign In'; errorEl.textContent = authMsg(err); });
                return;
            }

            // sign up: Name, Username, Bio, Email, Password, Confirm password
            const name = $('signName').value.trim(), uname = cleanUser($('signUser').value), bio = $('signBio').value.trim().slice(0, 140);
            if (name.length < 2) { errorEl.textContent = 'Please enter your name.'; return; }
            const bad = userError(uname); if (bad) { errorEl.textContent = bad; return; }
            if (password !== $('signConfirm').value) { errorEl.textContent = 'Passwords do not match.'; return; }
            btn.disabled = true; btn.textContent = 'Creating account...'; errorEl.textContent = '';
            const reset = () => { btn.disabled = false; btn.textContent = 'Create Account'; };
            db.ref('usernames/' + uname).once('value').catch(() => null).then(snap => {
                if (snap && snap.val()) throw new Error('taken');
                pendingSignup = true;
                return auth.createUserWithEmailAndPassword(email, password);
            }).then(result => saveDevProfile(result.user, name, uname, bio).then(() => { pendingSignup = false; goNext(); }, x => {
                // account exists but the profile could not be saved (e.g. username just got taken): let them fix it
                pendingSignup = false; reset(); showComplete(result.user, { name, bio });
                $('compUser').value = uname; $('compError').textContent = authMsg(x);
            })).catch(err => { pendingSignup = false; reset(); errorEl.textContent = authMsg(err); });
        }

        // Google Sign-In (works for sign in and sign up; new accounts get the "Finish your profile" step)
        function signInWithGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .catch(err => {
                    if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) return;
                    zdAlert('Google Sign-In failed: ' + err.message);
                });
        }

        // after any sign-in on the auth page: existing profile (e.g. from the store) -> go in, otherwise finish the profile
        function ensureProfile(user) {
            db.ref('users/' + user.uid).once('value').then(snap => {
                const p = snap.val();
                if (p && p.username) {
                    db.ref('developers/' + user.uid).update({ username: p.username, email: user.email || '' }).catch(() => {});
                    db.ref('developers/' + user.uid + '/displayName').once('value').then(d => { if (!d.val() && p.name) db.ref('developers/' + user.uid + '/displayName').set(p.name); }).catch(() => {});
                    goNext();
                } else showComplete(user, p || {});
            }).catch(() => goNext());
        }

        // ============================================
        // INIT APP
        // ============================================
        function initApp(user) {
            currentUser = user;
            loginPage.style.display = 'none';
            appContainer.classList.add('show');

            const name = user.displayName || user.email.split('@')[0] || 'Developer';
            $('userDisplayName').textContent = name;
            $('userDisplayEmail').textContent = user.email;
            $('userAvatar').textContent = name.charAt(0).toUpperCase();
            $('welcomeMsg').textContent = `Welcome Back, ${name}`;

            // Load data
            loadApps();
            loadNotifications();
            watchUserTickets();
            watchMyUpdates();
            initPage();
            localStorage.setItem('stardust_uid', user.uid);
            // accounts without a username (older developers) finish their profile first
            db.ref('users/' + user.uid).once('value').then(snap => {
                const p = snap.val();
                if (p && p.username) window._devUsername = p.username;
                else if (!leaving) { leaving = true; location.replace('/auth/?next=' + encodeURIComponent(location.pathname + location.search)); }
            }).catch(() => {});
            showLoading(false);
        }

        // ============================================
        // AUTH STATE LISTENER
        // ============================================
        const ON_AUTH_PAGE = currentPage === 'auth';
        function nextUrl() {
            const n = new URLSearchParams(location.search).get('next') || '/';
            return (n.charAt(0) === '/' && n.charAt(1) !== '/' && n.indexOf('/auth') !== 0) ? n : '/';
        }
        let leaving = false;
        function goNext() { if (leaving) return; leaving = true; location.replace(nextUrl()); }

        auth.onAuthStateChanged(user => {
            if (user) {
                try { localStorage.setItem('stardust_uid', user.uid); } catch (e) {}
                if (ON_AUTH_PAGE) { if (!pendingSignup && !leaving) ensureProfile(user); return; }
                if (!appContainer.classList.contains('show')) initApp(user);
            } else {
                try { localStorage.removeItem('stardust_uid'); } catch (e) {}
                if (ON_AUTH_PAGE) {
                    loginPage.style.display = 'flex';
                    showLoading(false);
                } else if (!leaving) {
                    leaving = true;
                    location.replace('/auth/?next=' + encodeURIComponent(location.pathname + location.search));
                }
            }
        });

        // ============================================
        // THEME - Persistent
        // ============================================
        const THEME_KEY = 'zt_console_theme'; // 'dark' | 'light'; nothing saved = follow the phone's system theme
        let darkMode = true;
        const sysDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: true };

        function applyTheme(dark, persist) {
            const root = document.documentElement;
            const v = dark
                ? { '--bg-dark': '#0b0f19', '--bg-card': '#111827', '--bg-input': '#1f2937', '--text-light': '#f9fafb', '--text-gray': '#9ca3af', '--border-color': '#374151' }
                : { '--bg-dark': '#f1f5f9', '--bg-card': '#ffffff', '--bg-input': '#e2e8f0', '--text-light': '#0f172a', '--text-gray': '#475569', '--border-color': '#cbd5e1' };
            Object.keys(v).forEach(k => root.style.setProperty(k, v[k]));
            root.style.colorScheme = dark ? 'dark' : 'light';
            try { if (persist) localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
            darkMode = dark;
        }
        let savedTheme = null;
        try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
        applyTheme(savedTheme ? savedTheme === 'dark' : sysDark.matches, false);
        if (sysDark.addEventListener) sysDark.addEventListener('change', e => {
            let s = null; try { s = localStorage.getItem(THEME_KEY); } catch (x) {}
            if (!s) applyTheme(e.matches, false);
        });
        function useSystemTheme() {
            try { localStorage.removeItem(THEME_KEY); } catch (e) {}
            applyTheme(sysDark.matches, false);
        }

        function toggleThemeSettings() {
            applyTheme(!darkMode, true);
        }

        // ============================================
        // NAVIGATION
        // ============================================
        const PAGE_URL = { dashboard: '/', myapps: '/apps/', upload: '/upload/', analytics: '/analytics/', reviews: '/reviews/', notifications: '/notifications/', profile: '/profile/', settings: '/settings/', support: '/support/' };
        function switchPage(page) {
            if (page === currentPage) return;
            location.href = PAGE_URL[page] || '/';
        }

        // Runs once the user is signed in: prepares only the page that is open
        function initPage() {
            if (currentPage === 'dashboard' || currentPage === 'analytics') loadStats();
            if (currentPage === 'dashboard') updateDashboard();
            if (currentPage === 'notifications') renderNotifications();
            if (currentPage === 'analytics') populateAnalyticsSelect();
            if (currentPage === 'reviews' || currentPage === 'hiddenreviews') loadReviews();
            if (currentPage === 'profile') loadProfile();
            if (currentPage === 'myapps') initAppSearch();
            if (currentPage === 'claim') initClaimPage();
            if (currentPage === 'settings') initSettings();
            if (currentPage === 'support') renderTicketList();
            if (currentPage === 'ticket') initTicketPage();
        }

        // ============================================
        // LOAD APPS
        // ============================================
        // Keep each app's rating + review count equal to its real reviews (the old default was a fake 4.5)
        const ratingSynced = {};
        function syncRatings() {
            allApps.forEach(app => {
                if (ratingSynced[app.id]) return;
                ratingSynced[app.id] = true;
                db.ref('reviews/' + app.id).once('value').then(snap => {
                    let sum = 0, n = 0;
                    snap.forEach(c => { const r = c.val(); if (r && r.text && !r.hidden) { sum += Math.min(5, Math.max(1, Math.round(+r.rating || 5))); n++; } });
                    const avg = n ? Math.round((sum / n) * 10) / 10 : 0;
                    if (avg !== (+app.rating || 0) || n !== (app.reviewCount || 0)) {
                        return db.ref('apps/' + app.id).update({ rating: avg, reviewCount: n });
                    }
                }).catch(() => { ratingSynced[app.id] = false; });
            });
        }

        // when an app was created: its timestamp, else the time hidden in its Firebase push id, else its upload date
        const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
        function appCreated(a) {
            let t = Number(a.timestamp);
            if (t > 0) return t < 1e11 ? t * 1000 : t; // seconds -> ms
            if (typeof a.timestamp === 'string' && !isNaN(Date.parse(a.timestamp))) return Date.parse(a.timestamp);
            const id = String(a.id || '');
            if (id.length === 20 && id[0] === '-') {
                t = 0;
                for (let i = 0; i < 8; i++) t = t * 64 + PUSH_CHARS.indexOf(id[i]);
                if (t > 1e12 && t < 4e12) return t;
            }
            const d = Date.parse(a.uploadDate || a.updatedDate || '');
            return isNaN(d) ? 0 : d;
        }

        function loadApps() {
            showLoading(true, 'Loading apps...');
            db.ref('apps').on('value', snapshot => {
                const data = snapshot.val();
                allApps = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                if (currentUser) {
                    allApps = allApps.filter(a => a.developerUid === currentUser.uid);
                }
                // newest apps first (push ids are time-ordered, so they also order older apps that have no timestamp)
                allApps.sort((x, y) => appCreated(y) - appCreated(x) || (x.id < y.id ? 1 : -1));
                syncRatings();
                $('appCountBadge').textContent = allApps.length;
                if (currentPage === 'dashboard') updateDashboard();
                if (currentPage === 'myapps') renderMyApps();
                if (currentPage === 'analytics') populateAnalyticsSelect();
                if (currentPage === 'reviews') { populateReviewSelect(); renderReviews(); }
                if (currentPage === 'hiddenreviews') { populateReviewSelect(); renderHiddenReviews(); }
                showLoading(false);
            }, err => { showLoading(false);
                console.error(err); });
        }

        // ============================================
        // DAILY STATS (written by the store on every download, IST day)
        // ============================================
        const DAY_MS = 86400000, IST_MS = 19800000;
        const dayKey = ts => new Date(ts + IST_MS).toISOString().slice(0, 10);
        let allStats = {};
        function loadStats() {
            db.ref('stats').on('value', snap => {
                allStats = snap.val() || {};
                if (currentPage === 'dashboard') updateDashboard();
                if (currentPage === 'analytics' && $('anaAppSelect').value) loadAppAnalytics();
            }, err => console.warn('stats not readable', err));
        }
        function lastDays(n) {
            const out = [], now = Date.now();
            for (let i = n - 1; i >= 0; i--) {
                const t = now - i * DAY_MS, d = new Date(t + IST_MS);
                out.push({
                    key: dayKey(t),
                    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
                    dm: d.getUTCDate() + '/' + (d.getUTCMonth() + 1)
                });
            }
            return out;
        }
        const dayCount = (ids, key) => ids.reduce((s, id) => s + ((allStats[id] && allStats[id][key]) || 0), 0);
        function barChart(days, values, n) {
            const max = Math.max(1, ...values);
            const every = n <= 7 ? 1 : (n <= 30 ? 5 : 15);
            return '<div class="bars">' + values.map((v, i) => {
                const lbl = n <= 7 ? days[i].weekday : (((days.length - 1 - i) % every === 0) ? days[i].dm : '');
                const h = v ? Math.max(6, Math.round(v / max * 120)) : 3;
                return `<div class="bar-col" title="${days[i].key}: ${v}"><span class="bar-val">${n <= 7 && v ? v : ''}</span><div class="bar${v ? '' : ' zero'}" style="height:${h}px"></div><span class="bar-lbl">${lbl}</span></div>`;
            }).join('') + '</div>';
        }
        function setBadge(el, n) { el.textContent = n; el.style.display = n > 0 ? '' : 'none'; }

        // ============================================
        // DASHBOARD
        // ============================================
        function updateDashboard() {
            const total = allApps.length;
            const downloads = allApps.reduce((s, a) => s + (a.downloadCount || 0), 0);
            const views = allApps.reduce((s, a) => s + (a.views || 0), 0);
            const reviews = allApps.reduce((s, a) => s + (a.reviewCount || 0), 0);
            const ratings = allApps.filter(a => a.rating).map(a => a.rating);
            const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length) : 0;
            const live = allApps.filter(a => a.status === 'live' || a.status === 'approved').length;

            const ids = allApps.map(x => x.id);
            let monthly;
            if (Object.keys(allStats).length) {
                monthly = lastDays(30).reduce((s, d) => s + dayCount(ids, d.key), 0);
            } else {
                const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                monthly = allApps.reduce((s, x) => (x.downloadDate && new Date(x.downloadDate).getTime() > monthAgo) ? s + (x.downloadCount || 0) : s, 0);
            }

            $('statTotalApps').textContent = total;
            $('statDownloads').textContent = downloads.toLocaleString();
            $('statViews').textContent = views.toLocaleString();
            $('statRating').textContent = avgRating.toFixed(1);
            $('statReviewsCount').textContent = reviews;
            $('statMonthlyDownloads').textContent = monthly.toLocaleString();
            $('statLiveApps').textContent = live;
            $('appCountBadge').textContent = total;

            // Real downloads per day (last 7 days) from the store's daily counter
            const days7 = lastDays(7);
            const vals7 = days7.map(d => dayCount(ids, d.key));
            $('dashChart').innerHTML = barChart(days7, vals7, 7);
            const sum7 = vals7.reduce((s, v) => s + v, 0);
            $('dashChartNote').textContent = sum7
                ? `${sum7} download${sum7 === 1 ? '' : 's'} in the last 7 days`
                : 'No downloads recorded in the last 7 days. Daily tracking starts from the first download after this update.';

            const topApps = [...allApps].sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 5);
            const topList = $('topAppsList');
            topList.innerHTML = '';
            if (topApps.length === 0) {
                topList.innerHTML = '<p style="color:var(--text-gray);">No apps yet</p>';
            } else {
                topApps.forEach((app, i) => {
                    topList.innerHTML +=
                        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">
                            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px;">${i + 1}. ${escHtml(app.name)}</span>
                            <span style="color:var(--primary);">${app.downloadCount || 0}</span>
                        </div>`;
                });
            }
        }

        // ============================================
        // MY APPS (with instant search)
        // ============================================
        const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        let appQuery = '', appStatus = 'all';

        function initAppSearch() {
            const input = $('appSearch'), status = $('appStatusFilter'), clear = $('appSearchClear');
            const q = new URLSearchParams(location.search).get('q');
            if (q) { input.value = q; appQuery = q.toLowerCase(); }
            let timer;
            input.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => { appQuery = input.value.trim().toLowerCase(); clear.style.display = input.value ? 'block' : 'none'; renderMyApps(); }, 120);
            });
            clear.addEventListener('click', () => { input.value = ''; appQuery = ''; clear.style.display = 'none'; input.focus(); renderMyApps(); });
            status.addEventListener('change', () => { appStatus = status.value; renderMyApps(); });
            clear.style.display = input.value ? 'block' : 'none';
        }

        function buildStatusOptions(app) {
            const cur = app.status || 'live';
            const opts = { live: [['live', 'Live: visible in the store'], ['draft', 'Draft: hidden']], pending: [['pending', 'In review: waiting for approval'], ['draft', 'Withdraw to draft']], draft: [['draft', 'Draft: hidden'], ['pending', 'Submit for review']], rejected: [['rejected', 'Rejected: not submitted'], ['draft', 'Keep as draft'], ['pending', 'Submit for review again']], suspended: [['suspended', 'Suspended by UptoZishu']], approved: [['live', 'Live: visible in the store'], ['draft', 'Draft: hidden']] }[cur] || [['draft', 'Draft: hidden'], ['pending', 'Submit for review']];
            const sel = $('editStatus'); sel.innerHTML = opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');
            sel.value = cur === 'approved' ? 'live' : cur; sel.disabled = cur === 'suspended';
        }
        function appMatches(app) {
            const live = (app.status === 'live' || app.status === 'approved');
            if (appStatus === 'live' && !live) return false;
            if (appStatus === 'draft' && app.status !== 'draft') return false;
            if (appStatus === 'pending' && app.status !== 'pending') return false;
            if (appStatus === 'rejected' && app.status !== 'rejected') return false;
            if (!appQuery) return true;
            const hay = [app.name, app.package, app.category, app.version, app.tags, app.shortDescription, app.status].join(' ').toLowerCase();
            return appQuery.split(/\s+/).every(w => hay.includes(w));
        }

        function renderMyApps() {
            const container = $('myAppsList');
            container.innerHTML = '';
            const shown = allApps.filter(appMatches);
            $('appSearchCount').textContent = allApps.length ? (shown.length === allApps.length ? `${allApps.length} apps` : `Showing ${shown.length} of ${allApps.length} apps`) : '';
            if (allApps.length && shown.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        <h3>No apps found</h3>
                        <p>Nothing matches your search. Try a different name, package or category.</p>
                    </div>`;
                return;
            }
            if (allApps.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                        <h3>No Apps Yet</h3>
                        <p>Upload your first application to get started.</p>
                        <button class="btn-primary" onclick="switchPage('upload')">Upload App</button>
                    </div>
                `;
                return;
            }
            shown.forEach(app => {
                const statusMap = {
                    'live': { class: 'live', label: 'Live' },
                    'approved': { class: 'live', label: 'Live' },
                    'draft': { class: 'draft', label: 'Draft' },
                    'pending': { class: 'pend', label: 'In review' },
                    'rejected': { class: 'rej', label: 'Rejected' },
                    'suspended': { class: 'susp', label: 'Suspended' }
                };
                const st = statusMap[app.status] || statusMap['live'];
                const div = document.createElement('div');
                div.className = 'app-list-item';
                div.innerHTML = `
                    <div class="app-info">
                        <img src="${app.icon || 'https://img.icons8.com/color/144/android-os.png'}" onerror="this.src='https://img.icons8.com/color/144/android-os.png'">
                        <div>
                            <div class="app-name">${escHtml(app.name || 'App')}</div>
                            <div class="app-meta">${escHtml(app.package || '')}${app.package ? ' • ' : ''}${escHtml(app.version || 'v1.0')} • ${escHtml(app.size || '0 MB')} • ${app.downloadCount || 0} downloads • ⭐ ${app.rating || 'N/A'}</div>
                        </div>
                    </div>
                    <span class="app-status ${st.class}">${st.label}</span>
                    ${isLiveApp(app) && myUpdates[app.id] && myUpdates[app.id].status === 'pending' ? '<span class="app-status pend">Update in review</span>' : ''}
                    ${isLiveApp(app) && myUpdates[app.id] && myUpdates[app.id].status === 'rejected' ? `<div class="app-reject"><b>Update not approved:</b> ${escHtml(myUpdates[app.id].rejectReason || 'No reason given.')}<br><small>The old version is still live. Edit the app, fix the issue and submit the update again.</small></div>` : ''}
                    ${app.status === 'rejected' && app.rejectReason ? `<div class="app-reject"><b>Rejected:</b> ${escHtml(app.rejectReason)}<br><small>Fix the issue, then edit the app and submit it for review again.</small></div>` : ''}
                    <div class="app-actions">
                        <button onclick="viewAppDetails('${app.id}')">Details</button>
                        <button onclick="openEditModal('${app.id}')">Edit</button>
                        <button onclick="openUpdateModal('${app.id}')">Update</button>
                        <button onclick="viewAppAnalytics('${app.id}')">Analytics</button>
                        <button class="danger" onclick="deleteApp('${app.id}')">Delete</button>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        // ============================================
        // UPLOAD - Step Wizard
        // ============================================
        // Name shown on the store when the developer leaves the field empty: the profile name
        function profileDevName() {
            return (currentUser && (currentUser.displayName || (currentUser.email || '').split('@')[0])) || 'Developer';
        }

        function nextStep(step) {
            currentStep = step;
            updateSteps();
        }

        function prevStep(step) {
            currentStep = step;
            updateSteps();
        }

        function updateSteps() {
            for (let i = 1; i <= 4; i++) {
                const content = $(`step${i}`);
                const label = $(`step${i}Label`);
                if (content) {
                    content.classList.toggle('active', i === currentStep);
                }
                if (label) {
                    label.classList.remove('active', 'done');
                    if (i === currentStep) label.classList.add('active');
                    else if (i < currentStep) label.classList.add('done');
                }
            }
            if (currentStep > 1) {
                saveDraft();
            }
        }

        function saveDraft() {
            const data = {
                name: $('upName').value,
                category: $('upCategory').value,
                package: $('upPackage').value,
                shortDesc: $('upShortDesc').value,
                longDesc: $('upLongDesc').value,
                developerName: $('upDeveloperName').value,
                tags: $('upTags').value,
                supportEmail: $('upSupportEmail').value,
                privacy: $('upPrivacy').value,
                website: $('upWebsite').value,
                apkUrl: $('upApkUrl').value,
                version: $('upVersion').value,
                size: $('upSize').value,
                youtube: $('upYoutube').value,
                minAndroid: $('upMinAndroid').value,
                permissions: $('upPermissions').value,
                whatsNew: $('upWhatsNew').value,
                status: $('upStatus').value,
                step: currentStep
            };
            drafts['current'] = data;
            localStorage.setItem('stardust_drafts', JSON.stringify(drafts));
        }

        function loadDraft() {
            const data = drafts['current'];
            if (data) {
                if (data.name) $('upName').value = data.name;
                if (data.category) $('upCategory').value = data.category;
                if (data.package) $('upPackage').value = data.package;
                if (data.shortDesc) $('upShortDesc').value = data.shortDesc;
                if (data.longDesc) $('upLongDesc').value = data.longDesc;
                if (data.developerName) $('upDeveloperName').value = data.developerName;
                if (data.tags) $('upTags').value = data.tags;
                if (data.supportEmail) $('upSupportEmail').value = data.supportEmail;
                if (data.privacy) $('upPrivacy').value = data.privacy;
                if (data.website) $('upWebsite').value = data.website;
                if (data.apkUrl) $('upApkUrl').value = data.apkUrl;
                if (data.version) $('upVersion').value = data.version;
                if (data.size) $('upSize').value = data.size;
                if (data.youtube) $('upYoutube').value = data.youtube;
                if (data.minAndroid) $('upMinAndroid').value = data.minAndroid;
                if (data.permissions) { $('upPermissions').value = data.permissions; renderPermChips('up'); }
                if (data.whatsNew) $('upWhatsNew').value = data.whatsNew;
                if (data.status) $('upStatus').value = data.status;
                if (data.step) {
                    currentStep = data.step;
                    updateSteps();
                }
            }
        }

        function previewUploadImage(input, containerId) {
            const container = $(containerId);
            container.innerHTML = '';
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    if (containerId === 'bannerPreview') img.style.cssText = 'width:120px;height:60px;';
                    container.appendChild(img);
                };
                reader.readAsDataURL(input.files[0]);
            }
        }

        function previewUploadScreens_UNUSED(input) {
            const container = $('screensPreview');
            container.innerHTML = '';
            if (input.files) {
                Array.from(input.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = e => {
                        const img = document.createElement('img');
                        img.className = 'screenshot-preview';
                        img.src = e.target.result;
                        container.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
            }
        }

        // ============================================
        // SCREENSHOT MANAGER: add more any time, reorder, remove with x
        // ============================================
        const MAX_SHOTS = 10;
        function createShotManager(boxId, inputId) {
            const box = $(boxId), input = $(inputId);
            const mgr = { items: [] };
            const fkey = f => f.name + '|' + f.size + '|' + f.lastModified;
            const HOLD_MS = 350;
            let drag = null; // active long-press drag state

            function remove(i) {
                const [it] = mgr.items.splice(i, 1);
                if (it && it.file) URL.revokeObjectURL(it.src);
                render();
            }

            // ---- long press, then drag to reorder ----
            function startHold(e, el) {
                if (drag || e.target.closest('.shot-x')) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                drag = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, ghost: null };
                drag.timer = setTimeout(() => activate(), HOLD_MS);
            }
            function activate() {
                if (!drag) return;
                drag.active = true;
                const r = drag.el.getBoundingClientRect();
                drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
                const g = drag.el.cloneNode(true);
                g.classList.add('shot-ghost');
                g.style.width = r.width + 'px';
                document.body.appendChild(g);
                drag.ghost = g;
                drag.el.classList.add('dragging');
                if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) {} }
                moveGhost();
            }
            function moveGhost() {
                drag.ghost.style.left = (drag.x - drag.dx) + 'px';
                drag.ghost.style.top = (drag.y - drag.dy) + 'px';
                const under = document.elementFromPoint(drag.x, drag.y);
                const t = under && under.closest ? under.closest('.shot') : null;
                if (!t || t === drag.el || t.classList.contains('shot-add') || t.classList.contains('shot-ghost') || t.parentNode !== box) return;
                const kids = Array.from(box.children);
                if (kids.indexOf(drag.el) < kids.indexOf(t)) box.insertBefore(drag.el, t.nextSibling);
                else box.insertBefore(drag.el, t);
            }
            function onMove(e) {
                if (!drag || e.pointerId !== drag.id) return;
                drag.x = e.clientX; drag.y = e.clientY;
                if (!drag.active) {
                    if (Math.abs(drag.x - drag.x0) > 10 || Math.abs(drag.y - drag.y0) > 10) { clearTimeout(drag.timer); drag = null; } // finger is scrolling
                    return;
                }
                e.preventDefault();
                moveGhost();
            }
            function endDrag(e) {
                if (!drag || (e && e.pointerId !== drag.id)) return;
                clearTimeout(drag.timer);
                const was = drag.active;
                if (was) {
                    drag.ghost.remove();
                    const order = Array.from(box.querySelectorAll('.shot:not(.shot-add)')).map(n => n._it).filter(Boolean);
                    if (order.length === mgr.items.length) mgr.items = order;
                }
                drag = null;
                if (was) render();
            }
            box.addEventListener('touchmove', e => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
            window.addEventListener('pointermove', onMove, { passive: false });
            window.addEventListener('pointerup', endDrag);
            window.addEventListener('pointercancel', endDrag);

            function render() {
                box.innerHTML = '';
                box.classList.add('shot-grid');
                mgr.items.forEach((it, i) => {
                    const d = document.createElement('div');
                    d.className = 'shot';
                    d._it = it;
                    d.innerHTML = `<img alt="Screenshot ${i + 1}" draggable="false"><span class="shot-n">${i + 1}</span>
                        <button type="button" class="shot-x" aria-label="Remove screenshot ${i + 1}">×</button>`;
                    d.querySelector('img').src = it.src;
                    d.querySelector('.shot-x').onclick = () => remove(i);
                    d.addEventListener('pointerdown', e => startHold(e, d));
                    d.addEventListener('contextmenu', e => e.preventDefault());
                    box.appendChild(d);
                });
                if (mgr.items.length < MAX_SHOTS) {
                    const add = document.createElement('label');
                    add.className = 'shot shot-add';
                    add.htmlFor = inputId;
                    add.innerHTML = '<span>+</span><small>Add</small>';
                    box.appendChild(add);
                }
                if (mgr.items.length > 1) {
                    const hint = document.createElement('div');
                    hint.className = 'shot-hint';
                    hint.textContent = 'Long press an image, then drag it to change the order. The first one is shown first. Tap × to remove.';
                    box.appendChild(hint);
                }
            }
            input.addEventListener('change', () => {
                Array.from(input.files).forEach(f => {
                    if (mgr.items.length >= MAX_SHOTS) return;
                    if (mgr.items.some(x => x.file && fkey(x.file) === fkey(f))) return;
                    mgr.items.push({ file: f, src: URL.createObjectURL(f) });
                });
                input.value = '';
                render();
            });
            mgr.setExisting = urls => { mgr.items.forEach(it => it.file && URL.revokeObjectURL(it.src)); mgr.items = urls.map(u => ({ url: u, src: u })); render(); };
            mgr.clear = () => mgr.setExisting([]);
            mgr.resolve = () => Promise.all(mgr.items.map(it => it.url ? Promise.resolve(it.url) : uploadToImgBB(it.file)));
            render();
            return mgr;
        }
        const shotsUp = createShotManager('screensPreview', 'upScreenshots');
        const shotsEdit = createShotManager('editScreensPreview', 'editScreenshots');
        const shotsClaim = createShotManager('claimScreensPreview', 'claimScreenshots');

        function uploadToImgBB(file) {
            const asData = () => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = reject; r.readAsDataURL(file); });
            const now = Date.now(), n = IMGBB_KEYS.length, start = Math.floor(Math.random() * n);
            let order = []; for (let i = 0; i < n; i++) order.push(IMGBB_KEYS[(start + i) % n]);
            const good = order.filter(k => !imgbbBad[k] || now - imgbbBad[k] > 600000);
            order = good.length ? good : order; // every key looked bad: try them all again
            let netErrors = 0;
            const tryKey = i => {
                if (i >= order.length || netErrors >= 2) return asData(); // nothing worked: keep the image inline like before
                const key = order[i], fd = new FormData(); fd.append('image', file);
                return fetch('https://api.imgbb.com/1/upload?key=' + key, { method: 'POST', body: fd })
                    .then(res => res.json().catch(() => ({ success: false })))
                    .then(data => {
                        if (data && data.success && data.data && data.data.url) { delete imgbbBad[key]; return data.data.url; }
                        imgbbBad[key] = Date.now(); // limit reached or key rejected: use the next key
                        return tryKey(i + 1);
                    })
                    .catch(() => { netErrors++; return tryKey(i + 1); });
            };
            return tryKey(0);
        }

        // ---- App permissions picker (shown to users on the store's app page) ----
        const COMMON_PERMISSIONS = ['Internet', 'Storage', 'Camera', 'Microphone', 'Location', 'Contacts', 'Phone', 'SMS', 'Notifications', 'Bluetooth', 'Calendar', 'Vibrate', 'Run in background', 'Display over other apps', 'Install packages'];
        function parsePerms(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }
        function renderPermChips(p) {
            const box = $(p + 'PermChips'), ta = $(p + 'Permissions');
            if (!box || !ta) return;
            const cur = parsePerms(ta.value).map(x => x.toLowerCase());
            box.innerHTML = '';
            COMMON_PERMISSIONS.forEach(name => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'perm-chip' + (cur.includes(name.toLowerCase()) ? ' on' : '');
                b.textContent = name;
                b.onclick = () => {
                    let list = parsePerms(ta.value);
                    const has = list.some(x => x.toLowerCase() === name.toLowerCase());
                    list = has ? list.filter(x => x.toLowerCase() !== name.toLowerCase()) : list.concat(name);
                    ta.value = list.join(', ');
                    renderPermChips(p);
                };
                box.appendChild(b);
            });
        }
        document.addEventListener('DOMContentLoaded', () => { renderPermChips('up'); renderPermChips('edit'); });
        renderPermChips('up'); renderPermChips('edit');

        function handleUpload(e) {
            e.preventDefault();
            const btn = $('uploadBtnText');
            btn.textContent = 'Submitting...';

            const iconFile = $('upIcon').files[0];
            const bannerFile = $('upBanner').files[0];
            const screenshotFiles = $('upScreenshots').files;

            let iconUrl = 'https://img.icons8.com/color/144/android-os.png';
            let bannerUrl = '';
            let screenshotUrls = [];

            const uploadPromises = [];
            if (iconFile) uploadPromises.push(uploadToImgBB(iconFile).then(url => iconUrl = url));
            if (bannerFile) uploadPromises.push(uploadToImgBB(bannerFile).then(url => bannerUrl = url));
            // keep the exact order the developer arranged
            uploadPromises.push(shotsUp.resolve().then(urls => { screenshotUrls = urls; }));

            Promise.all(uploadPromises).then(() => {
                const packageName = $('upPackage').value.trim();
                const status = $('upStatus').value;
                const finalStatus = status === 'draft' ? 'draft' : 'pending';

                const appData = {
                    name: $('upName').value,
                    package: packageName,
                    category: $('upCategory').value,
                    version: $('upVersion').value,
                    shortDescription: $('upShortDesc').value,
                    description: $('upLongDesc').value,
                    whatsNew: $('upWhatsNew').value,
                    downloadUrl: $('upApkUrl').value,
                    size: $('upSize').value || '0 MB',
                    icon: iconUrl,
                    banner: bannerUrl,
                    screenshot: screenshotUrls.join(','),
                    tags: $('upTags').value,
                    supportEmail: $('upSupportEmail').value,
                    privacyPolicy: $('upPrivacy').value,
                    website: $('upWebsite').value,
                    youtube: $('upYoutube').value,
                    minAndroid: $('upMinAndroid').value || '5.0',
                    permissions: $('upPermissions').value.trim(),
                    developerUid: currentUser.uid,
                    developerName: ($('upDeveloperName').value || '').trim() || profileDevName(),
                    downloadCount: 0,
                    reviewCount: 0,
                    views: 0,
                    rating: 0,
                    status: finalStatus,
                    submittedAt: finalStatus === 'pending' ? Date.now() : null,
                    timestamp: Date.now(),
                    updatedDate: new Date().toISOString().split('T')[0],
                    verified: false,
                    versionHistory: [$('upVersion').value]
                };

                db.ref('apps').push(appData).then(() => {
                    btn.textContent = 'Submit for Review';
                    $('uploadForm').reset();
                    renderPermChips('up');
                    $('iconPreview').innerHTML = '';
                    $('bannerPreview').innerHTML = '';
                    shotsUp.clear();
                    currentStep = 1;
                    updateSteps();

                    delete drafts['current'];
                    localStorage.setItem('stardust_drafts', JSON.stringify(drafts));

                    addActivityLog(`App "${appData.name}" uploaded (${finalStatus})`);

                    if (finalStatus === 'draft') {
                        addNotification(`App "${appData.name}" saved as draft!`);
                        zdShow({ type: 'success', title: 'Saved as draft', body: 'Your app is saved in My Apps. Open it any time and choose Submit for review when it is ready.', ok: 'Got it' });
                    } else {
                        addNotification(`App "${appData.name}" was submitted for review. We will notify you and email you once it is approved or rejected.`);
                        zdShow({ type: 'success', title: 'Submitted for review', body: 'Our team will check your app. You will get a notification and an email with the decision.', steps: ['Submitted', 'Team reviews your app', 'Decision by notification and email', 'Goes live on UptoZishu'], ok: 'Got it' });
                    }
                    switchPage('myapps');
                }).catch(err => {
                    btn.textContent = 'Submit for Review';
                    zdAlert('Upload failed: ' + err.message);
                });
            }).catch(err => {
                btn.textContent = 'Submit for Review';
                zdAlert('Image upload failed: ' + err.message);
            });
        }

        // ============================================
        // VIEW APP DETAILS
        // ============================================
        function safeHref(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
        function viewAppDetails(appId) {
            const app = allApps.find(a => a.id === appId);
            if (!app) return;
            const live = app.status === 'live' || app.status === 'approved';
            const val = v => (v === undefined || v === null || String(v).trim() === '') ? '<span class="det-empty">Not set</span>' : escHtml(String(v));
            const n = v => Number(v || 0).toLocaleString();
            const shots = String(app.screenshot || '').split(',').map(x => x.trim()).filter(safeHref);
            const perms = String(app.permissions || '').split(',').map(x => x.trim()).filter(Boolean);
            const link = (label, url, text) => {
                const h = safeHref(url);
                return h ? `<a href="${escHtml(h)}" target="_blank" rel="noopener"><span>${label}</span><span>${escHtml(text || h)}</span></a>` : `<div><span>${label}</span><span class="det-empty">Not set</span></div>`;
            };
            const yt = String(app.youtube || '').trim();
            $('detIcon').src = app.icon || 'https://img.icons8.com/color/144/android-os.png';
            $('detTitle').textContent = app.name || 'App';
            $('detSub').textContent = [app.package, app.version].filter(Boolean).join(' · ');
            const pill = $('detStatus'); const stl = { pending: ['In review', 'pend'], rejected: ['Rejected', 'rej'], suspended: ['Suspended', 'susp'] }[app.status]; pill.textContent = stl ? stl[0] : (live ? 'Live' : 'Draft'); pill.className = 'pill ' + (stl ? stl[1] : (live ? 'live' : 'draft'));
            $('detBody').innerHTML = `
                <div class="det-stats">
                    <div class="det-stat"><b>${n(app.downloadCount)}</b><span>Downloads</span></div>
                    <div class="det-stat"><b>${n(app.views)}</b><span>Views</span></div>
                    <div class="det-stat"><b>${app.rating ? Number(app.rating).toFixed(1) : '–'}</b><span>Rating</span></div>
                    <div class="det-stat"><b>${n(app.reviewCount)}</b><span>Reviews</span></div>
                </div>
                <div class="det-card"><h5>App info</h5><dl class="det-grid">
                    <div><dt>Category</dt><dd>${val(app.category)}</dd></div>
                    <div><dt>Version</dt><dd>${val(app.version)}</dd></div>
                    <div><dt>File size</dt><dd>${val(app.size)}</dd></div>
                    <div><dt>Minimum Android</dt><dd>${val(app.minAndroid)}</dd></div>
                    <div><dt>Developer</dt><dd>${val(app.developerName)}</dd></div>
                    <div><dt>Last updated</dt><dd>${val(app.updatedDate || app.uploadDate)}</dd></div>
                    <div><dt>Package name</dt><dd>${val(app.package)}</dd></div>
                    <div><dt>Tags</dt><dd>${val(app.tags)}</dd></div>
                </dl></div>
                <div class="det-card"><h5>Short description</h5><p class="det-text">${val(app.shortDescription)}</p></div>
                <div class="det-card"><h5>Long description</h5><p class="det-text">${val(app.description)}</p></div>
                <div class="det-card"><h5>What's new</h5><p class="det-text">${val(app.whatsNew)}</p></div>
                ${shots.length ? `<div class="det-card"><h5>Screenshots (${shots.length})</h5><div class="det-shots">${shots.map(u => `<img src="${escHtml(u)}" alt="Screenshot" loading="lazy">`).join('')}</div></div>` : ''}
                <div class="det-card"><h5>Permissions</h5>${perms.length ? `<div class="det-chips">${perms.map(x => `<span>${escHtml(x)}</span>`).join('')}</div>` : '<span class="det-empty">None listed</span>'}</div>
                <div class="det-card det-links"><h5>Links</h5>
                    ${link('Download (APK)', app.downloadUrl)}
                    ${link('Website', app.website)}
                    ${link('Privacy policy', app.privacyPolicy)}
                    ${app.supportEmail ? `<a href="mailto:${escHtml(app.supportEmail)}"><span>Support email</span><span>${escHtml(app.supportEmail)}</span></a>` : '<div><span>Support email</span><span class="det-empty">Not set</span></div>'}
                    ${yt ? `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(yt)}" target="_blank" rel="noopener"><span>YouTube video</span><span>${escHtml(yt)}</span></a>` : '<div><span>YouTube video</span><span class="det-empty">Not set</span></div>'}
                </div>`;
            $('detEdit').onclick = () => { closeDetailsModal(); openEditModal(appId); };
            $('detUpdate').onclick = () => { closeDetailsModal(); openEditModal(appId, 'update'); };
            $('detAnalytics').onclick = () => viewAppAnalytics(appId);
            $('detBody').scrollTop = 0;
            $('detailsModal').classList.add('open');
        }
        function closeDetailsModal() { $('detailsModal').classList.remove('open'); }

        // ============================================
        // EDIT APP - Full, only file uploads (no URL fields for images)
        // ============================================
        // updates to live apps wait for admin approval in appUpdates/<uid>/<appId>
        let myUpdates = {};
        const isLiveApp = a => !!a && !['draft', 'pending', 'rejected', 'suspended'].includes(a.status);
        function watchMyUpdates() {
            if (!currentUser) return;
            db.ref('appUpdates/' + currentUser.uid).on('value', s => { myUpdates = s.val() || {}; if (typeof currentPage !== 'undefined' && currentPage === 'myapps') renderMyApps(); }, () => { myUpdates = {}; });
        }
        function openEditModal(appId, mode) {
            const app = allApps.find(a => a.id === appId);
            if (!app) return;
            const isUpdate = mode === 'update';
            const liveApp = isLiveApp(app), pu = liveApp ? myUpdates[appId] : null, src = pu ? Object.assign({}, app, pu) : app;
            editAppId = appId;
            $('editAppId').value = appId;
            $('editName').value = src.name || '';
            $('editCategory').value = src.category || 'Games';
            $('editPackage').value = src.package || '';
            $('editVersion').value = src.version || '';
            $('editShortDesc').value = src.shortDescription || '';
            $('editDeveloperName').value = src.developerName || '';
            $('editLongDesc').value = src.description || '';
            $('editApkUrl').value = src.downloadUrl || '';
            $('editSize').value = src.size || '';
            $('editTags').value = src.tags || '';
            $('editSupportEmail').value = src.supportEmail || '';
            $('editPrivacy').value = src.privacyPolicy || '';
            $('editWebsite').value = src.website || '';
            $('editYoutube').value = src.youtube || '';
            $('editMinAndroid').value = src.minAndroid || '';
            $('editPermissions').value = src.permissions || '';
            renderPermChips('edit');
            $('editWhatsNew').value = src.whatsNew || '';
            buildStatusOptions(app);
            // Clear previews
            $('editIconPreview').innerHTML = '';
            $('editBannerPreview').innerHTML = '';
            // Show current icon as preview if available
            if (src.icon) {
                const img = document.createElement('img');
                img.src = src.icon;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.borderRadius = '8px';
                img.style.objectFit = 'cover';
                $('editIconPreview').appendChild(img);
            }
            if (src.banner) {
                const img = document.createElement('img');
                img.src = src.banner;
                img.style.width = '120px';
                img.style.height = '60px';
                img.style.borderRadius = '8px';
                img.style.objectFit = 'cover';
                $('editBannerPreview').appendChild(img);
            }
            shotsEdit.setExisting(String(src.screenshot || '').split(',').map(s => s.trim()).filter(Boolean));
            // two modes share this form: plain edit, or publishing a new version
            const modal = $('editModal');
            modal.classList.toggle('mode-update', isUpdate);
            modal.dataset.mode = isUpdate ? 'update' : 'edit';
            $('editHeadIcon').src = app.icon || 'https://img.icons8.com/color/144/android-os.png';
            $('editTitle').textContent = isUpdate ? 'Update app' : 'Edit app';
            $('editSub').textContent = (app.name || 'App') + (app.version ? ' · current ' + app.version : '');
            $('editSaveBtn').textContent = liveApp ? 'Submit for review' : (isUpdate ? 'Publish update' : 'Save changes');
            $('relTitle').textContent = isUpdate ? 'New release' : 'Version & download';
            $('relSub').textContent = isUpdate ? 'Fill these first: the new version, its download link and what changed.' : 'The file people download and what changed.';
            $('editModeNote').textContent = liveApp ? ((pu && pu.status === 'pending' ? 'Your previous update is still waiting for review. Submitting again replaces it. ' : pu && pu.status === 'rejected' ? 'Your last update was not approved' + (pu.rejectReason ? ': ' + pu.rejectReason : '') + '. Your changes are kept here, fix them and submit again. ' : '') + 'Changes to a live app are checked by our team first. The current version stays on the store until the update is approved.') : 'Publishing an update makes this version live right away. The old version number is kept in your version history. You can also change anything else below, such as the description or screenshots.';
            if (isUpdate) {
                $('editVersion').value = pu && pu.version ? pu.version : '';
                $('editVersion').placeholder = app.version ? 'Current ' + app.version + ', enter the new one' : 'v1.0.1';
                $('editWhatsNew').value = pu && pu.whatsNew ? pu.whatsNew : '';
            }
            // number the sections in the order they appear (the release section moves to the top in update mode)
            const order = (isUpdate ? ['secRelease', 'secBasic'] : ['secBasic', 'secRelease']).concat(['secImages', 'secMore', 'secPerm']).concat(isUpdate ? [] : ['secStatus']);
            order.forEach((id, i) => { const n = $(id).querySelector('.fsec-n'); if (n) n.textContent = i + 1; });
            $('editSaveBtn').disabled = false;
            modal.classList.add('open');
            const body = modal.querySelector('.sheet-body'); if (body) body.scrollTop = 0;
        }

        function closeEditModal() {
            $('editModal').classList.remove('open');
        }

        function previewEditIcon(input) {
            const container = $('editIconPreview');
            container.innerHTML = '';
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '60px';
                    img.style.height = '60px';
                    img.style.borderRadius = '8px';
                    img.style.objectFit = 'cover';
                    container.appendChild(img);
                };
                reader.readAsDataURL(input.files[0]);
            }
        }

        function previewEditBanner(input) {
            const container = $('editBannerPreview');
            container.innerHTML = '';
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '120px';
                    img.style.height = '60px';
                    img.style.borderRadius = '8px';
                    img.style.objectFit = 'cover';
                    container.appendChild(img);
                };
                reader.readAsDataURL(input.files[0]);
            }
        }

        function previewEditScreens_UNUSED(input) {
            const container = $('editScreensPreview');
            container.innerHTML = '';
            if (input.files) {
                Array.from(input.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = e => {
                        const img = document.createElement('img');
                        img.className = 'screenshot-preview';
                        img.src = e.target.result;
                        container.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
            }
        }

        async function saveFullEdit(e) {
            e.preventDefault();
            const id = $('editAppId').value;
            const isUpdate = $('editModal').dataset.mode === 'update';
            const app = allApps.find(a => a.id === id);
            if (!app) return;
            const need = (field, msg) => { const el = $(field); if (!String(el.value || '').trim()) { zdAlert(msg); el.focus(); return true; } return false; };
            if (need('editName', 'Please enter the app name.')) return;
            if (need('editShortDesc', 'Please enter a short description.')) return;
            if (need('editLongDesc', 'Please enter the long description.')) return;
            if (isUpdate) {
                if (need('editVersion', 'Please enter the new version.')) return;
                if (need('editApkUrl', 'Please enter the download link of the new APK.')) return;
                if (need('editWhatsNew', "Please write what's new in this version.")) return;
                const v = $('editVersion').value.trim();
                if (v === String(app.version || '').trim() && !(await zdConfirm('The version number is the same as the live one.', { title: 'Same version number', ok: 'Continue anyway', type: 'warn' }))) return;
                if ($('editApkUrl').value.trim() === String(app.downloadUrl || '').trim() && !(await zdConfirm('The download link is the same as before.', { title: 'Same download link', ok: 'Continue anyway', type: 'warn' }))) return;
            }
            const btn = $('editSaveBtn'), label = btn.textContent;
            btn.disabled = true; btn.textContent = isUpdate ? 'Publishing…' : 'Saving…';
            const iconFile = $('editIconFile').files[0];
            const bannerFile = $('editBannerFile').files[0];

            let iconUrl = null;
            let bannerUrl = null;
            let screenshotUrls = [];

            const uploadPromises = [];
            if (iconFile) uploadPromises.push(uploadToImgBB(iconFile).then(url => iconUrl = url));
            if (bannerFile) uploadPromises.push(uploadToImgBB(bannerFile).then(url => bannerUrl = url));
            uploadPromises.push(shotsEdit.resolve().then(urls => { screenshotUrls = urls; }));

            Promise.all(uploadPromises).then(() => {
                const updates = {
                    name: $('editName').value.trim(),
                    category: $('editCategory').value,
                    package: $('editPackage').value.trim(),
                    version: $('editVersion').value.trim(),
                    shortDescription: $('editShortDesc').value.trim(),
                    developerName: ($('editDeveloperName').value || '').trim() || profileDevName(),
                    description: $('editLongDesc').value,
                    downloadUrl: $('editApkUrl').value.trim(),
                    size: $('editSize').value.trim(),
                    tags: $('editTags').value.trim(),
                    supportEmail: $('editSupportEmail').value.trim(),
                    privacyPolicy: $('editPrivacy').value.trim(),
                    website: $('editWebsite').value.trim(),
                    youtube: $('editYoutube').value.trim(),
                    minAndroid: $('editMinAndroid').value.trim(),
                    permissions: $('editPermissions').value.trim(),
                    whatsNew: $('editWhatsNew').value,
                    status: isUpdate ? (app.status === 'approved' ? 'live' : app.status) : $('editStatus').value,
                    updatedDate: new Date().toISOString().split('T')[0]
                };
                // Only update images if new files were uploaded
                if (iconUrl) updates.icon = iconUrl;
                if (bannerUrl) updates.banner = bannerUrl;
                updates.screenshot = screenshotUrls.join(','); // full ordered list (removed screenshots are gone, new ones are added)
                const submitting = !isUpdate && updates.status === 'pending' && app.status !== 'pending';
                if (submitting) { updates.submittedAt = Date.now(); updates.rejectReason = null; }
                const wasLive = app.status === 'live' || app.status === 'approved';
                if (isUpdate) {
                    const history = Array.isArray(app.versionHistory) ? app.versionHistory.slice() : [];
                    if (app.version && app.version !== updates.version) history.push(app.version);
                    updates.versionHistory = history;
                }

                const toDraft = $('editStatus').value === 'draft' && !isUpdate;
                if (isLiveApp(app) && !toDraft) {
                    // live app: nothing changes on the store until an admin approves
                    const pu = myUpdates[id] || {};
                    const upd = Object.assign({}, updates); delete upd.status; delete upd.updatedDate;
                    upd.icon = iconUrl || pu.icon || null; upd.banner = bannerUrl || pu.banner || null;
                    Object.keys(upd).forEach(k => { if (upd[k] === null || upd[k] === undefined) delete upd[k]; });
                    upd.status = 'pending'; upd.submittedAt = Date.now(); upd.developerUid = currentUser.uid; upd.appName = String(app.name || updates.name).slice(0, 100);
                    return db.ref(`appUpdates/${currentUser.uid}/${id}`).set(upd).then(() => {
                        addActivityLog(`Update for "${updates.name}" (${updates.version}) submitted for review`);
                        addNotification(`Your update for "${updates.name}" was submitted for review. The current version stays live until it is approved.`);
                        closeEditModal(); renderMyApps();
                        zdShow({ type: 'success', title: 'Update sent for review', body: 'The version on the store does not change until our team approves your update.', steps: ['Submitted', 'Team reviews your update', 'Decision by notification and email', 'New version replaces the old one'], ok: 'Got it' });
                    });
                }
                return db.ref(`apps/${id}`).update(updates).then(() => {
                    if (isUpdate) {
                        addActivityLog(`Update for "${updates.name}" to ${updates.version} published`);
                        addNotification(`Update for "${updates.name}" is now LIVE!`);
                    } else if (submitting) {
                        addActivityLog(`App "${updates.name}" submitted for review`);
                        addNotification(`App "${updates.name}" was submitted for review. We will notify you and email you once it is approved or rejected.`);
                    } else {
                        addActivityLog(`App "${updates.name}" fully edited`);
                        addNotification(`App "${updates.name}" updated successfully!`);
                    }
                    closeEditModal();
                    renderMyApps();
                    zdAlert(submitting ? 'Your app was submitted for review.\n\nYou will get a notification and an email with the decision.' : isUpdate ? (wasLive ? 'Update published successfully!' : 'Update saved. It goes live after your app is approved.') : 'App updated successfully!');
                });
            }).catch(err => {
                zdAlert((isUpdate ? 'Could not publish the update: ' : 'Could not save: ') + err.message);
            }).then(() => { btn.disabled = false; btn.textContent = label; });
        }

        // ============================================
        // UPDATE APP
        // ============================================
        function openUpdateModal(appId) { openEditModal(appId, 'update'); }

        // ============================================
        // DELETE APP
        // ============================================
        async function deleteApp(appId) {
            if (!(await zdConfirm('This removes the app and all its data from UptoZishu. This cannot be undone.', { title: 'Delete this app?', ok: 'Delete app', danger: true }))) return;
            const app = allApps.find(a => a.id === appId);
            db.ref(`apps/${appId}`).remove().then(() => {
                if (app) addActivityLog(`App "${app.name}" deleted`);
                addNotification('App deleted.');
                renderMyApps();
            });
        }

        // ============================================
        // ANALYTICS
        // ============================================
        function populateAnalyticsSelect() {
            const select = $('anaAppSelect');
            const keep = select.value;
            select.innerHTML = '<option value="">Select App</option>';
            allApps.forEach(app => {
                select.innerHTML += `<option value="${app.id}">${escHtml(app.name)}</option>`;
            });
            if (keep) select.value = keep;
            const pre = new URLSearchParams(location.search).get('app');
            if (pre && !populateAnalyticsSelect.done && allApps.some(a => a.id === pre)) {
                populateAnalyticsSelect.done = true;
                select.value = pre;
                loadAppAnalytics();
            }
        }

        function viewAppAnalytics(appId) {
            location.href = '/analytics/?app=' + encodeURIComponent(appId);
        }

        let anaDays = 7;
        function setAnaPeriod(n) { anaDays = n; loadAppAnalytics(); }


        // all reviews of the selected app, live, with reply + hide (same controls as the Reviews page)
        let anaRevRef = null;
        function loadAnaReviews(appId) {
            if (anaRevRef) anaRevRef.off();
            anaRevRef = db.ref('reviews/' + appId);
            anaRevRef.on('value', snap => {
                allReviews[appId] = snap.val() || {};
                if (currentPage === 'analytics' && $('anaAppSelect').value === appId) renderAnaReviews(appId);
            });
        }
        function renderAnaReviews(appId) {
            const box = $('anaReviews');
            if (!box || !appId) return;
            const app = allApps.find(a => a.id === appId);
            const bucket = allReviews[appId] || {};
            const list = Object.keys(bucket).filter(k => bucket[k] && typeof bucket[k] === 'object').map(k => ({ ...bucket[k], id: k, appId }));
            box.innerHTML = '';
            if (!list.length) { box.innerHTML = '<div class="chart-note">No reviews on this app yet.</div>'; return; }
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(rev => box.appendChild(reviewItem(rev, app && app.name, false)));
        }

        function loadAppAnalytics() {
            const appId = $('anaAppSelect').value;
            const container = $('analyticsContainer');
            if (!appId) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                        <h3>Select an App</h3>
                        <p>Choose an app from the dropdown to see analytics.</p>
                    </div>
                `;
                return;
            }
            const app = allApps.find(a => a.id === appId);
            if (!app) return;

            const days = lastDays(anaDays);
            const vals = days.map(d => dayCount([appId], d.key));
            const total = vals.reduce((s, v) => s + v, 0);
            const best = Math.max(0, ...vals);
            const bestDay = best ? days[vals.indexOf(best)].dm : '-';
            const today = vals[vals.length - 1];

            container.innerHTML = `
                <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:20px;">
                    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
                        <img src="${escHtml(app.icon || 'https://img.icons8.com/color/144/android-os.png')}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid var(--border-color);">
                        <div style="min-width:0">
                            <div style="font-size:18px;font-weight:600;overflow-wrap:anywhere">${escHtml(app.name)}</div>
                            <div style="color:var(--text-gray);">${escHtml(app.version || 'v1.0')} • ${escHtml(app.category || 'General')}</div>
                        </div>
                    </div>
                    <div class="stats-grid" style="margin-bottom:16px;">
                        <div class="stat-card"><div class="stat-value">${app.downloadCount || 0}</div><div class="stat-label">Downloads</div></div>
                        <div class="stat-card"><div class="stat-value">${app.views || 0}</div><div class="stat-label">Views</div></div>
                        <div class="stat-card"><div class="stat-value">${app.rating || 'N/A'}</div><div class="stat-label">Rating</div></div>
                        <div class="stat-card"><div class="stat-value">${app.reviewCount || 0}</div><div class="stat-label">Reviews</div></div>
                    </div>
                    <h4 style="margin-bottom:8px;">Downloads per day</h4>
                    <div class="period-tabs">
                        ${[7, 30, 90].map(n => `<button class="${n === anaDays ? 'active' : ''}" onclick="setAnaPeriod(${n})">${n} days</button>`).join('')}
                    </div>
                    ${barChart(days, vals, anaDays)}
                    <div class="ana-sum">
                        <div><b>${total}</b><span>Last ${anaDays} days</span></div>
                        <div><b>${today}</b><span>Today</span></div>
                        <div><b>${best}</b><span>Best day${best ? ' (' + bestDay + ')' : ''}</span></div>
                    </div>
                    ${total === 0 ? '<div class="chart-note">No downloads recorded in this period yet. Daily tracking starts from the first download after the update.</div>' : ''}
                    <h4 style="margin:20px 0 6px;">Rating breakdown</h4>
                    <div id="anaRatings" class="chart-note">Loading…</div>
                </div>
                <div class="ana-reviews">
                    <h4 style="margin:22px 0 10px;">Reviews</h4>
                    <div id="anaReviews"></div>
                </div>
            `;
            loadAnaReviews(appId);

            db.ref('reviews/' + appId).once('value').then(snap => {
                const box = $('anaRatings');
                const rv = Object.values(snap.val() || {});
                if (!rv.length) { box.textContent = 'No reviews yet.'; return; }
                const cnt = [0, 0, 0, 0, 0, 0];
                rv.forEach(r => { const s = Math.min(5, Math.max(1, Math.round(r.rating || 5))); cnt[s]++; });
                const avg = (rv.reduce((s, r) => s + (Number(r.rating) || 5), 0) / rv.length).toFixed(1);
                box.className = '';
                box.innerHTML = `<div style="font-size:13px;margin-bottom:6px;"><b>${avg}</b> ★ from ${rv.length} review${rv.length === 1 ? '' : 's'}</div>` +
                    [5, 4, 3, 2, 1].map(s => `<div class="rate-row"><span style="width:24px">${s} ★</span><div class="track"><div class="fill" style="width:${Math.round(cnt[s] / rv.length * 100)}%"></div></div><span style="width:22px;text-align:right">${cnt[s]}</span></div>`).join('');
            }).catch(() => { $('anaRatings').textContent = 'Could not load reviews.'; });
        }

        // ============================================
        // REVIEWS
        // ============================================
        function populateReviewSelect() {
            const select = $('reviewAppSelect');
            const keep = select.value;
            select.innerHTML = '<option value="">All apps</option>';
            allApps.forEach(app => {
                select.innerHTML += `<option value="${escHtml(app.id)}">${escHtml(app.name)}</option>`;
            });
            if (keep) select.value = keep;
            const pre = new URLSearchParams(location.search).get('app');
            if (pre && !keep && allApps.some(a => a.id === pre)) select.value = pre;
        }

        // Reviews are stored as reviews/<appId>/<reviewId>; listen once to all of them and show the developer's apps only
        function loadReviews() {
            db.ref('reviews').off('value');
            db.ref('reviews').on('value', snapshot => {
                allReviews = snapshot.val() || {};
                if (currentPage === 'reviews') renderReviews();
                if (currentPage === 'hiddenreviews') renderHiddenReviews();
            }, err => {
                $('reviewsList').innerHTML = '<div class="empty-state"><h3>Could not load reviews</h3><p>' + escHtml(err && err.message || '') + '</p></div>';
            });
        }

        function renderReviews() {
            const container = $('reviewsList');
            container.innerHTML = '';

            const names = {};
            allApps.forEach(a => { names[a.id] = a.name; });
            const selected = $('reviewAppSelect').value;
            let allRev = [];
            Object.keys(names).forEach(appId => {
                if (selected && selected !== appId) return;
                const bucket = allReviews[appId] || {};
                Object.keys(bucket).forEach(revId => allRev.push({ ...bucket[revId], id: revId, appId }));
            });

            // red badge = reviews without a reply, across all apps
            let unreplied = 0;
            Object.keys(names).forEach(appId => Object.values(allReviews[appId] || {}).forEach(r => { if (!r.reply) unreplied++; }));
            setBadge($('reviewBadge'), unreplied);
            const hc = $('hiddenCount'); if (hc) { let n = 0; Object.keys(names).forEach(appId => Object.values(allReviews[appId] || {}).forEach(r => { if (r && r.hidden) n++; })); hc.textContent = n; }

            if (currentReviewFilter !== 'all') {
                const star = parseInt(currentReviewFilter);
                allRev = allRev.filter(r => Math.round(r.rating || 5) === star);
            }

            if (allRev.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        <h3>No Reviews</h3>
                        <p>${selected ? "This app doesn't have any reviews yet." : 'No reviews on your apps yet.'}</p>
                    </div>
                `;
                return;
            }

            allRev.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(rev => {
                container.appendChild(reviewItem(rev, names[rev.appId], !selected));
            });
            focusReviewFromUrl();
        }

        // one review card with reply + hide controls (used by the Reviews page and by Analytics)
        function reviewItem(rev, appName, showApp) {
                let stars = '';
                for (let i = 0; i < 5; i++) stars += i < Math.round(rev.rating || 5) ? '★' : '☆';
                const when = rev.timestamp ? new Date(rev.timestamp).toLocaleDateString() : '';
                const div = document.createElement('div');
                div.className = 'review-item';
                div.innerHTML = `
                    ${showApp ? `<div class="rev-app">${escHtml(appName || '')}</div>` : ''}
                    <div class="rev-head">
                        <span class="rev-user">${escHtml(rev.author || 'Anonymous')}${when ? ` <small style="color:var(--text-gray);font-weight:400">• ${escHtml(when)}</small>` : ''}</span>
                        <span class="rev-stars">${stars}</span>
                    </div>
                    <div class="rev-text">${escHtml(rev.text || '')}</div>
                    ${rev.reply ? `<div class="dev-reply"><strong>Developer Reply:</strong> ${escHtml(rev.reply)}</div>` : ''}
                    <div class="rev-reply">
                        <input type="text" placeholder="${rev.reply ? 'Edit your reply...' : 'Reply to this review...'}" id="replyInput_${escHtml(rev.id)}" />
                        <button onclick="submitReply('${escHtml(rev.appId)}','${escHtml(rev.id)}')">Reply</button>
                    </div>
                                  <div class="rev-tools">
                        <button type="button" class="rev-hide${rev.hidden ? ' is-hidden' : ''}" onclick="toggleHideReview('${escHtml(rev.appId)}','${escHtml(rev.id)}',${rev.hidden ? 'false' : 'true'})">
                            <svg viewBox="0 0 24 24" aria-hidden="true">${rev.hidden ? '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>' : '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>'}</svg>
                            ${rev.hidden ? 'Unhide' : 'Hide from store'}
                        </button>
                        ${rev.hidden ? '<span class="rev-hidden-note">Hidden: people on the store cannot see this review</span>' : ''}
                    </div>
                `;
                if (rev.hidden) div.classList.add('hidden-rev');
                div.id = 'rev_' + rev.id;
                return div;
        }

        // coming from a review notification: open that app's reviews and highlight the review
        let focusDone = false;
        function focusReviewFromUrl() {
            if (focusDone) return;
            const id = new URLSearchParams(location.search).get('review');
            if (!id) { focusDone = true; return; }
            const el = document.getElementById('rev_' + id);
            if (!el) return;
            focusDone = true;
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.classList.add('rev-focus');
            setTimeout(() => el.classList.remove('rev-focus'), 3500);
        }


        // screen with all hidden reviews, where the developer can unhide them
        function renderHiddenReviews() {
            const container = $('reviewsList');
            if (!container) return;
            container.innerHTML = '';
            const names = {};
            allApps.forEach(a => { names[a.id] = a.name; });
            const selected = $('reviewAppSelect').value;
            const list = [];
            Object.keys(names).forEach(appId => {
                if (selected && selected !== appId) return;
                const bucket = allReviews[appId] || {};
                Object.keys(bucket).forEach(k => { const r = bucket[k]; if (r && typeof r === 'object' && r.hidden) list.push({ ...r, id: k, appId }); });
            });
            let unreplied = 0;
            Object.keys(names).forEach(appId => Object.values(allReviews[appId] || {}).forEach(r => { if (!r.reply) unreplied++; }));
            setBadge($('reviewBadge'), unreplied);
            if (!list.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27z"/></svg>
                        <h3>No hidden reviews</h3>
                        <p>Reviews you hide will show up here.</p>
                    </div>`;
                return;
            }
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(rev => container.appendChild(reviewItem(rev, names[rev.appId], !selected)));
        }

        function filterReviews(star) {
            currentReviewFilter = star;
            document.querySelectorAll('.review-filter button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.star == star);
            });
            renderReviews();
        }


        function rerenderReviews() { if (currentPage === 'analytics') renderAnaReviews($('anaAppSelect').value); else if (currentPage === 'hiddenreviews') renderHiddenReviews(); else renderReviews(); }

        // hide / unhide a review: hidden reviews are removed from the store page and from the rating
        async function toggleHideReview(appId, revId, hide) {
            if (hide && !(await zdConfirm('It will disappear from the store and will not count in the rating. You can unhide it any time.', { title: 'Hide this review?', ok: 'Hide review', type: 'warn' }))) return;
            const ref = db.ref(`reviews/${appId}/${revId}/hidden`);
            (hide ? ref.set(true) : ref.remove()).then(() => {
                if (allReviews[appId] && allReviews[appId][revId]) { if (hide) allReviews[appId][revId].hidden = true; else delete allReviews[appId][revId].hidden; }
                rerenderReviews();
                // keep the app's rating and review count in step with what the store shows
                let sum = 0, n = 0;
                Object.values(allReviews[appId] || {}).forEach(r => { if (r && r.text && !r.hidden) { sum += Math.min(5, Math.max(1, Math.round(+r.rating || 5))); n++; } });
                db.ref('apps/' + appId).update({ rating: n ? Math.round((sum / n) * 10) / 10 : 0, reviewCount: n }).catch(() => {});
                if (hide) zdShow({ type: 'success', title: 'Review hidden', body: 'It will disappear from the store in a few minutes. You can unhide it from the Hidden reviews screen.', ok: 'Got it' }); else zdToast('Review is visible again');
            }).catch(() => zdAlert('Could not update the review. Please publish the latest Firebase rules and try again.'));
        }

        function submitReply(appId, revId) {
            const input = $(`replyInput_${revId}`);
            if (!input || !input.value.trim()) return;
            const replyText = input.value.trim();

            db.ref(`reviews/${appId}/${revId}/reply`).set(replyText).then(() => {
                input.value = '';
                addNotification('Reply sent successfully!');
            });
        }

        // ============================================
        // NOTIFICATIONS
        // ============================================
        function loadNotifications() {
            if (!currentUser) return;
            db.ref(`notifications/${currentUser.uid}`).on('value', snapshot => {
                const data = snapshot.val();
                allNotifications = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) : [];
                const np = notifPrefs();
                allNotifications = allNotifications.filter(n => !(n.type && np[n.type] === false));
                setBadge($('notifBadge'), allNotifications.filter(n => !n.read).length);
                if (currentPage === 'notifications') renderNotifications();
            });
        }

        function addNotification(text) {
            if (!currentUser) return;
            db.ref(`notifications/${currentUser.uid}`).push({
                text: text,
                timestamp: Date.now(),
                read: false
            });
        }

        function renderNotifications() {
            const container = $('notificationsList');
            container.innerHTML = '';
            const clearBtn = $('notifClearAll'), tip = $('notifTip');
            if (clearBtn) clearBtn.style.display = allNotifications.length ? '' : 'none';
            if (tip) tip.style.display = allNotifications.length ? '' : 'none';
            if (allNotifications.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                        <h3>No Notifications</h3>
                        <p>You're all caught up!</p>
                    </div>
                `;
                return;
            }
            allNotifications.forEach(n => {
                const div = document.createElement('div');
                const isRev = n.type === 'review' && n.appId, isTk = n.type === 'ticket' && n.ticketId, isAr = (n.type === 'appreview' || n.type === 'profile');
                div.className = 'notif-item' + (isRev || isTk || isAr ? ' notif-link' : '') + (n.read ? '' : ' unread');
                const stars = isRev && n.rating ? '★'.repeat(Math.round(n.rating)) + '☆'.repeat(5 - Math.round(n.rating)) : '';
                const sub = isRev ? `<div class="notif-sub">${stars ? `<span class="notif-stars">${stars}</span> ` : ''}${n.snippet ? escHtml(n.snippet) : ''}<span class="notif-go">View review ›</span></div>` : isTk ? `<div class="notif-sub">${n.snippet ? escHtml(n.snippet) : ''}<span class="notif-go">Open ticket ›</span></div>` : isAr ? `<div class="notif-sub">${n.reason ? 'Reason: ' + escHtml(n.reason) : ''}<span class="notif-go">Open ›</span></div>` : '';
                div.innerHTML = `
                    <div class="notif-icon">
                        ${isTk ? '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' : isRev ? '<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>'}
                    </div>
                    <div class="notif-main"><div class="notif-text">${escHtml(n.text)}</div>${sub}</div>
                    <div class="notif-time">${new Date(n.timestamp).toLocaleDateString()}</div>
                `;
                attachNotifPress(div, n);
                container.appendChild(div);
            });
            // mark the unread ones as read (only existing ones, so a deleted notification never comes back)
            allNotifications.filter(n => !n.read).forEach(n => {
                db.ref(`notifications/${currentUser.uid}/${n.id}`).once('value').then(snap => {
                    if (snap.val()) db.ref(`notifications/${currentUser.uid}/${n.id}/read`).set(true);
                });
            });
            setBadge($('notifBadge'), 0);
        }

        // long press (or right click) on a notification -> small menu to delete just that one
        function attachNotifPress(el, n) {
            let timer = 0, sx = 0, sy = 0, longAt = 0;
            const cancel = () => { clearTimeout(timer); el.classList.remove('pressing'); };
            el.addEventListener('pointerdown', e => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                sx = e.clientX; sy = e.clientY;
                el.classList.add('pressing');
                timer = setTimeout(() => { longAt = Date.now(); el.classList.remove('pressing'); if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {} openNotifMenu(n); }, 450);
            });
            el.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel(); });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, cancel));
            el.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); longAt = Date.now(); openNotifMenu(n); });
            if (n.type === 'appreview' || n.type === 'profile') {
                el.addEventListener('click', () => { if (Date.now() - longAt < 800) return; location.href = n.type === 'profile' ? '/profile/' : '/apps/'; });
            }
            if (n.type === 'ticket' && n.ticketId) {
                el.addEventListener('click', () => {
                    if (Date.now() - longAt < 800) return;
                    location.href = '/support/ticket/?id=' + encodeURIComponent(n.ticketId);
                });
            }
            // tap a review notification -> open that review
            if (n.type === 'review' && n.appId) {
                el.addEventListener('click', () => {
                    if (Date.now() - longAt < 800) return; // this was a long press, not a tap
                    location.href = '/reviews/?app=' + encodeURIComponent(n.appId) + (n.revId ? '&review=' + encodeURIComponent(n.revId) : '');
                });
            }
        }
        function closeNotifMenu() { const m = document.getElementById('notifMenu'); if (m) m.remove(); }
        function openNotifMenu(n) {
            closeNotifMenu();
            const m = document.createElement('div');
            m.id = 'notifMenu'; m.className = 'nmenu-overlay';
            m.innerHTML = `<div class="nmenu" role="dialog" aria-modal="true" aria-label="Notification options">
                <p class="nmenu-text">${escHtml(n.text)}</p>
                <button type="button" class="nmenu-del" data-a="del">Delete this notification</button>
                <button type="button" class="nmenu-cancel" data-a="x">Cancel</button>
            </div>`;
            m.addEventListener('click', e => {
                const a = e.target.closest('[data-a]');
                if (e.target === m || (a && a.dataset.a === 'x')) { closeNotifMenu(); return; }
                if (a && a.dataset.a === 'del') {
                    closeNotifMenu();
                    db.ref(`notifications/${currentUser.uid}/${n.id}`).remove().catch(() => zdAlert('Could not delete the notification. Please try again.'));
                }
            });
            document.body.appendChild(m);
        }
        async function clearAllNotifications() {
            if (!allNotifications.length) return;
            if (!(await zdConfirm('All your notifications are removed for good. This cannot be undone.', { title: 'Delete all notifications?', ok: 'Delete all', danger: true }))) return;
            db.ref(`notifications/${currentUser.uid}`).remove().catch(() => zdAlert('Could not clear notifications. Please try again.'));
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNotifMenu(); });


        // ============================================
        // CLAIM AN APP (developer) + CLAIM REQUESTS (store admin)
        // The admin is whoever has admins/<uid> = true in Firebase (set by hand in the Firebase console).
        // ============================================
        let storeApps = [], myClaims = {}, claimApp = null, claimLimit = 20;
        const claimKey = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_');
        const claimWhen = t => t ? new Date(+t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const hostOf = u => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };
        const baseDomain = h => h.split('.').slice(-2).join('.');

        // ---------- developer side ----------
        function initClaimPage() {
            db.ref('apps').once('value').then(snap => {
                storeApps = Object.entries(snap.val() || {}).map(([id, a]) => ({ id, ...a })).filter(a => a.developerUid !== currentUser.uid && a.status !== 'draft').sort((a, b) => appCreated(b) - appCreated(a));
                const pre = new URLSearchParams(location.search).get('app');
                if (pre) { const a = storeApps.find(x => x.id === pre); if (a) { $('claimSearch').value = a.name || ''; } }
                renderClaimResults();
                if (pre && storeApps.some(x => x.id === pre) && !myClaims[pre]) openClaimModal(pre);
            });
            $('claimSearch').addEventListener('input', () => { claimLimit = 20; renderClaimResults(); });
            db.ref('claims/' + currentUser.uid).on('value', snap => { myClaims = snap.val() || {}; renderMyClaims(); renderClaimResults(); });
        }
        function claimPill(st) { return st === 'approved' ? '<span class="pill live">Approved</span>' : st === 'rejected' ? '<span class="pill rej">Rejected</span>' : '<span class="pill draft">Pending</span>'; }
        function renderClaimResults() {
            const box = $('claimResults'), q = $('claimSearch').value.trim().toLowerCase();
            const all = q.length < 2 ? storeApps : storeApps.filter(a => [a.name, a.package, a.developerName].join(' ').toLowerCase().includes(q));
            const list = all.slice(0, claimLimit);
            if (!list.length) { box.innerHTML = '<div class="chart-note">No app found. Check the spelling, or upload it as a new app.</div>'; return; }
            box.innerHTML = list.map(a => {
                const c = myClaims[a.id];
                const act = a.claimedAt && !(c && c.status === 'pending') ? `<button type="button" class="btn-ghost claim-go" onclick="openClaimModal('${escHtml(a.id)}')">Claimed</button>` : c && c.status === 'pending' ? claimPill('pending') : c && c.status === 'approved' ? claimPill('approved') : `<button type="button" class="btn-primary claim-go" onclick="openClaimModal('${escHtml(a.id)}')">${c && c.status === 'rejected' ? 'Claim again' : 'Claim'}</button>`;
                return `<div class="claim-app"><img src="${escHtml(a.icon || 'https://img.icons8.com/color/144/android-os.png')}" alt=""><div class="claim-app-info"><b>${escHtml(a.name || 'App')}</b><span>${escHtml(a.package || '')}</span><span>Listed by ${escHtml(a.developerName || 'unknown')}</span></div>${act}</div>`;
            }).join('') + (all.length > list.length ? `<div style="text-align:center;margin-top:6px"><button type="button" class="btn-ghost" onclick="claimLimit += 20; renderClaimResults()">Show more (${all.length - list.length})</button></div>` : '');
        }
        function renderMyClaims() {
            const box = $('myClaims'), list = Object.keys(myClaims).map(k => ({ ...myClaims[k], key: k })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            if (!list.length) { box.innerHTML = '<div class="chart-note">No claim requests yet.</div>'; return; }
            box.innerHTML = list.map(c => `<div class="claim-app"><img src="${escHtml(c.icon || 'https://img.icons8.com/color/144/android-os.png')}" alt=""><div class="claim-app-info"><b>${escHtml(c.appName || 'App')}</b><span>Sent ${claimWhen(c.timestamp)}</span>${c.status === 'rejected' && c.reason ? `<span class="claim-reason">Reason: ${escHtml(c.reason)}</span>` : ''}${c.status === 'approved' ? '<span>Now in your My Apps.</span>' : ''}</div>${claimPill(c.status)}${c.status === 'pending' ? `<button type="button" class="btn-ghost claim-go" onclick="withdrawClaim('${escHtml(c.key)}')">Withdraw</button>` : ''}</div>`).join('');
        }
        function openClaimModal(appId) {
            const a = storeApps.find(x => x.id === appId); if (!a) return;
            if (a.claimedAt) { showClaimed(a); return; }
            claimApp = a;
            $('claimIcon').src = a.icon || 'https://img.icons8.com/color/144/android-os.png';
            $('claimTitle').textContent = 'Claim ' + (a.name || 'app');
            $('claimSub').textContent = a.package || '';
            $('claimEmail').value = (currentUser.email || '');
            $('claimProof').value = ''; $('claimMessage').value = ''; $('claimConfirm').checked = false; $('claimError').textContent = '';
            shotsClaim.clear(); $('claimSendBtn').disabled = false; $('claimSendBtn').textContent = 'Send claim';
            $('claimModal').classList.add('open');
        }
        function showClaimed(a) {
            $('claimedIcon').src = a.icon || 'https://img.icons8.com/color/144/android-os.png';
            $('claimedName').textContent = a.name || 'This app';
            $('claimedBy').textContent = a.developerName || 'another developer';
            $('claimedModal').classList.add('open');
        }
        function closeClaimedModal() { $('claimedModal').classList.remove('open'); }
        function closeClaimModal() { $('claimModal').classList.remove('open'); }
        function submitClaim(e) {
            e.preventDefault();
            const err = $('claimError'), a = claimApp; if (!a) return;
            const email = $('claimEmail').value.trim(), proof = $('claimProof').value.trim(), msg = $('claimMessage').value.trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'Enter a valid contact email.'; return; }
            if (!/^https?:\/\/\S+\.\S+/i.test(proof)) { err.textContent = 'Enter the proof link, starting with https://'; return; }
            if (msg.length < 15) { err.textContent = 'Please write a short message (at least 15 characters).'; return; }
            if (!$('claimConfirm').checked) { err.textContent = 'Please tick the confirmation box.'; return; }
            const btn = $('claimSendBtn'); btn.disabled = true; btn.textContent = shotsClaim.items.length ? 'Uploading screenshots…' : 'Sending…'; err.textContent = '';
            shotsClaim.resolve().then(urls => {
                if (urls.some(u => !/^https?:\/\//i.test(u))) throw new Error('Screenshot upload failed. Check your internet and try again.');
                btn.textContent = 'Sending…';
                return db.ref('users/' + currentUser.uid).once('value').catch(() => null).then(us => ({ us, urls }));
            }).then(({ us, urls }) => {
                const u = (us && us.val()) || {};
                return db.ref('claims/' + currentUser.uid + '/' + a.id).set({
                    appId: a.id, appName: String(a.name || '').slice(0, 100), package: String(a.package || '').slice(0, 150), icon: String(a.icon || '').slice(0, 500),
                    currentOwner: String(a.developerUid || ''), currentOwnerName: String(a.developerName || '').slice(0, 80),
                    claimantUid: currentUser.uid, claimantName: String(u.name || currentUser.displayName || 'Developer').slice(0, 60), claimantUsername: String(u.username || ''),
                    claimantEmail: String(currentUser.email || '').slice(0, 120), contactEmail: email.slice(0, 120), role: $('claimRole').value, proofUrl: proof.slice(0, 400), message: msg, screenshots: urls.join(','),
                    status: 'pending', timestamp: Date.now()
                });
            }).then(() => { closeClaimModal(); zdShow({ type: 'success', title: 'Claim sent', body: 'The store admin will check it and you will get a notification with the decision.', ok: 'Got it' }); })
              .catch(x => { btn.disabled = false; btn.textContent = 'Send claim'; err.textContent = 'Could not send the claim. Please try again. (' + ((x && x.message) || 'error') + ')'; });
        }
        async function withdrawClaim(appId) {
            if (!(await zdConfirm('The admin will no longer review it. You can send a new claim later.', { title: 'Withdraw this claim?', ok: 'Withdraw', danger: true }))) return;
            db.ref('claims/' + currentUser.uid + '/' + appId).remove().catch(() => zdAlert('Could not withdraw. Please try again.'));
        }


        // ============================================
        // ACTIVITY LOG
        // ============================================
        function addActivityLog(action) {
            activityLog.unshift({ action, timestamp: Date.now() });
            if (activityLog.length > 100) activityLog.pop();
            localStorage.setItem('stardust_activity_log', JSON.stringify(activityLog));
        }


        // ============================================
        // PROFILE
        // ============================================
        // ============================================
        // ORGANIZATION PROFILE (public page on the store: /developer/<username>/)
        // ============================================
        const STORE_URL = 'https://uptozishu.zishuai.cloud';
        const PROF_FIELDS = ['name', 'tagline', 'type', 'about', 'location', 'founded', 'email', 'website', 'github', 'twitter', 'instagram', 'youtube', 'telegram', 'linkedin', 'discord'];
        const PROF_IDS = { name: 'profName', tagline: 'profTagline', type: 'profType', about: 'profAbout', location: 'profLocation', founded: 'profFounded', email: 'profEmail', website: 'profWebsite', github: 'profGithub', twitter: 'profTwitter', instagram: 'profInstagram', youtube: 'profYoutube', telegram: 'profTelegram', linkedin: 'profLinkedin', discord: 'profDiscord' };
        const PROF_TYPES = { individual: 'Individual developer', studio: 'Studio / team', company: 'Company', opensource: 'Open source', student: 'Student developer' };
        let profSaved = {}, profFiles = { logo: null, cover: null }, profUser = '', profCreated = 0, profVerified = false, profBound = false, profLogoUrl = '', profCoverUrl = '';
        let profPending = null;
        function showProfReview() {
            const el = $('profReview'); if (!el) return;
            if (!profPending) { el.hidden = true; return; }
            const rej = profPending.status === 'rejected';
            el.hidden = false; el.className = 'org-review ' + (rej ? 'rej' : 'pend');
            el.innerHTML = rej
                ? `<b>Your last profile changes were not approved.</b><span>${profPending.rejectReason ? 'Reason: ' + escHtml(profPending.rejectReason) + '. ' : ''}Update the details below and submit again. Your approved profile is still showing on the store.</span>`
                : '<b>Your profile changes are under review.</b><span>Your current approved profile stays visible on the store until our team approves the changes. You will get a notification.</span>';
        }

        function profValues() { const v = {}; PROF_FIELDS.forEach(k => { v[k] = ($(PROF_IDS[k]).value || '').trim(); }); return v; }
        function profDirty() { const v = profValues(); return PROF_FIELDS.some(k => v[k] !== (profSaved[k] || '')) || !!profFiles.logo || !!profFiles.cover; }
        function profRefresh() {
            const v = profValues();
            $('orgName').textContent = v.name || 'Your organization';
            $('orgTag').textContent = v.tagline || '';
            $('orgTypeTxt').textContent = PROF_TYPES[v.type] || '';
            $('orgTypeTxt').style.display = v.type ? '' : 'none';
            $('cntTag').textContent = v.tagline.length; $('cntAbout').textContent = v.about.length;
            $('orgVerified').hidden = !profVerified;
            $('orgSaveBar').hidden = !profDirty();
            // strength meter
            const links = !!(v.website || v.github); // X, Instagram, YouTube, LinkedIn, Telegram and Discord are optional and do not count
            const items = [
                ['Add a logo', !!(profFiles.logo || profLogoUrl), 15], ['Add a cover image', !!(profFiles.cover || profCoverUrl), 10], ['Add your name', v.name.length >= 2, 15],
                ['Write a tagline', v.tagline.length >= 10, 10], ['Write an About (50+ characters)', v.about.length >= 50, 20], ['Choose account type', !!v.type, 5],
                ['Add your location', !!v.location, 5], ['Add a contact email', !!v.email, 10], ['Add your website or GitHub', links, 10]
            ];
            const pct = items.reduce((s, x) => s + (x[1] ? x[2] : 0), 0);
            $('orgPct').textContent = pct + '%'; $('orgMeter').style.width = pct + '%';
            $('orgMeter').className = pct >= 80 ? 'good' : pct >= 50 ? 'mid' : '';
            $('orgTodo').innerHTML = items.filter(x => !x[1]).map(x => '<span>＋ ' + escHtml(x[0]) + '</span>').join('') || '<span class="done">✓ Everything is filled in</span>';
        }
        function profBind() {
            if (profBound) return; profBound = true;
            PROF_FIELDS.forEach(k => { $(PROF_IDS[k]).addEventListener('input', profRefresh); $(PROF_IDS[k]).addEventListener('change', profRefresh); });
            const pick = (kind, inputId, imgFn) => $(inputId).addEventListener('change', e => {
                const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
                if (!/^image\//.test(f.type)) { zdAlert('Please choose an image.'); return; }
                if (f.size > 8 * 1024 * 1024) { zdAlert('This image is too large. Choose one under 8 MB.'); return; }
                profFiles[kind] = f; imgFn(URL.createObjectURL(f)); profRefresh();
            });
            pick('logo', 'orgLogoFile', u => { $('orgLogo').src = u; });
            pick('cover', 'orgCoverFile', u => { $('orgCover').style.backgroundImage = `url('${u}')`; $('orgCover').classList.add('has'); });
            window.addEventListener('beforeunload', e => { if (currentPage === 'profile' && profDirty()) { e.preventDefault(); e.returnValue = ''; } });
        }
        function profFill() {
            PROF_FIELDS.forEach(k => { $(PROF_IDS[k]).value = profSaved[k] || ''; });
            profFiles = { logo: null, cover: null };
            $('orgLogo').src = profLogoUrl || 'https://img.icons8.com/clouds/200/user.png';
            $('orgCover').style.backgroundImage = profCoverUrl ? `url('${profCoverUrl}')` : '';
            $('orgCover').classList.toggle('has', !!profCoverUrl);
            profRefresh();
        }
        function loadProfile() {
            if (!currentUser) return;
            profBind();
            $('profLoginEmail').value = currentUser.email || '';
            const uid = currentUser.uid;
            Promise.all([
                db.ref('users/' + uid).once('value').catch(() => null), db.ref('developers/' + uid).once('value').catch(() => null),
                db.ref('devprofiles/' + uid).once('value').catch(() => null), db.ref('apps').once('value').catch(() => null),
                db.ref('devprofilePending/' + uid).once('value').catch(() => null)
            ]).then(([us, ds, ps, as, pn]) => {
                const u = (us && us.val()) || {}, d = (ds && ds.val()) || {}, liveP = (ps && ps.val()) || {}, pend = (pn && pn.val()) || null;
                // while a change is waiting (or was rejected) the form shows what the developer submitted; the public page keeps showing the approved profile
                const pub = pend ? Object.assign({}, liveP, pend) : liveP;
                profPending = pend; showProfReview();
                profUser = u.username || window._devUsername || pub.username || '';
                $('profUsername').value = profUser ? '@' + profUser : '';
                $('orgUser').textContent = profUser ? '@' + profUser : '';
                profVerified = liveP.verified === true; profCreated = +pub.createdAt || 0;
                profSaved = {
                    name: pub.name || d.displayName || u.name || currentUser.displayName || '', tagline: pub.tagline || '', type: pub.type || '',
                    about: pub.about || d.bio || u.bio || '', location: pub.location || d.country || '', founded: pub.founded || '',
                    email: pub.email || d.supportEmail || '', website: pub.website || d.website || '', github: pub.github || d.github || '',
                    twitter: pub.twitter || '', instagram: pub.instagram || '', youtube: pub.youtube || '', telegram: pub.telegram || '', linkedin: pub.linkedin || '', discord: pub.discord || ''
                };
                profLogoUrl = /^https?:\/\//i.test(pub.logo || '') ? pub.logo : (/^https?:\/\//i.test(d.photoURL || '') ? d.photoURL : '');
                profCoverUrl = /^https?:\/\//i.test(pub.cover || '') ? pub.cover : '';
                profFill();
                // public link
                const link = profUser ? `${STORE_URL}/developer/${profUser}/` : '';
                $('orgLink').textContent = link ? link.replace('https://', '') : 'Set a username first';
                $('orgView').href = link || '#'; $('orgView').style.display = link ? '' : 'none';
                window._profLink = link;
                // stats from this developer's apps
                const all = (as && as.val()) || {}, mine = Object.keys(all).map(id => ({ id, ...all[id] })).filter(a => a.developerUid === uid);
                const live = mine.filter(a => a.status === 'live' || a.status === 'approved');
                const dl = mine.reduce((s, a) => s + (+a.downloadCount || 0), 0), rc = mine.reduce((s, a) => s + (+a.reviewCount || 0), 0);
                const rate = rc ? mine.reduce((s, a) => s + (+a.rating || 0) * (+a.reviewCount || 0), 0) / rc : 0;
                const firstApp = mine.reduce((m, a) => { const t = appCreated(a); return t && t < m ? t : m; }, Infinity);
                const since = +u.createdAt || profCreated || (isFinite(firstApp) ? firstApp : 0);
                $('stApps').textContent = live.length; $('stDl').textContent = dl >= 1000 ? (dl / 1000).toFixed(dl >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : dl;
                $('stRate').textContent = rate ? rate.toFixed(1) + ' ★' : '—'; $('stSince').textContent = since ? new Date(since).getFullYear() : '—';
                window._profApps = mine;
            });
        }
        function copyProfileLink() {
            const l = window._profLink; if (!l) { zdAlert('Set a username first.'); return; }
            (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => zdToast('Link copied')).catch(() => zdAlert(l, { title: 'Copy this link', type: 'info' }));
        }
        async function discardProfile() { if (profDirty() && !(await zdConfirm('Everything you typed since the last save is lost.', { title: 'Discard your changes?', ok: 'Discard', danger: true }))) return; profFill(); }
        function profUrl(v) { v = String(v || '').trim(); if (!v) return ''; return /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, ''); }

        function saveProfile() {
            if (!currentUser) return;
            const v = profValues(), uid = currentUser.uid, err = m => { zdAlert(m); };
            if (!profUser) return err('Your account has no username yet. Please sign out and sign in again to finish your profile.');
            if (v.name.length < 2) return err('Please enter your organization or developer name (at least 2 characters).');
            if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return err('Enter a valid contact email, or leave it empty.');
            if (v.founded && !/^(19|20)\d{2}$/.test(v.founded)) return err('Year started must be a 4-digit year, for example 2024.');
            v.website = profUrl(v.website); v.discord = profUrl(v.discord);
            if (v.website && !/^https?:\/\/\S+\.\S+/.test(v.website)) return err('Enter a valid website address.');
            const btn = $('orgSaveBtn'); btn.disabled = true; btn.textContent = 'Submitting…';
            const up1 = f => f ? uploadToImgBB(f) : Promise.resolve(null);
            Promise.all([up1(profFiles.logo), up1(profFiles.cover)]).then(([logo, cover]) => {
                if ((logo && !/^https?:\/\//i.test(logo)) || (cover && !/^https?:\/\//i.test(cover))) throw new Error('Image upload failed. Check your internet and try again.');
                const now = Date.now(), nv = x => (x === '' ? null : x);
                const rec = { status: 'pending', submittedAt: now, username: profUser, createdAt: profCreated || now, updatedAt: now };
                PROF_FIELDS.forEach(k => { rec[k] = nv(k === 'name' ? v.name.slice(0, 60) : v[k]); });
                rec.tagline = nv(v.tagline.slice(0, 90)); rec.about = nv(v.about.slice(0, 1500));
                const newLogo = logo || profLogoUrl, newCover = cover || profCoverUrl;
                rec.logo = nv(newLogo); rec.cover = nv(newCover);
                Object.keys(rec).forEach(k => { if (rec[k] === null) delete rec[k]; });
                // nothing goes live here: the change waits in a review queue until an admin approves it
                return db.ref('devprofilePending/' + uid).set(rec).then(() => ({ newLogo, newCover, rec }));
            }).then(({ newLogo, newCover, rec }) => {
                profSaved = { ...v }; profLogoUrl = newLogo || ''; profCoverUrl = newCover || ''; profFiles = { logo: null, cover: null };
                profPending = rec; showProfReview();
                addNotification('Profile changes submitted for review. Your current profile stays live until they are approved.');
                profFill();
                btn.disabled = false; btn.textContent = 'Submit for review';
                zdShow({ type: 'success', title: 'Profile sent for review', body: 'Your current profile stays live on the store until our team approves the changes. You will get a notification with the decision.', steps: ['Submitted', 'Team reviews the changes', 'Notification with the decision'], ok: 'Got it' });
            }).catch(x => { btn.disabled = false; btn.textContent = 'Submit for review'; zdAlert((x && x.message ? x.message : 'Could not submit.') + (/permission/i.test((x && x.message) || '') ? '\nPublish the latest Firebase rules and try again.' : '')); });
        }

        // ============================================
        // SUPPORT TICKETS
        // ============================================
        // Paste your Google Apps Script web-app URL here to enable ticket emails (see mail-script/README.txt)
        const MAIL_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxnsa5QzCWtto5671_JcJlefPOV9YcGlZUHMW9CrH1VuG0Qa8cNe94RLYpkFMC7G6Ga4g/exec';
        function sendTicketMail(type, ticketId) {
            if (!MAIL_ENDPOINT || !currentUser) return Promise.resolve();
            return currentUser.getIdToken().then(token => Promise.race([
                fetch(MAIL_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type, ticketId, token }) }),
                new Promise(r => setTimeout(r, 3500))
            ])).catch(() => {});
        }
        const TK_STATUS = { open: ['Open', 'warn'], answered: ['Answered', 'ok'], closed: ['Closed', 'mute'] };
        const TK_CATS = { account: 'Account and login', app: 'App upload or listing', review: 'Reviews and ratings', claim: 'Claim request', bug: 'Bug or technical problem', other: 'Something else' };
        let userTickets = {}, tkFilter = 'all', tkId = null, tkData = null, tkRef = null;
        const tkPill = s => { const m = TK_STATUS[s] || TK_STATUS.open; return `<span class="tk-pill ${m[1]}">${m[0]}</span>`; };
        const tkTime = t => { if (!t) return ''; const d = new Date(t), now = new Date(); const same = d.toDateString() === now.toDateString(); return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
        function watchUserTickets() {
            if (!currentUser) return;
            db.ref('userTickets/' + currentUser.uid).on('value', snap => {
                userTickets = snap.val() || {};
                setBadge($('ticketBadge'), Object.values(userTickets).filter(t => t && t.unread).length);
                if (currentPage === 'support') renderTicketList();
            }, () => { if (currentPage === 'support') renderTicketList(); });
        }
        function tkList() { return Object.keys(userTickets).map(id => ({ id, ...userTickets[id] })).filter(t => t && t.subject).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }
        function setTkFilter(f) { tkFilter = f; renderTicketList(); }
        function renderTicketList() {
            const box = $('ticketList'); if (!box) return;
            const all = tkList();
            const cnt = s => s === 'all' ? all.length : all.filter(t => t.status === s).length;
            $('spTabs').innerHTML = ['all', 'open', 'answered', 'closed'].map(s => `<button type="button" class="${tkFilter === s ? 'on' : ''}" onclick="setTkFilter('${s}')">${s[0].toUpperCase() + s.slice(1)} <i>${cnt(s)}</i></button>`).join('');
            const list = tkFilter === 'all' ? all : all.filter(t => t.status === tkFilter);
            if (!list.length) {
                box.innerHTML = `<div class="sp-empty"><div class="sp-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg></div><b>${all.length ? 'No ' + tkFilter + ' tickets' : 'No tickets yet'}</b><p>${all.length ? 'Try a different filter.' : 'Having a problem or a question? Open a ticket and we will reply right here.'}</p>${all.length ? '' : '<button type="button" class="btn-primary" onclick="openTicketForm()">Open your first ticket</button>'}</div>`;
                return;
            }
            if (!box._lp) { box._lp = true; bindTicketLongPress(box); }
            box.innerHTML = (list.some(t => t.status === 'closed') ? '<div class="tk-hint">Tip: press and hold a closed ticket to delete it.</div>' : '') + list.map(t => `<a class="tk-item${t.unread ? ' unread' : ''}${t.status === 'closed' ? ' closed' : ''}" data-tid="${escHtml(t.id)}" href="/support/ticket/?id=${encodeURIComponent(t.id)}">
                <span class="tk-dot"></span>
                <span class="tk-main"><b>${escHtml(t.subject)}</b><small>${escHtml(TK_CATS[t.category] || 'General')} · ${t.lastBy === 'admin' ? 'Support replied' : 'You wrote'} · ${tkTime(t.updatedAt)}</small></span>
                ${t.unread ? '<span class="tk-new">New reply</span>' : ''}${tkPill(t.status)}
                <svg class="st-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></a>`).join('');
        }
        // long press (or right click) on a closed ticket offers to delete it
        function bindTicketLongPress(box) {
            let timer = null, sx = 0, sy = 0, fired = false;
            const cancel = () => { clearTimeout(timer); timer = null; };
            const ask = async el => {
                const id = el.dataset.tid, t = tkList().find(x => x.id === id); if (!t) return;
                fired = true; if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) { } }
                el.classList.add('pressed');
                const ok = await zdConfirm('"' + t.subject + '" and its whole conversation are removed. This cannot be undone.', { title: 'Delete this ticket?', ok: 'Delete ticket', danger: true });
                el.classList.remove('pressed');
                if (!ok) return;
                const up = {}; up['tickets/' + id] = null; up['userTickets/' + currentUser.uid + '/' + id] = null;
                el.classList.add('removing');
                db.ref().update(up).then(() => zdToast('Ticket deleted')).catch(() => { el.classList.remove('removing'); zdAlert('Could not delete the ticket. Please publish the latest Firebase rules and try again.'); });
            };
            box.addEventListener('pointerdown', e => {
                const el = e.target.closest('.tk-item.closed'); if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
                fired = false; sx = e.clientX; sy = e.clientY; cancel(); timer = setTimeout(() => ask(el), 550);
            });
            box.addEventListener('pointermove', e => { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel(); });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => box.addEventListener(n, cancel));
            box.addEventListener('contextmenu', e => { const el = e.target.closest('.tk-item.closed'); if (el) { e.preventDefault(); cancel(); if (!fired) ask(el); } });
            box.addEventListener('click', e => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
        }
        function openTicketForm() {
            if (tkList().filter(t => t.status !== 'closed').length >= 5) { stToastTk('You already have 5 open tickets. Please wait for a reply or close one.'); return; }
            const apps = (allApps || []).filter(a => a.developerUid === currentUser.uid);
            $('tkApp').innerHTML = '<option value="">Not about a specific app</option>' + apps.map(a => `<option value="${escHtml(a.id)}">${escHtml(a.name || a.id)}</option>`).join('');
            ['tkSubject', 'tkMsg'].forEach(i => $(i).value = ''); $('tkCat').value = 'app'; $('tkPrio').value = 'normal';
            $('tkErr').style.display = 'none'; $('tkCount').textContent = '0 / 2000';
            $('tkModal').classList.add('open'); setTimeout(() => $('tkSubject').focus(), 60);
        }
        function closeTicketForm() { $('tkModal').classList.remove('open'); }
        function stToastTk(m) { const t = $('stToast'); if (!t) { zdAlert(m); return; } t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
        function tkErr(m) { const e = $('tkErr'); e.textContent = m; e.style.display = m ? '' : 'none'; }
        function submitTicket() {
            const subject = $('tkSubject').value.trim(), text = $('tkMsg').value.trim();
            if (subject.length < 4) return tkErr('Add a short subject (at least 4 characters).');
            if (text.length < 10) return tkErr('Please describe the problem in a few more words (at least 10 characters).');
            tkErr('');
            const btn = $('tkSend'); btn.disabled = true; btn.textContent = 'Sending...';
            const uid = currentUser.uid, now = Date.now(), id = db.ref('tickets').push().key, mid = db.ref('tickets/' + id + '/messages').push().key;
            const name = currentUser.displayName || (currentUser.email || '').split('@')[0] || 'Developer';
            const appId = $('tkApp').value, app = (allApps || []).find(a => a.id === appId);
            const t = { uid, devName: name, email: currentUser.email || '', subject: subject.slice(0, 100), category: $('tkCat').value, priority: $('tkPrio').value, appId: appId || '', appName: app ? String(app.name || '').slice(0, 100) : '', status: 'open', lastBy: 'dev', createdAt: now, updatedAt: now, messages: { [mid]: { by: 'dev', name, text: text.slice(0, 2000), at: now } } };
            const up = {};
            up['tickets/' + id] = t;
            up['userTickets/' + uid + '/' + id] = { subject: t.subject, category: t.category, status: 'open', lastBy: 'dev', createdAt: now, updatedAt: now, unread: false };
            db.ref().update(up).then(() => { addActivityLog('Opened support ticket'); return sendTicketMail('opened', id); }).then(() => showTicketSent(id, t.email))
                .catch(() => { btn.disabled = false; btn.textContent = 'Send ticket'; tkErr('Could not send the ticket. Check your connection and try again.'); });
        }

        function showTicketSent(id, email) {
            closeTicketForm();
            $('tkSentMail').textContent = email || 'your email';
            $('tkSentGo').href = '/support/ticket/?id=' + encodeURIComponent(id);
            $('tkSent').classList.add('open');
        }

        // ---- single ticket page ----
        function initTicketPage() {
            tkId = new URLSearchParams(location.search).get('id');
            if (!tkId) { showTkMissing(); return; }
            tkRef = db.ref('tickets/' + tkId);
            tkRef.on('value', snap => {
                const t = snap.val();
                if (!t || t.uid !== currentUser.uid) { showTkMissing(); return; }
                tkData = t; renderTicket();
                db.ref('userTickets/' + currentUser.uid + '/' + tkId).once('value').then(s => { const v = s.val(); if (v && v.unread) db.ref('userTickets/' + currentUser.uid + '/' + tkId + '/unread').set(false); }).catch(() => {});
            }, showTkMissing);
            const ta = $('tkReply'); if (ta) ta.addEventListener('input', () => { $('tkReplyCount').textContent = ta.value.length + ' / 2000'; });
        }
        function showTkMissing() { $('tkWrap').innerHTML = '<div class="sp-empty"><b>Ticket not found</b><p>This ticket does not exist or you do not have access to it.</p><a class="btn-primary" href="/support/">Back to Support</a></div>'; }
        function renderTicket() {
            const t = tkData; $('tkSubject').textContent = t.subject;
            $('tkStatus').innerHTML = tkPill(t.status);
            $('tkMeta').textContent = '#' + tkId.slice(-6).toUpperCase() + ' · ' + (TK_CATS[t.category] || 'General') + (t.appName ? ' · ' + t.appName : '') + ' · Opened ' + tkTime(t.createdAt);
            const msgs = Object.keys(t.messages || {}).map(k => ({ id: k, ...t.messages[k] })).sort((a, b) => (a.at || 0) - (b.at || 0));
            const th = $('tkThread');
            th.innerHTML = msgs.map(m => m.by === 'admin'
                ? `<div class="tk-msg admin"><div class="tk-who"><span class="tk-av"><img src="/favicon.png" alt=""></span><b>UptoZishu Support</b><em>Official</em><time>${tkTime(m.at)}</time></div><div class="tk-bub">${escHtml(m.text)}</div></div>`
                : `<div class="tk-msg dev"><div class="tk-who"><b>You</b><time>${tkTime(m.at)}</time></div><div class="tk-bub">${escHtml(m.text)}</div></div>`).join('');
            const closed = t.status === 'closed';
            $('tkCompose').style.display = closed ? 'none' : '';
            $('tkClosedBar').style.display = closed ? '' : 'none';
            const wait = !closed && t.lastBy === 'dev';
            $('tkWait').style.display = wait ? '' : 'none';
            if (!tkRender1) { tkRender1 = true; setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); }
        }
        let tkRender1 = false;
        function sendTicketReply() {
            const ta = $('tkReply'), text = ta.value.trim(); if (text.length < 2) { ta.focus(); return; }
            const btn = $('tkReplySend'); btn.disabled = true; btn.textContent = 'Sending...';
            const uid = currentUser.uid, now = Date.now(), mid = db.ref('tickets/' + tkId + '/messages').push().key;
            const name = currentUser.displayName || (currentUser.email || '').split('@')[0] || 'Developer';
            const up = {};
            up['tickets/' + tkId + '/messages/' + mid] = { by: 'dev', name, text: text.slice(0, 2000), at: now };
            up['tickets/' + tkId + '/status'] = 'open'; up['tickets/' + tkId + '/updatedAt'] = now; up['tickets/' + tkId + '/lastBy'] = 'dev';
            up['userTickets/' + uid + '/' + tkId + '/status'] = 'open'; up['userTickets/' + uid + '/' + tkId + '/updatedAt'] = now; up['userTickets/' + uid + '/' + tkId + '/lastBy'] = 'dev'; up['userTickets/' + uid + '/' + tkId + '/unread'] = false;
            db.ref().update(up).then(() => { ta.value = ''; $('tkReplyCount').textContent = '0 / 2000'; btn.disabled = false; btn.textContent = 'Send reply'; setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 80); })
                .catch(() => { btn.disabled = false; btn.textContent = 'Send reply'; stToastTk('Could not send. Please try again.'); });
        }
        function setTicketStatus(status) {
            const uid = currentUser.uid, now = Date.now(), up = {};
            up['tickets/' + tkId + '/status'] = status; up['tickets/' + tkId + '/updatedAt'] = now;
            up['userTickets/' + uid + '/' + tkId + '/status'] = status; up['userTickets/' + uid + '/' + tkId + '/updatedAt'] = now;
            db.ref().update(up).catch(() => stToastTk('Could not update the ticket.'));
        }
        async function closeTicket() { if (await zdConfirm('A closed ticket cannot be replied to or reopened. You can open a new ticket any time.', { title: 'Close this ticket?', ok: 'Close ticket', type: 'warn' })) setTicketStatus('closed'); }
        function reopenTicket() { setTicketStatus('open'); }

        // ============================================
        // SETTINGS (professional dialogs; English only)
        // ============================================
        const NOTIF_PREF_KEY = 'zt_notif_prefs';
        const SUPPORT_EMAIL = 'support.stardustofficial@gmail.com';
        function notifPrefs() { try { return Object.assign({ review: true, claim: true, admin: true }, JSON.parse(localStorage.getItem(NOTIF_PREF_KEY) || '{}')); } catch (e) { return { review: true, claim: true, admin: true }; } }
        const NF_MAP = { nfReview: 'review', nfClaim: 'claim', nfAdmin: 'admin' };
        function setNotifPref(id, on) {
            const p = notifPrefs(); p[NF_MAP[id]] = !!on;
            try { localStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(p)); } catch (e) {}
            stToast(on ? 'Notifications turned on' : 'Notifications turned off');
        }
        function stToast(msg) {
            const t = $('stToast'); if (!t) return;
            t.textContent = msg; t.classList.add('show');
            clearTimeout(stToast._t); stToast._t = setTimeout(() => t.classList.remove('show'), 2400);
        }
        function openStModal(title, sub, bodyHtml, buttons) {
            $('stModalTitle').textContent = title;
            $('stModalSub').textContent = sub || '';
            $('stModalSub').style.display = sub ? '' : 'none';
            $('stModalBody').innerHTML = bodyHtml;
            const foot = $('stModalFoot'); foot.innerHTML = '';
            (buttons || []).forEach(b => {
                const el = document.createElement('button');
                el.type = 'button'; el.id = b.id || '';
                el.className = b.kind === 'primary' ? 'btn-primary' : b.kind === 'danger' ? 'btn-primary st-btn-danger' : 'btn-ghost';
                el.textContent = b.label; el.onclick = b.onclick;
                foot.appendChild(el);
            });
            foot.style.display = buttons && buttons.length ? '' : 'none';
            $('stModal').classList.add('open');
            const first = $('stModalBody').querySelector('input'); if (first) setTimeout(() => first.focus(), 60);
        }
        function closeStModal() { $('stModal').classList.remove('open'); }
        function stErr(msg) { const e = $('stErr'); if (e) { e.textContent = msg || ''; e.style.display = msg ? '' : 'none'; } }
        function stBusy(id, on, label) { const b = $(id); if (!b) return; if (on) { b.dataset.l = b.textContent; b.textContent = label; b.disabled = true; } else { b.textContent = b.dataset.l || b.textContent; b.disabled = false; } }
        function authMsg(e) {
            const c = (e && e.code) || '';
            if (c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials') return 'Current password is incorrect.';
            if (c === 'auth/weak-password') return 'New password is too weak (min 6 characters).';
            if (c === 'auth/email-already-in-use') return 'That email is already used by another account.';
            if (c === 'auth/invalid-email') return 'Enter a valid email address.';
            if (c === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.';
            if (c === 'auth/requires-recent-login') return 'Please sign out, sign in again and retry.';
            if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Google confirmation was cancelled.';
            return (e && e.message) || 'Something went wrong. Try again.';
        }
        function isPasswordUser() { const u = auth.currentUser; return !!(u && u.providerData && u.providerData.some(p => p.providerId === 'password')); }
        function reauth(pw) {
            const u = auth.currentUser;
            if (isPasswordUser()) return u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
            return u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
        }
        function pwField(id, label, ph, ac) { return `<div class="form-group"><label for="${id}">${label}</label><input type="password" id="${id}" placeholder="${ph || ''}" autocomplete="${ac || 'off'}"></div>`; }

        // ---- page init ----
        function initSettings() {
            const u = auth.currentUser; if (!u) return;
            const name = u.displayName || (u.email || '').split('@')[0] || 'Developer';
            $('stName').textContent = name; $('stEmail').textContent = u.email || '';
            $('stAvatar').textContent = name.charAt(0).toUpperCase();
            if ($('stYear')) $('stYear').textContent = new Date().getFullYear();
            const google = !isPasswordUser();
            ['stRowPw', 'stRowEmail'].forEach(i => { const r = $(i); if (r) r.style.display = google ? 'none' : ''; });
            $('stGoogleNote').style.display = google ? '' : 'none';
            const chips = [];
            chips.push(`<span class="st-chip">${google ? 'Google account' : 'Email and password'}</span>`);
            chips.push(u.emailVerified ? '<span class="st-chip ok">Email verified</span>' : '<span class="st-chip warn">Email not verified</span>');
            $('stChips').innerHTML = chips.join('');
            db.ref('users/' + u.uid).once('value').then(s => {
                const p = s.val() || {};
                if (p.username) {
                    $('stChips').insertAdjacentHTML('afterbegin', `<span class="st-chip brand">@${escHtml(p.username)}</span>`);
                    const a = $('stPublic'); a.href = STORE_URL + '/developer/' + encodeURIComponent(p.username) + '/'; a.style.display = '';
                }
            }).catch(() => {});
            db.ref('devprofiles/' + u.uid).once('value').then(s => {
                const p = s.val() || {};
                if (p.name) $('stName').textContent = p.name;
                if (p.verified) $('stChips').insertAdjacentHTML('beforeend', '<span class="st-chip ok">Verified developer</span>');
                if (p.logo && /^https:/.test(p.logo)) { const av = $('stAvatar'); av.textContent = ''; av.style.backgroundImage = `url("${p.logo.replace(/"/g, '')}")`; av.classList.add('img'); }
            }).catch(() => {});
            const p = notifPrefs();
            Object.keys(NF_MAP).forEach(id => { const el = $(id); if (el) el.checked = p[NF_MAP[id]] !== false; });
            refreshThemeSeg(); refreshSettingCounts();
        }
        function refreshSettingCounts() {
            const d = Object.keys(drafts || {}).length, a = (activityLog || []).length;
            if ($('stRowDraftsSub')) $('stRowDraftsSub').textContent = d ? d + ' unfinished draft' + (d > 1 ? 's' : '') + ' · tap to manage' : 'No drafts saved';
            if ($('stRowActSub')) $('stRowActSub').textContent = a ? a + ' recent action' + (a > 1 ? 's' : '') : 'No activity yet';
        }

        // ---- theme ----
        function themeMode() { let s = null; try { s = localStorage.getItem(THEME_KEY); } catch (e) {} return s === 'dark' || s === 'light' ? s : 'system'; }
        function refreshThemeSeg() { const m = themeMode(); document.querySelectorAll('#stTheme button').forEach(b => b.classList.toggle('on', b.dataset.t === m)); }
        function setThemeMode(m) {
            if (m === 'system') useSystemTheme(); else applyTheme(m === 'dark', true);
            refreshThemeSeg();
        }

        // ---- password ----
        function openPasswordModal() {
            openStModal('Change password', 'Confirm your current password first.',
                pwField('pwOld', 'Current password', '', 'current-password') + pwField('pwNew', 'New password', 'At least 6 characters', 'new-password') + pwField('pwNew2', 'Confirm new password', '', 'new-password') + '<div class="error-msg" id="stErr" style="display:none"></div>',
                [{ label: 'Cancel', onclick: closeStModal }, { id: 'pwGo', label: 'Update password', kind: 'primary', onclick: submitPassword }]);
        }
        function submitPassword() {
            const o = $('pwOld').value, n = $('pwNew').value, c = $('pwNew2').value;
            if (!o) return stErr('Enter your current password.');
            if (n.length < 6) return stErr('New password must be at least 6 characters.');
            if (n !== c) return stErr('New passwords do not match.');
            if (n === o) return stErr('New password must be different from the current one.');
            stErr(''); stBusy('pwGo', true, 'Updating...');
            reauth(o).then(() => auth.currentUser.updatePassword(n)).then(() => {
                addActivityLog('Changed password'); closeStModal(); stToast('Password updated'); refreshSettingCounts();
            }).catch(e => { stBusy('pwGo', false); stErr(authMsg(e)); });
        }

        // ---- email ----
        function openEmailModal() {
            openStModal('Change email', 'Current: ' + (auth.currentUser.email || ''),
                `<div class="form-group"><label for="emNew">New email address</label><input type="email" id="emNew" placeholder="you@example.com" autocomplete="email"></div>` + pwField('emPw', 'Current password', '', 'current-password') + '<div class="error-msg" id="stErr" style="display:none"></div>',
                [{ label: 'Cancel', onclick: closeStModal }, { id: 'emGo', label: 'Update email', kind: 'primary', onclick: submitEmail }]);
        }
        function submitEmail() {
            const em = $('emNew').value.trim(), pw = $('emPw').value;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return stErr('Enter a valid email address.');
            if (em.toLowerCase() === (auth.currentUser.email || '').toLowerCase()) return stErr('That is already your email.');
            if (!pw) return stErr('Enter your current password.');
            stErr(''); stBusy('emGo', true, 'Updating...');
            reauth(pw).then(() => auth.currentUser.updateEmail(em)).then(() => {
                db.ref('developers/' + auth.currentUser.uid + '/email').set(em).catch(() => {});
                addActivityLog('Changed email'); $('userDisplayEmail').textContent = em; $('stEmail').textContent = em;
                closeStModal(); stToast('Email updated');
            }).catch(e => { stBusy('emGo', false); stErr(authMsg(e)); });
        }

        // ---- sign-in info ----
        function openSigninInfo() {
            const u = auth.currentUser, m = u.metadata || {};
            const f = t => t ? new Date(t).toLocaleString() : '—';
            const rows = [['Email', u.email || '—'], ['Sign-in method', isPasswordUser() ? 'Email and password' : 'Google'], ['Email status', u.emailVerified ? 'Verified' : 'Not verified'], ['Account created', f(m.creationTime)], ['Last sign-in', f(m.lastSignInTime)]];
            let html = '<div class="st-kv">' + rows.map(r => `<div><span>${r[0]}</span><b>${escHtml(r[1])}</b></div>`).join('') + '</div>';
            const btns = [{ label: 'Close', onclick: closeStModal }];
            if (!u.emailVerified && isPasswordUser()) btns.push({ id: 'vfGo', label: 'Send verification email', kind: 'primary', onclick: () => { stBusy('vfGo', true, 'Sending...'); u.sendEmailVerification().then(() => { closeStModal(); stToast('Verification email sent'); }).catch(e => { stBusy('vfGo', false); stToast(authMsg(e)); }); } });
            openStModal('Sign-in details', '', html, btns);
        }

        // ---- drafts ----
        function openDrafts() {
            const keys = Object.keys(drafts || {});
            if (!keys.length) { openStModal('Saved drafts', '', '<div class="st-empty">No drafts saved.<br><small>Drafts are created while you upload an app.</small></div>', [{ label: 'Close', onclick: closeStModal }, { label: 'Upload an app', kind: 'primary', onclick: () => { location.href = '/upload/'; } }]); return; }
            const html = '<div class="st-list">' + keys.map(k => { const d = drafts[k] || {}; return `<div class="st-li"><span class="st-ico">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>'}</span><span class="st-txt"><b>${escHtml(d.name || 'Untitled app')}</b><small>Step ${escHtml(String(d.step || 1))}</small></span><button type="button" class="st-mini" onclick="removeDraft('${escHtml(k).replace(/'/g, '')}')">Delete</button></div>`; }).join('') + '</div>';
            openStModal('Saved drafts', keys.length + ' draft' + (keys.length > 1 ? 's' : ''), html, [{ label: 'Close', onclick: closeStModal }, { label: 'Continue upload', kind: 'primary', onclick: () => { location.href = '/upload/'; } }]);
        }
        function removeDraft(k) {
            const real = Object.keys(drafts).find(x => x.replace(/'/g, '') === k); if (!real) return;
            delete drafts[real]; try { localStorage.setItem('stardust_drafts', JSON.stringify(drafts)); } catch (e) {}
            refreshSettingCounts(); openDrafts();
        }

        // ---- activity ----
        function openActivity() {
            if (!activityLog.length) { openStModal('Activity log', '', '<div class="st-empty">No activity yet.<br><small>Your recent actions will appear here.</small></div>', [{ label: 'Close', onclick: closeStModal }]); return; }
            const html = '<div class="st-list">' + activityLog.slice(0, 50).map(l => `<div class="st-li"><span class="st-dot"></span><span class="st-txt"><b>${escHtml(l.action)}</b><small>${new Date(l.timestamp).toLocaleString()}</small></span></div>`).join('') + '</div>';
            openStModal('Activity log', 'Last ' + Math.min(50, activityLog.length) + ' actions on this device', html, [{ label: 'Close', onclick: closeStModal }, { label: 'Clear log', kind: 'danger', onclick: () => { activityLog = []; try { localStorage.removeItem('stardust_activity_log'); } catch (e) {} refreshSettingCounts(); closeStModal(); stToast('Activity log cleared'); } }]);
        }

        // ---- data & privacy ----
        function exportMyData() {
            const u = auth.currentUser; if (!u) return;
            stToast('Preparing your data...');
            Promise.all([db.ref('users/' + u.uid).once('value'), db.ref('developers/' + u.uid).once('value'), db.ref('devprofiles/' + u.uid).once('value')].map(p => p.catch(() => null))).then(r => {
                const out = {
                    exportedAt: new Date().toISOString(),
                    account: { uid: u.uid, email: u.email, emailVerified: u.emailVerified, createdAt: (u.metadata || {}).creationTime || null },
                    user: r[0] ? r[0].val() : null, developer: r[1] ? r[1].val() : null, publicProfile: r[2] ? r[2].val() : null,
                    apps: (allApps || []).filter(a => a.developerUid === u.uid),
                    notifications: allNotifications || []
                };
                const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'uptozishu-my-data.json';
                document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
                addActivityLog('Exported account data'); refreshSettingCounts(); stToast('Data downloaded');
            });
        }
        function openClearLocal() {
            openStModal('Clear local data', '', '<p class="st-p">This removes saved drafts, your activity log and notification and theme preferences from <b>this device only</b>. Your account and apps are not affected.</p>',
                [{ label: 'Cancel', onclick: closeStModal }, { label: 'Clear data', kind: 'danger', onclick: () => {
                    ['stardust_drafts', 'stardust_activity_log', NOTIF_PREF_KEY, THEME_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
                    drafts = {}; activityLog = []; useSystemTheme(); initSettings(); closeStModal(); stToast('Local data cleared');
                } }]);
        }

        // ---- sign out ----
        function openSignOut() {
            openStModal('Sign out?', '', '<p class="st-p">You will need to sign in again to manage your apps on this device.</p>',
                [{ label: 'Cancel', onclick: closeStModal }, { id: 'soGo', label: 'Sign out', kind: 'primary', onclick: logoutUser }]);
        }
        function logoutUser() {
            stBusy('soGo', true, 'Signing out...');
            auth.signOut().then(() => { try { localStorage.removeItem('stardust_uid'); } catch (e) {} leaving = true; location.replace('/auth/'); }).catch(() => stBusy('soGo', false));
        }

        // ---- delete account ----
        function openDeleteAccount() {
            const pw = isPasswordUser();
            openStModal('Delete account', 'This cannot be undone.',
                `<div class="st-warn"><b>You will permanently lose:</b><ul><li>Your developer account and UptoZishu store profile</li><li>All your apps, reviews and replies</li><li>Your username and public developer page</li></ul></div>` +
                `<div class="form-group"><label for="dlType">Type <b>DELETE</b> to confirm</label><input type="text" id="dlType" autocomplete="off" autocapitalize="characters" placeholder="DELETE"></div>` +
                (pw ? pwField('dlPw', 'Current password', '', 'current-password') : '<small class="st-hint">You will be asked to confirm with Google.</small>') + '<div class="error-msg" id="stErr" style="display:none"></div>',
                [{ label: 'Cancel', onclick: closeStModal }, { id: 'dlGo', label: 'Delete my account', kind: 'danger', onclick: submitDelete }]);
        }
        function submitDelete() {
            if ($('dlType').value.trim() !== 'DELETE') return stErr('Type DELETE to confirm.');
            const pwEl = $('dlPw'); if (pwEl && !pwEl.value) return stErr('Enter your current password.');
            stErr(''); stBusy('dlGo', true, 'Deleting...');
            const user = auth.currentUser, uid = user.uid;
            reauth(pwEl ? pwEl.value : '').then(() => {
                const jobs = [];
                const rm = path => jobs.push(db.ref(path).remove().catch(() => {}));
                rm('developers/' + uid); rm('notifications/' + uid); rm('devprofiles/' + uid); rm('users/' + uid);
                if (window._devUsername) rm('usernames/' + window._devUsername);
                (allApps || []).forEach(a => { if (a.developerUid === uid) rm('apps/' + a.id); });
                return db.ref('claims/' + uid).once('value').then(s => { s.forEach(c => { if ((c.val() || {}).status !== 'approved') rm('claims/' + uid + '/' + c.key); }); }).catch(() => {}).then(() => Promise.all(jobs));
            }).then(() => user.delete()).then(() => {
                ['stardust_uid', 'stardust_drafts', 'stardust_activity_log', NOTIF_PREF_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
                leaving = true; location.replace('/auth/');
            }).catch(e => { stBusy('dlGo', false); stErr(authMsg(e)); });
        }

        // ============================================
        // INIT
        // ============================================
        document.addEventListener('DOMContentLoaded', () => {
            loadDraft(); // the loading screen stays until Firebase says who is signed in
        });

        console.log('🚀 UptoZishu Console loaded');
        console.log('📦 Features: Dashboard, App Management, Upload Wizard, Analytics, Reviews, Notifications, Profile, Settings');
        console.log('🔄 Real-time: Apps sync automatically with Firebase');
        console.log('📝 Drafts: Save progress and continue later');
        console.log('✅ Apps go LIVE immediately after upload - no approval needed!');
        console.log('🔐 Google Sign-In enabled!');
        console.log('🎨 Persistent theme saved in localStorage');
        console.log('🖼️ Edit modal only uses file uploads for images (no URL fields)');
