import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import firebase from 'firebase';
import ReactMarkdown from 'react-markdown';
import 'highlightjs/styles/atom-one-dark.css';
import highlightjs from'highlightjs';
import { dbName } from '../../Utils/Variable.js';

class OldStuffDetail extends Component {

	constructor(props) {
    super(props);

    this.state = {
      body: ''
    }
    highlightjs.initHighlightingOnLoad();

    const key = props.match.params.keyOldStuff;
    var that = this;
    firebase.database().ref(dbName + '/posts/' + key).once('value').then(function(snapshot) {
      var body = snapshot.val().body;
      var title = snapshot.val().title;
      that.setState({
        body: body,
        title: title
      });
      document.title = title;
    });
  }

  componentDidUpdate() {
    var els = document.querySelectorAll('pre code');
    for (var i = 0; i < els.length; i++) {
        if (!els[i].classList.contains('hljs')) {
            highlightjs.highlightBlock(els[i]);
        }
    }
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
