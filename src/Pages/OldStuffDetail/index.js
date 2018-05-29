import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import firebase from 'firebase';
import ReactMarkdown from 'react-markdown';

class OldStuffDetail extends Component {

	constructor(props) {
    super(props);

    this.state = {
      body: ''
    }

    const key = props.match.params.keyOldStuff;
    var that = this;
    firebase.database().ref('/posts/' + key).once('value').then(function(snapshot) {
      var body = snapshot.val().body;
      var title = snapshot.val().title;
      console.log(snapshot.val());
      that.setState({
        body: body,
        title: title
      });
    });
  }
  
  render() {
    return (
      <Grid>
        <Row className="show-grid">
          <Col xs={12} md={12}>
            <PageHeader>
              {this.state.title}
            </PageHeader>
            <ReactMarkdown source={this.state.body} />
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default withRouter(OldStuffDetail);
