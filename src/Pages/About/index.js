import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import firebase from 'firebase';
import { dbName } from '../../Utils/Variable.js';
import { about } from '../../Utils/FbData.js';
class About extends Component {

  constructor(props) {
    super(props);

    this.state = {
      about: about
    }

    document.title = "nvhug | About";
  }

  componentDidMount() {
    var that = this;
    if(about === ""){
      firebase.database().ref(dbName + '/about').once('value').then(function(snapshot) {
        var value = snapshot.val() ? snapshot.val() : '';
        that.setState({about: value});
      });
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
            <ReactMarkdown source={this.state.about} />
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default withRouter(About);
