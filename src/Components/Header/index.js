import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Nav, NavItem, Navbar } from 'react-bootstrap';

class Header extends Component {
  render() {
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
            <NavItem eventKey={1} href="/">
              Cover
            </NavItem>
            <NavItem eventKey={2} href="#about">
              About
            </NavItem>
            <NavItem eventKey={3} href="#archives">
              Old Stuff
            </NavItem>
            <NavItem eventKey={4} href="#portfolio">
              Portfolio
            </NavItem>
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    );
  }
}

export default Header;
