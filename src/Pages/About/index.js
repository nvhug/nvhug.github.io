import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { connect } from 'react-redux';
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

class About extends Component {

  constructor(props) {
    super(props);
    var about = `### About Hung 
I'm **Nguyễn Văn Hưng** from Daklak province, I'm a software engineer at MTI Technology Inc
4 years in software development. 

Basic skill GIT command line, SVN, Redmine, Linux command line

Main skill: PHP, Ruby on rails (Rspec test, test mock, test entity with ruby grape)

Database: Mysql, PostgreSQL, SQL, SQLite.

Has a little knowledge with docker compose, firebase

### About this site
Using github page, reactjs, firebase, react-markdown, react-router-dom, react-bootstrap. 
`;
    this.state = {
      body: about
    }
  }


  render() {
    return (
    	<Grid>
        <Row className="show-grid">
          <Col xs={12} md={12}>
            <PageHeader>
              About
            </PageHeader>
            <ReactMarkdown source={this.state.body} />
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default withRouter(About);
