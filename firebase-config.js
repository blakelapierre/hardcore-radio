/*
 * Firebase config for track ratings (thumbs up/down).
 * Paste the values from Firebase console > Project settings > Your apps > Web app > SDK setup.
 * While these are placeholders the rating UI stays hidden and the site works as before.
 * (Firebase web config values are not secrets. Access is controlled by firestore.rules.)
 */
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
