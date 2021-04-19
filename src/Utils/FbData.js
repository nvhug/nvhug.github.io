//import firebase from 'firebase';
import firebase from 'firebase/app';
import 'firebase/storage';
import 'firebase/auth';
import { dbName } from './Variable.js';


// initialize firebase
const config = {
  apiKey: "AIzaSyAucNLoiTXvsfgonkAnCjnuxVRFlsgJNWM",
  authDomain: "nvhug-1dcfd.firebaseapp.com",
  databaseURL: "https://nvhug-1dcfd.firebaseio.com",
  projectId: "nvhug-1dcfd",
  storageBucket: "gs://nvhug-1dcfd.appspot.com",
  messagingSenderId: "214786625463",
  appId: "1:214786625463:web:7c55dfb6006762cb7aa232"
};
firebase.initializeApp(config);
var storage = firebase.storage();



function getDataList(keyName) {
  var lists= [];
  firebase.database().ref(dbName +'/' + keyName).orderByChild('curTime').once('value', function(snapshot) {
  snapshot.forEach(function(childSnapshot) {
      var childKey = childSnapshot.key;
      var childData = childSnapshot.val();

      lists.push({'key': childKey, 'title': childData.title, 'body': childData.body, 'current_time': childData.curTime});
    });
  });
  return lists;
}

function isLogin() {
  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) {
      window.location.replace("#/login");
    } else {
      console.log("welcome to vuvi.vn!");
    }
  });
}
var archivesList = getDataList('posts');
var privatesList = getDataList('privates');
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

export { archivesList, about, authUser, privatesList, isLogin, storage };
