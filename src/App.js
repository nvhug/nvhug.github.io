import React, { Component } from 'react';
import Router from './Utils/Router';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

class App extends Component {

  render() {
  	//console.log(store.getState());
    return (
        <Router />
    );
  }
}

export default App;
