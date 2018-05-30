import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import firebase from 'firebase';
import { dbName } from '../../Utils/Variable.js';

class About extends Component {

  constructor(props) {
    super(props);
 
    this.state = {
      about: ''
    }

    var that = this;
    document.title = "nvhug | About";
    firebase.database().ref(dbName + '/about').once('value').then(function(snapshot) {
      var about = snapshot.val() ? snapshot.val() : '';

      that.setState({
        about: about
      });
    });
    
  }


  render() {
    return (
    	<Grid>
        <Row className="show-grid">
          <Col xs={12} md={12}>
            <PageHeader>
              About
            </PageHeader>
            <ReactMarkdown source={this.state.about} />
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default withRouter(About);
