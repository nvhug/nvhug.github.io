import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, FormGroup, ControlLabel, FormControl, HelpBlock, ButtonToolbar, Button } from 'react-bootstrap';
import firebase from 'firebase/app';
import { dbName } from '../../Utils/Variable.js';

class AdminCreate extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleContentChange = this.handleContentChange.bind(this);

    this.state = {
      title: '',
      content: ''
    };
  }

  componentDidMount() {
    
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) {
        window.location.replace("#/login");
      }
    });
  }

  getValidationState() {
    const length = this.state.title.length;
    if (length > 3) return 'success';
    else if (length > 1) return 'warning';
    else if (length > 0) return 'error';
    return null;
  }

  handleChange(e) {
    this.setState({ title: e.target.value });
  }
  handleContentChange(e) {
    this.setState({ content: e.target.value });
  }
  
  handleSubmit(e) {
    //get uid 
    var postData = {
          body: this.state.content,
          title: this.state.title,
          curTime : new Date().toLocaleString()
        };

    var newPostKey = firebase.database().ref().child(dbName+ '/posts').push().key;
    var updates = {};
    updates[dbName + '/posts/' + newPostKey] = postData;
    firebase.database().ref().update(updates);
    //alert('finished create');
  }

  render() {
    return (
    	<Grid>
        <Row className="show-grid">
          <form>
            <FormGroup
              controlId="formBasicText"
              validationState={this.getValidationState()}
            >
              <ControlLabel>Title</ControlLabel>
              <FormControl
                type="text"
                value={this.state.title}
                placeholder="Enter text"
                onChange={this.handleChange}
              />
              <FormControl.Feedback />
              <HelpBlock>Validation is based on string length.</HelpBlock>
            </FormGroup>

            <FormGroup controlId="formControlsTextarea"
            >
              <ControlLabel>Content</ControlLabel>
              <FormControl 
                componentClass="textarea" 
                value={this.state.content}
                rows="20"
                placeholder="Enter text"
                onChange={this.handleContentChange}
              />
              <FormControl.Feedback />
            </FormGroup>
            <ButtonToolbar>
            <Button href="#/archives" bsClass='btn btn-default'>Back to list</Button>
            
            <Button bsStyle="primary" onClick={this.handleSubmit}>Submit</Button>
            </ButtonToolbar>
        </form>
       </Row>
      </Grid>
    );
  }
}

export default withRouter(AdminCreate);
