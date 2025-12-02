// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtvlQIneKnWVeu6wYNhbX8rqnUl_Tc6C0",
    authDomain: "chat-simulation-9278a.firebaseapp.com",
    databaseURL: "https://chat-simulation-9278a-default-rtdb.firebaseio.com",
    projectId: "chat-simulation-9278a",
    storageBucket: "chat-simulation-9278a.firebasestorage.app",
    messagingSenderId: "813202972709",
    appId: "1:813202972709:web:3d27725700a91df81c5fcc",
    measurementId: "G-65RF98B9BM"
};

// Initialize Firebase
let database;
let currentChatCode = null;
let currentUserId = null;
let messagesRef = null;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch (error) {
    console.error("Firebase initialization error:", error);
    alert("Firebase not configured. Please add your Firebase configuration to app.js");
}

// Generate random user ID
currentUserId = 'user_' + Math.random().toString(36).substr(2, 9);

// DOM Elements
const landingPage = document.getElementById('landing-page');
const chatPage = document.getElementById('chat-page');
const chatCodeInput = document.getElementById('chat-code-input');
const joinBtn = document.getElementById('join-btn');
const generateBtn = document.getElementById('generate-btn');
const generatedCodeDiv = document.getElementById('generated-code');
const codeValue = document.getElementById('code-value');
const copyBtn = document.getElementById('copy-btn');
const leaveBtn = document.getElementById('leave-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const activeCodeSpan = document.getElementById('active-code');
const roleBadge = document.getElementById('role-badge');
const adminPanel = document.getElementById('admin-panel');
const transcriptList = document.getElementById('transcript-list');
const exportTranscriptBtn = document.getElementById('export-transcript-btn');
const typingInsights = document.getElementById('typing-insights');

const TYPING_IDLE_TIMEOUT = 2000;

let currentRole = 'agent';
let transcriptEntries = [];
let lastMessageTimestamp = null;
let statusRef = null;
let statusMonitorRef = null;
let adminMetadataRef = null;
let adminOnDisconnect = null;

const typingSession = {
    startedAt: null,
    lastLength: 0,
    charCount: 0,
    clipboardUsed: false,
    idleTimer: null,
    wpm: 0,
    active: false
};

const COMMON_WORDS = new Set([
    'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at',
    'this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there',
    'their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no',
    'just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then',
    'now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first',
    'well','way','even','new','want','because','any','these','give','day','most','us','more','need','feel','high',
    'between','place','still','try','call','last','long','great','own','leave','help','talk','turn','start','might',
    'show','hear','play','live','believe','hold','bring','happen','must','write','provide','sit','stand','lose','pay',
    'meet','include','continue','set','learn','change','lead','understand','watch','follow','stop','create','speak',
    'read','allow','add','spend','grow','open','walk','win','offer','remember','love','consider','appear','buy','wait',
    'serve','die','send','expect','build','stay','fall','cut','reach','kill','remain','agent','admin','chat','message',
    'code','generate','join','leave','reply','speed','typing','panel','monitor','transcript','export','error',
    'clipboard','detect','highlight','window','large','conversation','minutes','seconds','status','online','offline',
    'monitoring','analysis','support','team','customer','task','keyboard','shortcut','copy','paste','grammar','spelling'
]);

const KNOWN_SUFFIXES = ['ing','ed','ly','tion','s','es','ment','ness','able','ible','ful','less','ers','er','ally','ous','ive','est'];

if (exportTranscriptBtn) {
    exportTranscriptBtn.addEventListener('click', () => {
        if (currentRole !== 'admin') {
            alert('Only admins can export the transcript.');
            return;
        }
        exportTranscript();
    });
}

// Role helpers
async function assignRoleForChat() {
    if (!database || !currentChatCode) return 'agent';
    adminMetadataRef = database.ref(`chats/${currentChatCode}/metadata/adminId`);
    try {
        const result = await adminMetadataRef.transaction((currentValue) => currentValue || currentUserId);
        const assignedAdminId = result.snapshot && result.snapshot.val();
        if (assignedAdminId === currentUserId) {
            setupAdminOnDisconnect();
            return 'admin';
        }
        cleanupAdminOnDisconnect();
        adminMetadataRef = null;
        return 'agent';
    } catch (error) {
        console.error('Unable to assign admin role:', error);
        adminMetadataRef = null;
        cleanupAdminOnDisconnect();
        return 'agent';
    }
}

function setupAdminOnDisconnect() {
    cleanupAdminOnDisconnect();
    if (!adminMetadataRef) return;
    try {
        adminOnDisconnect = adminMetadataRef.onDisconnect();
        adminOnDisconnect.remove();
    } catch (error) {
        console.warn('Failed to register admin onDisconnect handler', error);
    }
}

function cleanupAdminOnDisconnect() {
    if (adminOnDisconnect) {
        try {
            adminOnDisconnect.cancel();
        } catch (error) {
            console.warn('Failed to cancel onDisconnect handler', error);
        }
    }
    adminOnDisconnect = null;
}

async function releaseAdminRoleIfOwned() {
    if (currentRole !== 'admin' || !adminMetadataRef) return;
    try {
        await adminMetadataRef.transaction((currentValue) => currentValue === currentUserId ? null : currentValue);
    } catch (error) {
        console.warn('Unable to release admin role:', error);
    }
    cleanupAdminOnDisconnect();
    adminMetadataRef = null;
}

function updateRoleUI() {
    if (roleBadge) {
        roleBadge.textContent = `Role: ${currentRole.charAt(0).toUpperCase()}${currentRole.slice(1)}`;
    }
    if (chatPage) {
        chatPage.classList.toggle('admin-mode', currentRole === 'admin');
    }
    if (adminPanel) {
        adminPanel.classList.toggle('hidden', currentRole !== 'admin');
    }
    if (exportTranscriptBtn) {
        exportTranscriptBtn.disabled = currentRole !== 'admin';
    }
    if (currentRole !== 'admin' && transcriptList) {
        transcriptList.classList.add('empty-state');
        transcriptList.innerHTML = '<p>Transcript is only visible to the admin.</p>';
    }
}

function resetTranscriptState() {
    transcriptEntries = [];
    lastMessageTimestamp = null;
    if (transcriptList) {
        transcriptList.classList.add('empty-state');
        transcriptList.innerHTML = currentRole === 'admin'
            ? '<p>Transcript will appear once messages arrive.</p>'
            : '<p>Transcript is only visible to the admin.</p>';
    }
}

// Generate random chat code
function generateChatCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Show generated code
generateBtn.addEventListener('click', () => {
    const code = generateChatCode();
    codeValue.textContent = code;
    chatCodeInput.value = code;
    generatedCodeDiv.classList.remove('hidden');
});

// Copy code to clipboard
copyBtn.addEventListener('click', async () => {
    const code = codeValue.textContent;
    try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = '✓';
        setTimeout(() => {
            copyBtn.textContent = '📋';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
});

// Join chat room
async function joinChat(code) {
    if (!code || code.length < 4) {
        alert('Please enter a valid chat code (at least 4 characters)');
        return;
    }
    
    teardownStatusTracking();
    
    currentChatCode = code.toUpperCase();
    activeCodeSpan.textContent = currentChatCode;
    currentRole = await assignRoleForChat();
    updateRoleUI();
    resetTranscriptState();
    resetTypingSession(true);
    setupStatusTracking();
    
    // Switch to chat interface
    landingPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    
    // Clear previous messages
    messagesContainer.innerHTML = '<div class="welcome-message"><p>🎉 Welcome to the chat!</p><p class="small">Share your code with someone to start chatting</p></div>';
    
    // Listen for messages
    listenForMessages();
    
    // Focus on message input
    messageInput.focus();
}

function requestJoin() {
    const code = chatCodeInput.value.trim();
    joinChat(code).catch((error) => {
        console.error('Failed to join chat:', error);
        alert('Unable to join the chat right now. Please try again.');
    });
}

joinBtn.addEventListener('click', requestJoin);

chatCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        requestJoin();
    }
});

