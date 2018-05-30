import React, { Component } from 'react';
import { HashRouter, Route, Switch } from "react-router-dom";
//import Cover from '../Pages/Cover';
import About from '../Pages/About';
import OldStuff from '../Pages/OldStuff';
import OldStuffDetail from '../Pages/OldStuffDetail';
import Portfolio from '../Pages/Portfolio';
import Admin from '../Pages/Admin';
import AdminEdit from '../Pages/Admin/edit.js';
import AdminCreate from '../Pages/Admin/create.js';
import AdminAbout from '../Pages/Admin/About';
import Login from '../Pages/Login';
import Header from '../Components/Header';

class Router extends Component {
  render() {
    return (
      <HashRouter>
        <React.Fragment>
            <Header />
            <Switch>
              <Route exact path="/" component={OldStuff} />
              <Route path="/about" component={About} />
              <Route path="/archives/:archiveId/:keyOldStuff" component={OldStuffDetail} />
              <Route path="/archives" component={OldStuff} />
              <Route path="/portfolio" component={Portfolio} />
              <Route path="/admin" component={Admin} />
              <Route path="/admin-edit/:keyOldStuff" component={AdminEdit} />
              <Route path="/admin-create" component={AdminCreate} />
              <Route path="/admin-about" component={AdminAbout} />
              <Route path="/login" component={Login} />
            </Switch>
        </React.Fragment>
      </HashRouter>
    );
  }
}

export default Router;
