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
function joinChat(code) {
    if (!code || code.length < 4) {
        alert('Please enter a valid chat code (at least 4 characters)');
        return;
    }
    
    currentChatCode = code.toUpperCase();
    activeCodeSpan.textContent = currentChatCode;
    
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

joinBtn.addEventListener('click', () => {
    const code = chatCodeInput.value.trim();
    joinChat(code);
});

chatCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const code = chatCodeInput.value.trim();
        joinChat(code);
    }
});

// Leave chat
leaveBtn.addEventListener('click', () => {
    if (messagesRef) {
        messagesRef.off();
    }
    
    currentChatCode = null;
    chatPage.classList.add('hidden');
    landingPage.classList.remove('hidden');
    chatCodeInput.value = '';
    generatedCodeDiv.classList.add('hidden');
    messageInput.value = '';
});

// Send message
function sendMessage() {
    const text = messageInput.value.trim();
    
    if (!text || !currentChatCode) return;
    
    const message = {
        text: text,
        userId: currentUserId,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Push message to database
    database.ref(`chats/${currentChatCode}/messages`).push(message)
        .then(() => {
            messageInput.value = '';
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

// Listen for messages
function listenForMessages() {
    if (!currentChatCode) return;
    
    messagesRef = database.ref(`chats/${currentChatCode}/messages`);
    
    // Listen for new messages
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
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
    
    const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    }) : 'Now';
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <p class="message-text">${escapeHtml(message.text)}</p>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

