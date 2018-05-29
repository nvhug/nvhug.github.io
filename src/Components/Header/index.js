import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Nav, NavItem, Navbar } from 'react-bootstrap';
import firebase from 'firebase';

class Header extends Component {

  constructor(props) { 
    super(props);

    this.state = {
      isLoggedIn: false
    }
  }

  componentDidMount() {
    var that = this;
    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
       that.setState({isLoggedIn: true});
      } else {
        that.setState({isLoggedIn: false});
      }
    });
  }

  handleLogout() {
    firebase.auth().signOut().then(function() {
      console.log('finished');
    }, function(error) {
      // An error happened.
    });
  }

// <NavItem eventKey={4} href="#portfolio">
//   Portfolio
// </NavItem>

  render() {
    const isLoggedIn = this.state.isLoggedIn;
    const adminButton = isLoggedIn ? (
        <NavItem eventKey={5} href="#admin">
          Admin
        </NavItem>
      ) : '';
    const button = isLoggedIn ? (
      <NavItem eventKey={2} href="#logout" onClick={this.handleLogout}>
        Logout
      </NavItem>
    ) : (
      <NavItem eventKey={1} href="#login">
        Login
      </NavItem>
    );
  
    return (
      <Navbar inverse collapseOnSelect>
        <Navbar.Header>
          <Navbar.Brand>
            <Link to="/"><span className="size-down">n</span><span className="size-up">v</span><strong>H</strong><span className="size-up">u</span><span className="size-down">g</span></Link>
          </Navbar.Brand>
          <Navbar.Toggle />
        </Navbar.Header>
        <Navbar.Collapse>
          <Nav>
            <NavItem eventKey={2} href="#about">
              About
            </NavItem>
            <NavItem eventKey={3} href="#archives">
              Old Stuff
            </NavItem>
       
            {adminButton}
          </Nav>
          <Nav pullRight>
            {button}
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    );
  }
}

export default Header;
