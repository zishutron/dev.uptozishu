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
        const IMGBB_KEY = "550a3bcd47c1b0a86a9f2ba7a41770b6";

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
        function switchAuthMode() {
            isLoginMode = !isLoginMode;
            const btn = $('loginBtn');
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

        function handleAuth(e) {
            e.preventDefault();
            const email = $('loginEmail').value.trim();
            const password = $('loginPassword').value;
            const btn = $('loginBtn');
            const errorEl = $('loginError');

            if (!email || !password) { errorEl.textContent = 'Please fill all fields.'; return; }
            if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }

            btn.disabled = true;
            btn.textContent = isLoginMode ? 'Signing in...' : 'Creating account...';
            errorEl.textContent = '';

            // Clear any previous auth state to avoid conflicts
            const authFunc = isLoginMode ?
                auth.signInWithEmailAndPassword(email, password) :
                auth.createUserWithEmailAndPassword(email, password);

            authFunc
                .then(result => {
                    btn.disabled = false;
                    btn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
                    goNext();
                })
                .catch(err => {
                    btn.disabled = false;
                    btn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
                    errorEl.textContent = err.message;
                });
        }

        // Google Sign-In
        function signInWithGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then(result => {
                    goNext();
                })
                .catch(err => {
                    alert('Google Sign-In failed: ' + err.message);
                });
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
            initPage();
            localStorage.setItem('stardust_uid', user.uid);
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
                if (ON_AUTH_PAGE) { goNext(); return; }
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
        // LOGOUT
        // ============================================
        function logoutUser() {
            if (confirm('Are you sure you want to logout?')) {
                auth.signOut().then(() => {
                    localStorage.removeItem('stardust_uid');
                    leaving = true;
                    location.replace('/auth/');
                });
            }
        }

        // ============================================
        // NAVIGATION
        // ============================================
        const PAGE_URL = { dashboard: '/', myapps: '/apps/', upload: '/upload/', analytics: '/analytics/', reviews: '/reviews/', notifications: '/notifications/', profile: '/profile/', settings: '/settings/' };
        function switchPage(page) {
            if (page === currentPage) return;
            location.href = PAGE_URL[page] || '/';
        }

        // Runs once the user is signed in: prepares only the page that is open
        function initPage() {
            if (currentPage === 'dashboard') updateDashboard();
            if (currentPage === 'notifications') renderNotifications();
            if (currentPage === 'analytics') populateAnalyticsSelect();
            if (currentPage === 'reviews') loadReviews();
            if (currentPage === 'profile') loadProfile();
            if (currentPage === 'myapps') initAppSearch();
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
                    snap.forEach(c => { const r = c.val(); if (r && r.text) { sum += Math.min(5, Math.max(1, Math.round(+r.rating || 5))); n++; } });
                    const avg = n ? Math.round((sum / n) * 10) / 10 : 0;
                    if (avg !== (+app.rating || 0) || n !== (app.reviewCount || 0)) {
                        return db.ref('apps/' + app.id).update({ rating: avg, reviewCount: n });
                    }
                }).catch(() => { ratingSynced[app.id] = false; });
            });
        }

        function loadApps() {
            showLoading(true, 'Loading apps...');
            db.ref('apps').on('value', snapshot => {
                const data = snapshot.val();
                allApps = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                if (currentUser) {
                    allApps = allApps.filter(a => a.developerUid === currentUser.uid);
                }
                syncRatings();
                $('appCountBadge').textContent = allApps.length;
                if (currentPage === 'dashboard') updateDashboard();
                if (currentPage === 'myapps') renderMyApps();
                if (currentPage === 'analytics') populateAnalyticsSelect();
                if (currentPage === 'reviews') populateReviewSelect();
                showLoading(false);
            }, err => { showLoading(false);
                console.error(err); });
        }

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

            const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const monthly = allApps.reduce((s, a) => {
                if (a.downloadDate && new Date(a.downloadDate).getTime() > monthAgo) {
                    return s + (a.downloadCount || 0);
                }
                return s;
            }, 0);

            $('statTotalApps').textContent = total;
            $('statDownloads').textContent = downloads.toLocaleString();
            $('statViews').textContent = views.toLocaleString();
            $('statRating').textContent = avgRating.toFixed(1);
            $('statReviewsCount').textContent = reviews;
            $('statMonthlyDownloads').textContent = monthly.toLocaleString();
            $('statLiveApps').textContent = live;
            $('appCountBadge').textContent = total;

            // Chart dummy
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const maxHeight = 100;
            days.forEach((day, i) => {
                const val = Math.floor(Math.random() * 80 + 10);
                const el = $(`chartDay${i + 1}`);
                if (el) {
                    el.style.height = `${(val / 100) * maxHeight}%`;
                    el.title = `${day}: ${val} downloads`;
                }
            });

            const topApps = [...allApps].sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 5);
            const topList = $('topAppsList');
            topList.innerHTML = '';
            if (topApps.length === 0) {
                topList.innerHTML = '<p style="color:var(--text-gray);">No apps yet</p>';
            } else {
                topApps.forEach((app, i) => {
                    topList.innerHTML +=
                        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">
                            <span>${i + 1}. ${app.name}</span>
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

        function appMatches(app) {
            const live = (app.status === 'live' || app.status === 'approved');
            if (appStatus === 'live' && !live) return false;
            if (appStatus === 'draft' && app.status !== 'draft') return false;
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
                    'draft': { class: 'draft', label: 'Draft' }
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

        function uploadToImgBB(file) {
            return new Promise((resolve, reject) => {
                const formData = new FormData();
                formData.append('image', file);
                fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            resolve(data.data.url);
                        } else {
                            const reader = new FileReader();
                            reader.onload = e => resolve(e.target.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        }
                    })
                    .catch(() => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
            });
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
            btn.textContent = 'Publishing...';

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
                const finalStatus = status === 'draft' ? 'draft' : 'live';

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
                    timestamp: Date.now(),
                    updatedDate: new Date().toISOString().split('T')[0],
                    verified: false,
                    versionHistory: [$('upVersion').value]
                };

                db.ref('apps').push(appData).then(() => {
                    btn.textContent = 'Publish App';
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
                        alert('App saved as draft! You can publish it later.');
                    } else {
                        addNotification(`App "${appData.name}" is now LIVE on the store!`);
                        alert('App published successfully! It is now live on UptoZishu. It appears on the website within about 10 minutes.');
                    }
                    switchPage('myapps');
                }).catch(err => {
                    btn.textContent = 'Publish App';
                    alert('Upload failed: ' + err.message);
                });
            }).catch(err => {
                btn.textContent = 'Publish App';
                alert('Image upload failed: ' + err.message);
            });
        }

        // ============================================
        // VIEW APP DETAILS
        // ============================================
        function viewAppDetails(appId) {
            const app = allApps.find(a => a.id === appId);
            if (!app) return;
            let details = `Name: ${app.name}\nPackage: ${app.package}\nVersion: ${app.version}\nCategory: ${app.category}\nStatus: ${app.status}\nDownloads: ${app.downloadCount}\nViews: ${app.views}\nRating: ${app.rating}\nAPK: ${app.downloadUrl}\nSize: ${app.size}\nDescription: ${app.description}\nShort: ${app.shortDescription}\nTags: ${app.tags}\nSupport: ${app.supportEmail}\nPrivacy: ${app.privacyPolicy}\nWebsite: ${app.website}\nYouTube: ${app.youtube}\nMin Android: ${app.minAndroid}\nWhat's New: ${app.whatsNew}`;
            alert(details);
        }

        // ============================================
        // EDIT APP - Full, only file uploads (no URL fields for images)
        // ============================================
        function openEditModal(appId) {
            const app = allApps.find(a => a.id === appId);
            if (!app) return;
            editAppId = appId;
            $('editAppId').value = appId;
            $('editName').value = app.name || '';
            $('editCategory').value = app.category || 'Games';
            $('editPackage').value = app.package || '';
            $('editVersion').value = app.version || '';
            $('editShortDesc').value = app.shortDescription || '';
            $('editDeveloperName').value = app.developerName || '';
            $('editLongDesc').value = app.description || '';
            $('editApkUrl').value = app.downloadUrl || '';
            $('editSize').value = app.size || '';
            $('editTags').value = app.tags || '';
            $('editSupportEmail').value = app.supportEmail || '';
            $('editPrivacy').value = app.privacyPolicy || '';
            $('editWebsite').value = app.website || '';
            $('editYoutube').value = app.youtube || '';
            $('editMinAndroid').value = app.minAndroid || '';
            $('editPermissions').value = app.permissions || '';
            renderPermChips('edit');
            $('editWhatsNew').value = app.whatsNew || '';
            $('editStatus').value = app.status || 'live';
            // Clear previews
            $('editIconPreview').innerHTML = '';
            $('editBannerPreview').innerHTML = '';
            // Show current icon as preview if available
            if (app.icon) {
                const img = document.createElement('img');
                img.src = app.icon;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.borderRadius = '8px';
                img.style.objectFit = 'cover';
                $('editIconPreview').appendChild(img);
            }
            if (app.banner) {
                const img = document.createElement('img');
                img.src = app.banner;
                img.style.width = '120px';
                img.style.height = '60px';
                img.style.borderRadius = '8px';
                img.style.objectFit = 'cover';
                $('editBannerPreview').appendChild(img);
            }
            shotsEdit.setExisting(String(app.screenshot || '').split(',').map(s => s.trim()).filter(Boolean));
            $('editModal').classList.add('open');
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

        function saveFullEdit(e) {
            e.preventDefault();
            const id = $('editAppId').value;
            const iconFile = $('editIconFile').files[0];
            const bannerFile = $('editBannerFile').files[0];
            const screenshotFiles = $('editScreenshots').files;

            let iconUrl = null;
            let bannerUrl = null;
            let screenshotUrls = [];

            const uploadPromises = [];
            if (iconFile) uploadPromises.push(uploadToImgBB(iconFile).then(url => iconUrl = url));
            if (bannerFile) uploadPromises.push(uploadToImgBB(bannerFile).then(url => bannerUrl = url));
            uploadPromises.push(shotsEdit.resolve().then(urls => { screenshotUrls = urls; }));

            Promise.all(uploadPromises).then(() => {
                const updates = {
                    name: $('editName').value,
                    category: $('editCategory').value,
                    package: $('editPackage').value,
                    version: $('editVersion').value,
                    shortDescription: $('editShortDesc').value,
                    developerName: ($('editDeveloperName').value || '').trim() || profileDevName(),
                    description: $('editLongDesc').value,
                    downloadUrl: $('editApkUrl').value,
                    size: $('editSize').value,
                    tags: $('editTags').value,
                    supportEmail: $('editSupportEmail').value,
                    privacyPolicy: $('editPrivacy').value,
                    website: $('editWebsite').value,
                    youtube: $('editYoutube').value,
                    minAndroid: $('editMinAndroid').value,
                    permissions: $('editPermissions').value.trim(),
                    whatsNew: $('editWhatsNew').value,
                    status: $('editStatus').value,
                    updatedDate: new Date().toISOString().split('T')[0]
                };
                // Only update images if new files were uploaded
                if (iconUrl) updates.icon = iconUrl;
                if (bannerUrl) updates.banner = bannerUrl;
                updates.screenshot = screenshotUrls.join(','); // full ordered list (removed screenshots are gone, new ones are added)

                db.ref(`apps/${id}`).update(updates).then(() => {
                    addActivityLog(`App "${updates.name}" fully edited`);
                    addNotification(`App "${updates.name}" updated successfully!`);
                    closeEditModal();
                    renderMyApps();
                    alert('App updated successfully!');
                });
            }).catch(err => {
                alert('Image upload failed: ' + err.message);
            });
        }

        // ============================================
        // UPDATE APP
        // ============================================
        function openUpdateModal(appId) {
            const app = allApps.find(a => a.id === appId);
            if (!app) return;
            updateAppId = appId;
            $('updateAppId').value = appId;
            $('updateVersion').value = '';
            $('updateApkUrl').value = '';
            $('updateWhatsNew').value = '';
            $('updateModal').classList.add('open');
        }

        function closeUpdateModal() {
            $('updateModal').classList.remove('open');
        }

        function submitUpdate(e) {
            e.preventDefault();
            const id = $('updateAppId').value;
            const version = $('updateVersion').value;
            const apkUrl = $('updateApkUrl').value;
            const whatsNew = $('updateWhatsNew').value;

            const app = allApps.find(a => a.id === id);
            if (!app) return;

            const history = app.versionHistory || [];
            if (app.version) history.push(app.version);

            db.ref(`apps/${id}`).update({
                version: version,
                downloadUrl: apkUrl,
                whatsNew: whatsNew,
                status: 'live',
                versionHistory: history,
                updatedDate: new Date().toISOString().split('T')[0]
            }).then(() => {
                addActivityLog(`Update for "${app.name}" to v${version} published`);
                addNotification(`Update for "${app.name}" is now LIVE!`);
                closeUpdateModal();
                renderMyApps();
                alert('Update published successfully!');
            });
        }

        // ============================================
        // DELETE APP
        // ============================================
        function deleteApp(appId) {
            if (!confirm('Delete this app permanently? This cannot be undone.')) return;
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
            select.innerHTML = '<option value="">Select App</option>';
            allApps.forEach(app => {
                select.innerHTML += `<option value="${app.id}">${escHtml(app.name)}</option>`;
            });
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

            container.innerHTML = `
                <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:20px;">
                    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
                        <img src="${app.icon || 'https://img.icons8.com/color/144/android-os.png'}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid var(--border-color);">
                        <div>
                            <div style="font-size:18px;font-weight:600;">${app.name}</div>
                            <div style="color:var(--text-gray);">${app.version || 'v1.0'} • ${app.category || 'General'}</div>
                        </div>
                    </div>
                    <div class="stats-grid" style="margin-bottom:16px;">
                        <div class="stat-card"><div class="stat-value">${app.downloadCount || 0}</div><div class="stat-label">Downloads</div></div>
                        <div class="stat-card"><div class="stat-value">${app.views || 0}</div><div class="stat-label">Views</div></div>
                        <div class="stat-card"><div class="stat-value">${app.rating || 'N/A'}</div><div class="stat-label">Rating</div></div>
                        <div class="stat-card"><div class="stat-value">${app.reviewCount || 0}</div><div class="stat-label">Reviews</div></div>
                    </div>
                    <div style="background:var(--bg-input);border-radius:var(--radius-sm);padding:16px;text-align:center;color:var(--text-gray);">
                        <div style="font-size:32px;margin-bottom:8px;">📊</div>
                        <p>Detailed charts will be displayed here</p>
                        <p style="font-size:13px;">Daily, Weekly, Monthly charts • Country-wise downloads</p>
                    </div>
                </div>
            `;
        }

        // ============================================
        // REVIEWS
        // ============================================
        function populateReviewSelect() {
            const select = $('reviewAppSelect');
            select.innerHTML = '<option value="">Select App</option>';
            allApps.forEach(app => {
                select.innerHTML += `<option value="${app.id}">${escHtml(app.name)}</option>`;
            });
        }

        function loadReviews() {
            const appId = $('reviewAppSelect').value;
            if (!appId) {
                $('reviewsList').innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        <h3>Select an App</h3>
                        <p>Choose an app to see its reviews.</p>
                    </div>
                `;
                return;
            }

            db.ref(`reviews/${appId}`).on('value', snapshot => {
                const data = snapshot.val();
                allReviews = data || {};
                renderReviews();
            });
        }

        function renderReviews() {
            const container = $('reviewsList');
            container.innerHTML = '';

            let allRev = [];
            const appId = $('reviewAppSelect').value;
            if (appId && allReviews[appId]) {
                Object.keys(allReviews[appId]).forEach(revId => {
                    const rev = allReviews[appId][revId];
                    allRev.push({ ...rev, id: revId, appId: appId });
                });
            }

            if (currentReviewFilter !== 'all') {
                const star = parseInt(currentReviewFilter);
                allRev = allRev.filter(r => Math.round(r.rating || 5) === star);
            }

            if (allRev.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        <h3>No Reviews</h3>
                        <p>This app doesn't have any reviews yet.</p>
                    </div>
                `;
                return;
            }

            allRev.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(rev => {
                let stars = '';
                for (let i = 0; i < 5; i++) stars += i < Math.round(rev.rating || 5) ? '★' : '☆';
                const div = document.createElement('div');
                div.className = 'review-item';
                div.innerHTML = `
                    <div class="rev-head">
                        <span class="rev-user">${rev.author || 'Anonymous'}</span>
                        <span class="rev-stars">${stars}</span>
                    </div>
                    <div class="rev-text">${rev.text || ''}</div>
                    ${rev.reply ? `<div class="dev-reply"><strong>Developer Reply:</strong> ${rev.reply}</div>` : ''}
                    <div class="rev-reply">
                        <input type="text" placeholder="Reply to this review..." id="replyInput_${rev.id}" />
                        <button onclick="submitReply('${rev.appId}','${rev.id}')">Reply</button>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function filterReviews(star) {
            currentReviewFilter = star;
            document.querySelectorAll('.review-filter button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.star == star);
            });
            renderReviews();
        }

        function submitReply(appId, revId) {
            const input = $(`replyInput_${revId}`);
            if (!input || !input.value.trim()) return;
            const replyText = input.value.trim();

            db.ref(`reviews/${appId}/${revId}/reply`).set(replyText).then(() => {
                input.value = '';
                addNotification('Reply sent successfully!');
                renderReviews();
            });
        }

        // ============================================
        // NOTIFICATIONS
        // ============================================
        function loadNotifications() {
            if (!currentUser) return;
            db.ref(`notifications/${currentUser.uid}`).on('value', snapshot => {
                const data = snapshot.val();
                allNotifications = data ? Object.values(data).sort((a, b) => b.timestamp - a.timestamp) : [];
                $('notifBadge').textContent = allNotifications.filter(n => !n.read).length;
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
            if (allNotifications.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
                        <h3>No Notifications</h3>
                        <p>You're all caught up!</p>
                    </div>
                `;
                return;
            }
            allNotifications.forEach(n => {
                const div = document.createElement('div');
                div.className = 'notif-item';
                div.innerHTML = `
                    <div class="notif-icon">
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                    </div>
                    <div class="notif-text">${n.text}</div>
                    <div class="notif-time">${new Date(n.timestamp).toLocaleDateString()}</div>
                `;
                container.appendChild(div);
            });
            if (allNotifications.length > 0) {
                db.ref(`notifications/${currentUser.uid}`).once('value').then(snap => {
                    const data = snap.val();
                    if (data) {
                        Object.keys(data).forEach(key => {
                            db.ref(`notifications/${currentUser.uid}/${key}/read`).set(true);
                        });
                    }
                });
            }
            $('notifBadge').textContent = 0;
        }

        // ============================================
        // ACTIVITY LOG
        // ============================================
        function addActivityLog(action) {
            activityLog.unshift({ action, timestamp: Date.now() });
            if (activityLog.length > 100) activityLog.pop();
            localStorage.setItem('stardust_activity_log', JSON.stringify(activityLog));
        }

        function viewActivityLog() {
            if (activityLog.length === 0) {
                alert('No activity logged yet.');
                return;
            }
            let msg = 'Recent Activity:\n\n';
            activityLog.slice(0, 20).forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                msg += `• ${date}: ${log.action}\n`;
            });
            alert(msg);
        }

        function viewDrafts() {
            const draftKeys = Object.keys(drafts);
            if (draftKeys.length === 0) {
                alert('No drafts saved.');
                return;
            }
            let msg = 'Saved Drafts:\n\n';
            draftKeys.forEach(key => {
                const d = drafts[key];
                msg += `• ${d.name || 'Untitled'} (Step ${d.step || 1})\n`;
            });
            msg += '\nClick "Upload App" to continue your draft.';
            alert(msg);
        }

        // ============================================
        // PROFILE
        // ============================================
        function loadProfile() {
            if (!currentUser) return;
            db.ref(`developers/${currentUser.uid}`).once('value').then(snap => {
                const data = snap.val() || {};
                $('profName').value = data.displayName || currentUser.displayName || '';
                $('profBio').value = data.bio || '';
                $('profWebsite').value = data.website || '';
                $('profGithub').value = data.github || '';
                $('profEmail').value = data.supportEmail || currentUser.email || '';
                $('profCountry').value = data.country || '';
                if (data.photoURL) {
                    $('profilePfpPreview').src = data.photoURL;
                }
            });
        }

        function previewProfilePfp(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = e => {
                    $('profilePfpPreview').src = e.target.result;
                    window._tempPfp = e.target.result;
                };
                reader.readAsDataURL(input.files[0]);
            }
        }

        function saveProfile() {
            if (!currentUser) return;
            const data = {
                displayName: $('profName').value,
                bio: $('profBio').value,
                website: $('profWebsite').value,
                github: $('profGithub').value,
                supportEmail: $('profEmail').value,
                country: $('profCountry').value,
                updatedAt: Date.now()
            };
            if (window._tempPfp) {
                data.photoURL = window._tempPfp;
                window._tempPfp = null;
            }
            db.ref(`developers/${currentUser.uid}`).update(data).then(() => {
                if (data.displayName) {
                    currentUser.updateProfile({ displayName: data.displayName });
                }
                addNotification('Profile updated successfully!');
                alert('Profile saved!');
                loadProfile();
            });
        }

        // ============================================
        // SETTINGS
        // ============================================
        function changePassword() {
            const currentPw = prompt('Enter current password:');
            if (!currentPw) return;
            const newPw = prompt('Enter new password (min 6 chars):');
            if (!newPw || newPw.length < 6) { alert('Password must be at least 6 characters.'); return; }
            const confirmPw = prompt('Confirm new password:');
            if (newPw !== confirmPw) { alert('Passwords do not match.'); return; }

            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
            user.reauthenticateWithCredential(credential).then(() => {
                user.updatePassword(newPw).then(() => {
                    addNotification('Password changed successfully!');
                    alert('Password changed!');
                }).catch(err => alert('Error: ' + err.message));
            }).catch(err => alert('Current password is incorrect.'));
        }

        function changeEmail() {
            const newEmail = prompt('Enter new email address:');
            if (!newEmail || !newEmail.includes('@')) { alert('Invalid email address.'); return; }
            const user = auth.currentUser;
            user.updateEmail(newEmail).then(() => {
                db.ref(`developers/${user.uid}/email`).set(newEmail);
                addNotification('Email updated successfully!');
                alert('Email updated!');
                $('userDisplayEmail').textContent = newEmail;
            }).catch(err => alert('Error: ' + err.message));
        }

        function deleteAccount() {
            if (!confirm('Are you sure you want to delete your account? This cannot be undone!')) return;
            if (!confirm('All your apps and data will be permanently deleted. Continue?')) return;

            const user = auth.currentUser;
            db.ref(`developers/${user.uid}`).remove();
            db.ref(`notifications/${user.uid}`).remove();
            allApps.forEach(app => {
                if (app.developerUid === user.uid) {
                    db.ref(`apps/${app.id}`).remove();
                }
            });
            user.delete().then(() => {
                localStorage.removeItem('stardust_uid');
                alert('Account deleted successfully.');
                leaving = true;
                location.replace('/auth/');
            }).catch(err => {
                alert('Error deleting account: ' + err.message);
            });
        }

        function changeLanguage() {
            const lang = prompt('Select language (en, hi, es, fr, de):', 'en');
            if (lang) {
                localStorage.setItem('stardust_lang', lang);
                addNotification(`Language changed to ${lang}`);
                alert(`Language set to ${lang}`);
            }
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