// Leave chat
async function leaveChat() {
    if (messagesRef) {
        messagesRef.off();
        messagesRef = null;
    }
    
    await releaseAdminRoleIfOwned();
    teardownStatusTracking();
    currentRole = 'agent';
    updateRoleUI();
    resetTranscriptState();
    resetTypingSession(true);
    
    currentChatCode = null;
    chatPage.classList.add('hidden');
    landingPage.classList.remove('hidden');
    chatCodeInput.value = '';
    generatedCodeDiv.classList.add('hidden');
    messageInput.value = '';
    messagesContainer.innerHTML = '<div class="welcome-message"><p>🎉 Welcome to the chat!</p><p class="small">Share your code with someone to start chatting</p></div>';
}

leaveBtn.addEventListener('click', () => {
    leaveChat().catch((error) => {
        console.error('Error leaving chat:', error);
    });
});

// Send message
function sendMessage() {
    const text = messageInput.value.trim();
    
    if (!text || !currentChatCode) return;
    
    const metrics = collectMessageMetrics(text);
    const message = {
        text: text,
        userId: currentUserId,
        userRole: currentRole,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        metrics
    };
    
    // Push message to database
    database.ref(`chats/${currentChatCode}/messages`).push(message)
        .then(() => {
            messageInput.value = '';
            resetTypingSession();
        })
        .catch((error) => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please check your Firebase configuration.');
        });
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

