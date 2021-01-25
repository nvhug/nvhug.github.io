//import firebase from 'firebase';
import firebase from 'firebase/app';
import 'firebase/auth';
import { dbName } from './Variable.js';


// initialize firebase
const config = {
  apiKey: "AIzaSyAucNLoiTXvsfgonkAnCjnuxVRFlsgJNWM",
  authDomain: "nvhug-1dcfd.firebaseapp.com",
  databaseURL: "https://nvhug-1dcfd.firebaseio.com",
  projectId: "nvhug-1dcfd",
  storageBucket: "nvhug-1dcfd.appspot.com",
  messagingSenderId: "214786625463",
  appId: "1:214786625463:web:7c55dfb6006762cb7aa232"
};
firebase.initializeApp(config);

var archivesList = [];
firebase.database().ref(dbName +'/posts').orderByChild('curTime').once('value', function(snapshot) {
  snapshot.forEach(function(childSnapshot) {
    var childKey = childSnapshot.key;
    var childData = childSnapshot.val();

    archivesList.push({'key': childKey, 'title': childData.title, 'body': childData.body, 'current_time': childData.curTime});
  });
});

var about = "";
firebase.database().ref(dbName + '/about').once('value').then(function(snapshot) {
  about = snapshot.val() ? snapshot.val() : '';
});

var authUser = false;
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    authUser = true;
  } 
});

export { archivesList, about, authUser };
