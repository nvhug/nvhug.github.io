import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader, Button } from 'react-bootstrap';
import firebase from 'firebase/app';

import ReactMarkdown from 'react-markdown';
import 'highlightjs/styles/atom-one-dark.css';
import highlightjs from'highlightjs';
import { dbName } from '../../Utils/Variable.js';
import { privatesList, authUser, isLogin } from '../../Utils/FbData.js';
import breaks from 'remark-breaks';

class PrivateShow extends Component {

	constructor(props) {
    super(props);
    console.log("show page private detail");
    this.updateContentData = this.updateContentData.bind(this);
    this.state = {
      body: '',
      key: ''
    }

    //init highlight js 
    highlightjs.initHighlightingOnLoad();
    const key = props.match.params.keyPrivates;
    var that = this;
    // if privates data not loading before get data from firebase 
    if(privatesList.length === 0) {
      firebase.database().ref(dbName + '/privates/' + key).once('value').then(function(snapshot) {
        var body = snapshot.val().body;
        console.log(body);
        var title = snapshot.val().title;
        that.setState({
          body: body,
          title: title,
          key: that.props.match.params.keyPrivates
        });
        document.title = title;
      });
    } 
  }

  componentDidMount() {
    isLogin();
     // update content data when load a detail 
    this.updateContentData(this.props.match.params.keyPrivates);
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
    this.updateContentData(newProps.match.params.keyPrivates);
  }

  //update content data with difference key
  updateContentData(key) {
    if(privatesList.length > 0) {
      const private_details = privatesList.filter((archive) => 
        archive.key === key
      );

      if (private_details[0]) {
        this.setState({
          title: private_details[0].title,
          body: private_details[0].body,
          key: key
        });
        document.title = private_details[0].title;
      }
    }
  }
  
  render() {
    var link_to = "#/admin-edit/" + this.state.key;
    const btnEdit = authUser ? (<Button href={link_to} bsClass='btn btn-default pull-right'>Edit</Button>) : '';
    return (
      <Grid>
        <Row className="show-grid">
          <Col xs={12} md={8} mdOffset={2}>
            <PageHeader>
              {this.state.title}
              {btnEdit}
            </PageHeader>

            <ReactMarkdown className="content-render" plugins={[breaks]} source={this.state.body} />
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default withRouter(PrivateShow);
