# Chat Widget

A beautiful, client-side chat application that allows two people to communicate using a shared authentication code.

## Features

- 🎨 Modern, beautiful UI inspired by traditional chat widgets
- 🔐 Simple code-based authentication (no login required)
- 💬 Real-time messaging
- 📱 Fully responsive design
- 🚀 Client-side only (no backend needed)
- ✨ Clean, minimal interface

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the steps
3. Once created, click on "Web" (</> icon) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 2. Enable Realtime Database

1. In your Firebase project, go to "Realtime Database" in the left menu
2. Click "Create Database"
3. Choose a location close to your users
4. Start in **test mode** for development (you can set up security rules later)

### 3. Configure the App

1. Open `app.js`
2. Replace the `firebaseConfig` object with your Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 4. Set Up Security Rules (Important!)

For production, update your Firebase Realtime Database rules:

```json
{
  "rules": {
    "chats": {
      "$chatCode": {
        ".read": true,
        ".write": true,
        "messages": {
          ".indexOn": ["timestamp"]
        }
      }
    }
  }
}
```

**Note:** The above rules allow anyone to read and write. For a production app, consider implementing more restrictive rules.

### 5. Run the App

Simply open `index.html` in a web browser. For local development, you can use:

```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx http-server
```

Then navigate to `http://localhost:8000`

## How to Use

1. **Generate a Code**: Click "Generate New Code" to create a random 6-character code
2. **Share the Code**: Share this code with the person you want to chat with
3. **Join Chat**: Both users enter the same code and click "Join Chat"
4. **Start Chatting**: Send messages in real-time!

## Features Explained

- **No Login Required**: Just enter a code and start chatting
- **Automatic Cleanup**: Old chat rooms (24+ hours) are automatically cleaned up
- **Real-time Sync**: Messages appear instantly for both users
- **Mobile Friendly**: Works great on phones and tablets
- **Copy Code**: Click the 📋 button to copy the chat code

## Browser Support

Works in all modern browsers that support:
- ES6 JavaScript
- CSS Flexbox/Grid
- Firebase SDK

## Privacy Note

- Messages are stored in Firebase Realtime Database
- Chat codes are not encrypted
- Anyone with the chat code can access the conversation
- This is meant for casual, non-sensitive conversations
- Chats older than 24 hours are automatically deleted

## Customization

You can easily customize the appearance by editing `style.css`:

- Change colors in the gradient backgrounds
- Modify border radius for different look
- Adjust padding and spacing
- Update the color scheme to match your brand

## Troubleshooting

**Messages not sending?**
- Check that Firebase is properly configured
- Open browser console to see any errors
- Verify Realtime Database is enabled in Firebase Console

**Can't connect to Firebase?**
- Ensure you've replaced the Firebase config with your own
- Check that your database URL is correct
- Verify your Firebase project is active

## License

Free to use and modify for any purpose.

