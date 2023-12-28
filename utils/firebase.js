const firebase = require("firebase");

const config = {
  apiKey: "AIzaSyAEIVpZnvSbD6Bj4LFJ06XCuiJCQc7cN90",
  authDomain: "jazapp-c3a3c.firebaseapp.com",
  databaseURL: "https://jazapp-c3a3c-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "jazapp-c3a3c",
  storageBucket: "jazapp-c3a3c.appspot.com",
  messagingSenderId: "198605339648",
  appId: "1:198605339648:web:8543efb0da811fb025ece5",
  measurementId: "G-1HPD4B1TKS"
};

const Firebase = firebase.initializeApp(config);

exports.Firebase = Firebase;
