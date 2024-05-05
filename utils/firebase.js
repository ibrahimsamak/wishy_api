const firebase = require("firebase");

const config = {
  apiKey: "AIzaSyAEIVpZnvSbD6Bj4LFJ06XCuiJCQc7cN90",
  authDomain: "wishy-ويشيapp-c3a3c.firebaseapp.com",
  databaseURL: "https://wishy-ويشيapp-c3a3c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "wishy-ويشيapp-c3a3c",
  storageBucket: "wishy-ويشيapp-c3a3c.appspot.com",
  messagingSenderId: "198605339648",
  appId: "1:198605339648:web:81f59ce8f47eb09125ece5",
  measurementId: "G-676K2E5XLZ"
};

const Firebase = firebase.initializeApp(config);

exports.Firebase = Firebase;
