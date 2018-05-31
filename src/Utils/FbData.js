import firebase from 'firebase';
import { dbName } from './Variable.js';


// initialize firebase
var config = {
      apiKey: "AIzaSyAucNLoiTXvsfgonkAnCjnuxVRFlsgJNWM",
      authDomain: "nvhug-1dcfd.firebaseapp.com",
      databaseURL: "https://nvhug-1dcfd.firebaseio.com",
      projectId: "nvhug-1dcfd",
      storageBucket: "",
      messagingSenderId: "214786625463"
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

export { archivesList, about };
