const firebase = require("firebase");

const config = {
  apiKey: "AIzaSyBRCDFoYc_rEpvuYlM37npS_Fe0x9zGYfU",
  authDomain: "khawii.firebaseapp.com",
  databaseURL: "https://khawii-default-rtdb.firebaseio.com",
  projectId: "khawii",
  storageBucket: "khawii.appspot.com",
  messagingSenderId: "445759952118",
  appId: "1:445759952118:web:ea93fb0f0e4533338908d7",
  measurementId: "G-RVSR1GHBF3"
};

const Firebase = firebase.initializeApp(config);

exports.Firebase = Firebase;
