import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import firebase from 'firebase';
import ReactMarkdown from 'react-markdown';
import 'highlightjs/styles/atom-one-dark.css';
import highlightjs from'highlightjs';
import { dbName } from '../../Utils/Variable.js';
import { archivesList } from '../../Utils/FbData.js';

class OldStuffDetail extends Component {

	constructor(props) {
    super(props);

    this.updateContentData = this.updateContentData.bind(this);
    this.state = {
      body: ''
    }

    //init highlight js 
    highlightjs.initHighlightingOnLoad();

    const key = props.match.params.keyOldStuff;
    var that = this;
    // if archives data not loading before get data from firebase 
    if(archivesList.length === 0) {
      firebase.database().ref(dbName + '/posts/' + key).once('value').then(function(snapshot) {
        var body = snapshot.val().body;
        var title = snapshot.val().title;
        that.setState({
          body: body,
          title: title,
          key: that.props.match.params.keyOldStuff
        });
        document.title = title;
      });
    } 
  }

  componentDidMount() {
    // update content data when load a detail 
    this.updateContentData(this.props.match.params.keyOldStuff);
  }

  componentDidUpdate() {
    //Custom Initialization highlight js 
    var els = document.querySelectorAll('pre code');
    for (var i = 0; i < els.length; i++) {
        if (!els[i].classList.contains('hljs')) {
            highlightjs.highlightBlock(els[i]);
        }
    }
  }

  componentWillReceiveProps(newProps) {
    //directing to the same route with just a different param
    this.updateContentData(newProps.match.params.keyOldStuff);
  }

  //update content data with difference key
  updateContentData(key) {
    if(archivesList.length > 0) {
      const post_details = archivesList.filter((archive) => 
        archive.key === key
      );

      if (post_details[0]) {
        this.setState({
          title: post_details[0].title,
          body: post_details[0].body
        });
        document.title = post_details[0].title;
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