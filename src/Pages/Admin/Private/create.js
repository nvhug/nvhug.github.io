import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, FormGroup, ControlLabel, FormControl, HelpBlock, ButtonToolbar, Button } from 'react-bootstrap';
import firebase from 'firebase/app';
import { dbName } from '../../../Utils/Variable.js';
import Editor from '../../../Components/Editor';
class AdminCreate extends Component {

  constructor(props) {
    super(props);

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
    if (length > 0) return 'amazing good job!!';
    else if (length === 0) return 'Tiêu đề không được trống!!';
    return null;
  }

  handleChange(e) {
    this.setState({ title: e.target.value });
  }

  handleContentChange(contentValue) {
    this.setState({ content: contentValue });
  }

  handleSubmit(e) {
    //get uid 
    console.log(this.state.content);
    var priveData = {
          body: this.state.content,
          title: this.state.title,
          curTime : new Date()
        };

    var newPriveKey = firebase.database().ref().child(dbName+ '/privates').push().key;
    var updates = {};
    updates[dbName + '/privates/' + newPriveKey] = priveData;
    firebase.database().ref().update(updates);
    alert('created ' +  priveData.title);
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

            <FormGroup controlId="formControlsTextarea">
              <ControlLabel>Content</ControlLabel>
              <Editor onGetContent={this.handleContentChange} />
              
            <FormControl.Feedback />
            </FormGroup>
            <ButtonToolbar>
            <Button href="#/privates" bsClass='btn btn-default'>Back to list</Button>
            
            <Button bsStyle="primary" onClick={this.handleSubmit}>Submit</Button>
            </ButtonToolbar>
        </form>
       </Row>
      </Grid>
    );
  }
}

export default withRouter(AdminCreate);