messageInput.addEventListener('input', handleTypingInput);
messageInput.addEventListener('focus', () => {
    if (messageInput.value.length) {
        startTypingSession();
    }
});
messageInput.addEventListener('blur', () => {
    scheduleTypingIdleState(false);
});

['paste', 'copy', 'cut'].forEach((evt) => {
    messageInput.addEventListener(evt, () => flagClipboardUsage(evt));
});

messageInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && ['v', 'c', 'x'].includes(event.key.toLowerCase())) {
        flagClipboardUsage('shortcut');
    }
});

// Listen for messages
function listenForMessages() {
    if (!currentChatCode) return;
    
    messagesRef = database.ref(`chats/${currentChatCode}/messages`);
    
    // Listen for new messages
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (!message) return;
        message.id = snapshot.key;
        displayMessage(message);
    });
}

// Display message in chat
function displayMessage(message) {
    // Remove welcome message if it exists
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.userId === currentUserId ? 'sent' : 'received'}`;
    const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
    const replyDeltaMs = lastMessageTimestamp ? timestamp - lastMessageTimestamp : 0;
    lastMessageTimestamp = timestamp;
    const time = new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    const normalizedRole = message.userRole 
        || (message.userId === currentUserId ? currentRole : currentRole === 'admin' ? 'agent' : 'admin');
    const roleLabel = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
    const shouldShowMetrics = currentRole === 'admin' && normalizedRole === 'agent';
    const metricsParts = [];
    if (shouldShowMetrics && message.metrics) {
        if (message.metrics.typingSpeedWpm) {
            metricsParts.push(`${Math.round(message.metrics.typingSpeedWpm)} wpm`);
        }
        if (message.metrics.typingDurationMs) {
            metricsParts.push(`typed for ${formatDuration(message.metrics.typingDurationMs)}`);
        }
        if (message.metrics.clipboardUsed) {
            metricsParts.push('<span class="clipboard-flag" title="Copy/paste detected">📋</span>');
        }
    }
    const metricsHtml = metricsParts.length ? `<div class="message-time">${metricsParts.join(' • ')}</div>` : '';
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-meta">
                <span class="message-role">${roleLabel}</span>
                <span>${time}</span>
            </div>
            <p class="message-text">${escapeHtml(message.text)}</p>
            <div class="message-time">Reply time: +${formatDuration(replyDeltaMs || 0)}</div>
            ${metricsHtml}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    recordTranscriptEntry(message, replyDeltaMs);
}

function setupStatusTracking() {
    if (!database || !currentChatCode) return;
    
    statusRef = database.ref(`chats/${currentChatCode}/status/${currentUserId}`);
    statusRef.set({
        role: currentRole,
        typing: false,
        typingSpeedWpm: 0,
        clipboardUsed: false,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP
    });
    statusRef.onDisconnect().remove();
    
    if (statusMonitorRef) {
        statusMonitorRef.off();
        statusMonitorRef = null;
    }
    
    if (currentRole === 'admin') {
        statusMonitorRef = database.ref(`chats/${currentChatCode}/status`);
        statusMonitorRef.on('value', (snapshot) => {
            updateTypingInsights(snapshot.val() || {});
        });
    } else if (typingInsights) {
        typingInsights.classList.add('empty-state');
        typingInsights.innerHTML = '<p>Typing analytics are hidden for agents.</p>';
    }
}

function teardownStatusTracking() {
    if (statusRef) {
        statusRef.remove();
        statusRef = null;
    }
    if (statusMonitorRef) {
        statusMonitorRef.off();
        statusMonitorRef = null;
    }
    if (typingInsights) {
        typingInsights.classList.add('empty-state');
        typingInsights.innerHTML = '<p>No agent connected yet.</p>';
    }
}

function startTypingSession() {
    if (typingSession.active) return;
    typingSession.active = true;
    typingSession.startedAt = Date.now();
    typingSession.lastLength = messageInput.value.length;
    typingSession.charCount = 0;
    typingSession.wpm = 0;
}

function handleTypingInput() {
    if (!messageInput) return;
    if (!typingSession.active) {
        startTypingSession();
    }
    
    const currentLength = messageInput.value.length;
    const delta = Math.max(0, currentLength - typingSession.lastLength);
    typingSession.charCount += delta;
    typingSession.lastLength = currentLength;
    typingSession.wpm = calculateCurrentWpm();
    
    broadcastTypingStatus(true);
    scheduleTypingIdleState(true);
}

function calculateCurrentWpm() {
    if (!typingSession.startedAt) return 0;
    const elapsedMs = Date.now() - typingSession.startedAt;
    if (elapsedMs < 1000) return 0;
    const words = typingSession.charCount / 5;
    return Math.max(0, (words / (elapsedMs / 60000)));
}

function scheduleTypingIdleState(keepAlive) {
    if (typingSession.idleTimer) {
        clearTimeout(typingSession.idleTimer);
    }
    if (!keepAlive) {
        broadcastTypingStatus(false);
        typingSession.active = false;
        return;
    }
    typingSession.idleTimer = setTimeout(() => {
        typingSession.active = false;
        broadcastTypingStatus(false);
    }, TYPING_IDLE_TIMEOUT);
}

function flagClipboardUsage() {
    typingSession.clipboardUsed = true;
    if (currentRole === 'agent') {
        broadcastTypingStatus(typingSession.active);
    }
}

function resetTypingSession(forceSilent = false) {
    typingSession.startedAt = null;
    typingSession.lastLength = 0;
    typingSession.charCount = 0;
    typingSession.clipboardUsed = false;
    typingSession.active = false;
    typingSession.wpm = 0;
    if (typingSession.idleTimer) {
        clearTimeout(typingSession.idleTimer);
        typingSession.idleTimer = null;
    }
    if (!forceSilent) {
        broadcastTypingStatus(false);
    }
}

function broadcastTypingStatus(isTyping) {
    if (!statusRef) return;
    const payload = {
        lastUpdate: firebase.database.ServerValue.TIMESTAMP
    };
    if (currentRole === 'agent') {
        payload.typing = Boolean(isTyping && typingSession.lastLength > 0);
        payload.typingSpeedWpm = Math.round(typingSession.wpm || 0);
        payload.clipboardUsed = typingSession.clipboardUsed;
    }
    statusRef.update(payload);
}

function collectMessageMetrics(text) {
    const now = Date.now();
    const duration = typingSession.startedAt ? now - typingSession.startedAt : 0;
    const charCount = text.length;
    let wpm = 0;
    if (duration > 0) {
        wpm = Math.max(0, (charCount / 5) / (duration / 60000));
    } else if (typingSession.wpm) {
        wpm = typingSession.wpm;
    }
    const metrics = {
        typingDurationMs: duration,
        charCount,
        typingSpeedWpm: Number(wpm.toFixed(1)),
        clipboardUsed: typingSession.clipboardUsed
    };
    return metrics;
}

function recordTranscriptEntry(message, replyDeltaMs) {
    if (currentRole !== 'admin' || !transcriptList) return;
    const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
    const derivedRole = (message.userRole || (message.userId === currentUserId ? currentRole : currentRole === 'admin' ? 'agent' : 'admin')).toLowerCase();
    const entry = {
        id: message.id || `${timestamp}-${Math.random()}`,
        role: derivedRole.toUpperCase(),
        text: message.text,
        timestamp,
        replyDeltaMs,
        metrics: message.metrics || {},
        issues: derivedRole === 'agent' ? analyzeTextForIssues(message.text) : { spelling: [], grammar: [] }
    };
    entry.highlightedText = highlightTextWithIssues(message.text, entry.issues);
    transcriptEntries.push(entry);
    renderTranscriptEntry(entry);
}

function analyzeTextForIssues(text) {
    if (!text) return { spelling: [], grammar: [] };
    const normalized = text.toLowerCase();
    const words = normalized.match(/[a-z']+/g) || [];
    const spellingIssues = new Set();
    
    words.forEach((word) => {
        const stripped = word.replace(/'s$/, '');
        if (stripped.length < 4) return;
        if (COMMON_WORDS.has(stripped)) return;
        if (COMMON_WORDS.has(stripped.replace(/(ing|ed|ly|tion|s|es)$/, ''))) return;
        for (const suffix of KNOWN_SUFFIXES) {
            if (stripped.endsWith(suffix) && COMMON_WORDS.has(stripped.slice(0, -suffix.length))) {
                return;
            }
        }
        spellingIssues.add(stripped);
    });
    
    const grammarIssues = new Set();
    if (/[a-z]/i.test(text)) {
        const trimmed = text.trim();
        if (trimmed && !/[.!?)]$/.test(trimmed)) {
            grammarIssues.add('Missing ending punctuation');
        }
        if (/\s{2,}/.test(text)) {
            grammarIssues.add('Extra spacing detected');
        }
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        sentences.forEach((sentence) => {
            const firstChar = sentence.trim()[0];
            if (firstChar && /[a-z]/.test(firstChar) && firstChar === firstChar.toLowerCase()) {
                grammarIssues.add('Sentence should start with a capital letter');
            }
        });
    }
    
    return {
        spelling: Array.from(spellingIssues),
        grammar: Array.from(grammarIssues)
    };
}

function highlightTextWithIssues(text, issues) {
    const escaped = escapeHtml(text);
    let highlighted = escaped;
    if (issues.spelling && issues.spelling.length) {
        issues.spelling.forEach((word) => {
            const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
            highlighted = highlighted.replace(regex, (match) => `<span class="issue-highlight" title="Possible spelling issue">${match}</span>`);
        });
    }
    return highlighted;
}

function renderTranscriptEntry(entry) {
    if (!transcriptList) return;
    if (transcriptList.classList.contains('empty-state')) {
        transcriptList.classList.remove('empty-state');
        transcriptList.innerHTML = '';
    }
    
    const container = document.createElement('div');
    container.className = `transcript-entry ${entry.role.toLowerCase()}`;
    const metaParts = [
        `<strong>${entry.role}</strong>`,
        `<span>${formatTimestamp(entry.timestamp)}</span>`,
        `<span>+${formatDuration(entry.replyDeltaMs || 0)}</span>`
    ];
    
    if (entry.metrics && entry.metrics.typingSpeedWpm) {
        metaParts.push(`<span class="badge">${Math.round(entry.metrics.typingSpeedWpm)} WPM</span>`);
    }
    if (entry.metrics && entry.metrics.clipboardUsed) {
        metaParts.push('<span class="badge warning">Clipboard</span>');
    }
    
    container.innerHTML = `
        <div class="transcript-meta">${metaParts.join(' ')}</div>
        <div class="transcript-text">${entry.highlightedText}</div>
        ${renderIssueNotes(entry)}
    `;
    
    transcriptList.appendChild(container);
    transcriptList.scrollTop = transcriptList.scrollHeight;
}

function renderIssueNotes(entry) {
    const notes = [];
    if (entry.issues.spelling.length) {
        notes.push(`Spelling: ${entry.issues.spelling.join(', ')}`);
    }
    if (entry.issues.grammar.length) {
        notes.push(`Grammar: ${entry.issues.grammar.join(', ')}`);
    }
    if (!notes.length) return '';
    return `<div class="transcript-issues">${notes.join(' • ')}</div>`;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDuration(ms) {
    if (!ms || ms < 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingSeconds = seconds % 60;
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${Math.max(1, remainingSeconds)}s`;
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function exportTranscript() {
    if (!transcriptEntries.length) {
        alert('No transcript data to export yet.');
        return;
    }
    const lines = transcriptEntries.map((entry) => {
        const tags = [];
        if (entry.metrics.typingSpeedWpm) {
            tags.push(`${Math.round(entry.metrics.typingSpeedWpm)}wpm`);
        }
        if (entry.metrics.clipboardUsed) {
            tags.push('clipboard');
        }
        if (entry.issues.spelling.length) {
            tags.push(`spelling:${entry.issues.spelling.join('|')}`);
        }
        if (entry.issues.grammar.length) {
            tags.push(`grammar:${entry.issues.grammar.join('|')}`);
        }
        return `[${formatTimestamp(entry.timestamp)}] ${entry.role} (+${formatDuration(entry.replyDeltaMs || 0)})${tags.length ? ` [${tags.join(', ')}]` : ''} ${entry.text}`;
    }).join('\n');
    
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-transcript-${currentChatCode || 'session'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function updateTypingInsights(statusSnapshot = {}) {
    if (!typingInsights) return;
    const entries = Object.entries(statusSnapshot).filter(([, value]) => value.role === 'agent');
    if (!entries.length) {
        typingInsights.classList.add('empty-state');
        typingInsights.innerHTML = '<p>No agent connected yet.</p>';
        return;
    }
    typingInsights.classList.remove('empty-state');
    typingInsights.innerHTML = '';
    
    entries.forEach(([userId, data]) => {
        const card = document.createElement('div');
        card.className = 'insight-card';
        const typingState = data.typing ? 'typing' : 'idle';
        const statusClass = data.typing ? '' : 'idle';
        card.innerHTML = `
            <strong>Agent: ${userId}</strong>
            <div class="insight-status">
                <span class="status-dot ${statusClass}"></span>
                <span>${typingState === 'typing' ? 'Typing now' : 'Idle'}</span>
            </div>
            <div class="insight-status">
                <span>Speed:</span>
                <span>${data.typingSpeedWpm ? `${data.typingSpeedWpm} wpm` : 'n/a'}</span>
            </div>
            <div class="insight-status">
                <span>Clipboard:</span>
                <span>${data.clipboardUsed ? 'Detected' : 'Not used'}</span>
            </div>
        `;
        typingInsights.appendChild(card);
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Clean up old chats (optional - runs on page load)
// This deletes chat rooms older than 24 hours to keep database clean
function cleanupOldChats() {
    if (!database) return;
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const chatsRef = database.ref('chats');
    
    chatsRef.once('value', (snapshot) => {
        snapshot.forEach((chatSnapshot) => {
            const chatData = chatSnapshot.val();
            if (chatData.messages) {
                const messages = Object.values(chatData.messages);
                const lastMessage = messages[messages.length - 1];
                
                if (lastMessage.timestamp < oneDayAgo) {
                    chatSnapshot.ref.remove();
                }
            }
        });
    });
}

// Run cleanup on page load
window.addEventListener('load', () => {
    cleanupOldChats();
});

updateRoleUI();
resetTranscriptState();

