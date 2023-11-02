const firebase = require("firebase");

const config = {
  apiKey: "AIzaSyAf0zZLbXlI8mAcpNosj1omzk-wZttdl_M",
  authDomain: "khawi.firebaseapp.com",
  databaseURL: "https://khawi.firebaseio.com",
  projectId: "khawi",
  storageBucket: "khawi.appspot.com",
  messagingSenderId: "245312403399",
  appId: "1:245312403399:web:b33a388f5a3b3a87860be2",
};

const Firebase = firebase.initializeApp(config);

exports.Firebase = Firebase;
