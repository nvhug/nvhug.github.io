import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

class About extends Component {

  constructor(props) {
    super(props);
    var about = `### About Hung 
I'm **Nguyễn Văn Hưng** from Daklak province, I'm a software engineer at MTI Technology Inc
4 years in software development. 

Main skill: PHP, Ruby on rails (Rspec test, test mock, test entity with ruby grape)

Knowledge of MVC Framework(Laravel), ORM, RESTful, EC-Cube CMS

Frontend: Has a little knowledge with reactjs, vuejs

Database: Mysql, PostgreSQL, SQL, SQLite.

Knowledgeable in HTML5, JavaScript/Jquery, LESS, SASS.

Has a little knowledge with docker compose, firebase

Other: GIT command line, SVN, Redmine, Linux command line

### About this site
Using github page, reactjs, firebase, react-markdown, react-router-dom, react-bootstrap. 

### English
I'm still learning English, so please excuse my mistakes.
`;
    this.state = {
      body: about
    }

    document.title = "nvhug | About";
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
