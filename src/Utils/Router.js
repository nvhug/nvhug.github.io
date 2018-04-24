import React, { Component } from 'react';
import { HashRouter, Route, Switch } from "react-router-dom";
import Cover from '../Pages/Cover';
import About from '../Pages/About';
import OldStuff from '../Pages/OldStuff';
import OldStuffDetail from '../Pages/OldStuffDetail';
import Portfolio from '../Pages/Portfolio';
import Header from '../Components/Header';

class Router extends Component {
  render() {
    return (
      <HashRouter>
        <React.Fragment>
            <Header />
            <Switch>
              <Route exact path="/" component={Cover} />
              <Route path="/about" component={About} />
              <Route path="/archives/:archiveId" component={OldStuffDetail} />
              <Route path="/archives" component={OldStuff} />
              <Route path="/portfolio" component={Portfolio} />
            </Switch>
        </React.Fragment>
      </HashRouter>
    );
  }
}

export default Router;
