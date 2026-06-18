import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A',
    authDomain: 'mattedev-account.firebaseapp.com',
    projectId: 'mattedev-account',
    storageBucket: 'mattedev-account.firebasestorage.app',
    messagingSenderId: '77268069903',
    appId: '1:77268069903:web:040aa6c3981eb3650afd7a'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const LOGIN_PAGE = '/pages/login.html';
const VERIFY_PAGE = '/pages/emailverify.html';
const DASHBOARD_PAGE = '/dashboard.html';

function avatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=ffffff&bold=true`;
}

function friendlyAuthError(err) {
    const code = err?.code || '';
    const messages = {
        'auth/invalid-email': 'Inserisci un indirizzo email valido.',
        'auth/user-not-found': 'Nessun account trovato con questa email.',
        'auth/wrong-password': 'Password non corretta.',
        'auth/invalid-credential': 'Credenziali non valide.',
        'auth/email-already-in-use': 'Esiste già un account con questa email.',
        'auth/weak-password': 'La password deve contenere almeno 6 caratteri.',
        'auth/network-request-failed': 'Controlla la connessione e riprova.'
    };

    return messages[code] || 'Si è verificato un errore. Riprova tra poco.';
}

function setPageMessage(targetId, text, type) {
    const el = document.getElementById(targetId);
    if (!el) return;

    if (!text) {
        el.className = 'msg';
        el.textContent = '';
        return;
    }

    el.className = `msg ${type}`;
    el.textContent = text;
}

function getAuthMode() {
    return window.__authMode === 'register' ? 'register' : 'login';
}

function syncAuthUI(isLogin) {
    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSub');
    const btn = document.getElementById('authBtn');
    const userWrapper = document.getElementById('usernameWrapper');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const password = document.getElementById('password');

    if (!title || !sub || !btn || !userWrapper || !tabLogin || !tabRegister || !password) return;

    window.__authMode = isLogin ? 'login' : 'register';
    setPageMessage('authMsg', '');

    if (isLogin) {
        title.textContent = 'Bentornato';
        sub.textContent = 'Accedi al tuo account per continuare.';
        btn.textContent = 'Accedi';
        password.autocomplete = 'current-password';
        userWrapper.className = 'field-group hidden';
        tabLogin.className = 'tab-btn active';
        tabRegister.className = 'tab-btn';
    } else {
        title.textContent = 'Crea account';
        sub.textContent = 'Unisciti a MatteDev in un minuto.';
        btn.textContent = 'Registrati';
        password.autocomplete = 'new-password';
        userWrapper.className = 'field-group visible';
        tabLogin.className = 'tab-btn';
        tabRegister.className = 'tab-btn active';
    }
}

window.handleAuth = async () => {
    const emailField = document.getElementById('email');
    const passField = document.getElementById('password');
    const userField = document.getElementById('username');
    const authBtn = document.getElementById('authBtn');

    if (!emailField || !passField || !authBtn) return;

    const email = emailField.value.trim();
    const pass = passField.value;
    const isLogin = getAuthMode() === 'login';
    const username = userField?.value?.trim();
    const originalLabel = authBtn.textContent || (isLogin ? 'Accedi' : 'Registrati');

    if (!email || !pass) {
        setPageMessage('authMsg', 'Compila tutti i campi obbligatori.', 'error');
        return;
    }

    if (!isLogin && !username) {
        setPageMessage('authMsg', 'Inserisci un username per registrarti.', 'error');
        return;
    }

    if (pass.length < 6) {
        setPageMessage('authMsg', 'La password deve essere di almeno 6 caratteri.', 'error');
        return;
    }

    try {
        authBtn.disabled = true;
        authBtn.innerHTML = `<span class="spinner"></span>${isLogin ? 'Accesso...' : 'Registrazione...'}`;
        setPageMessage('authMsg', '');

        if (isLogin) {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            if (!user.emailVerified) {
                setPageMessage('authMsg', 'Abbiamo trovato l’account, ma manca la verifica email.', 'info');
                window.location.href = VERIFY_PAGE;
                return;
            }

            window.location.href = DASHBOARD_PAGE;
            return;
        }

        const displayName = username || email.split('@')[0];
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        const photoURL = avatarUrl(displayName);

        await updateProfile(user, {
            displayName,
            photoURL
        });

        await setDoc(doc(db, 'users', user.uid), {
            username: displayName,
            email,
            pfp: photoURL,
            bio: '',
            isPrivate: false,
            prefCity: '',
            prefUnits: 'metric',
            uid: user.uid,
            createdAt: serverTimestamp()
        });

        await sendEmailVerification(user);
        window.location.href = VERIFY_PAGE;
    } catch (err) {
        setPageMessage('authMsg', friendlyAuthError(err), 'error');
    } finally {
        authBtn.disabled = false;
        authBtn.textContent = originalLabel;
    }
};

window.setMode = (isLogin) => {
    syncAuthUI(isLogin);
};

window.resendVerification = async () => {
    if (!auth.currentUser) {
        setPageMessage('verifyMsg', 'Accedi di nuovo per reinviare l’email.', 'error');
        window.location.href = LOGIN_PAGE;
        return;
    }

    try {
        await sendEmailVerification(auth.currentUser);
        setPageMessage('verifyMsg', 'Email di verifica reinviata.', 'success');
    } catch (err) {
        setPageMessage('verifyMsg', 'Attendi qualche minuto prima di richiedere un nuovo invio.', 'error');
    }
};

onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    const isAuthPage = path.includes('/pages/login.html');
    const isVerifyPage = path.includes('/pages/emailverify.html');

    if (user) {
        if (!user.emailVerified) {
            if (!isVerifyPage) {
                window.location.href = VERIFY_PAGE;
            }
            return;
        }

        if (isAuthPage || isVerifyPage) {
            window.location.href = DASHBOARD_PAGE;
        }
        return;
    }

    if (!isAuthPage && !isVerifyPage && path !== '/' && !path.includes('index.html')) {
        window.location.href = LOGIN_PAGE;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', window.handleAuth);
        if (document.getElementById('authTitle')) {
            window.setMode(true);
        }
    }

    const resendBtn = document.getElementById('resendEmail');
    if (resendBtn) resendBtn.addEventListener('click', window.resendVerification);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Vuoi uscire?')) {
                await signOut(auth);
                window.location.href = LOGIN_PAGE;
            }
        });
    }
});
