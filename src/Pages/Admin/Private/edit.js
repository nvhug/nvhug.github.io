import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, FormGroup, ControlLabel, FormControl, HelpBlock, ButtonToolbar, Button } from 'react-bootstrap';
import firebase from 'firebase/app';
import { dbName } from '../../../Utils/Variable.js';
import Editor from '../../../Components/Editor';
import 'react-quill/dist/quill.snow.css';

class AdminEdit extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChangeTitle = this.handleChangeTitle.bind(this);

    const key = props.match.params.keyOldStuff;

    this.state = {
    	key: '',
      body: '',
      title: ''
    };

    //set data to state
    var that = this;
    firebase.database().ref(dbName + '/privates/' + key).once('value').then(function(snapshot) {
      var body = snapshot.val().body;
      var title = snapshot.val().title;
      that.setState({
      	key: key,
        body: body,
        title: title
      });
    });

  }

  componentDidMount() {
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) {
        window.location.replace("#/login");
      } else {
        //console.log(user.email);
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

  handleChangeTitle(e) {
    this.setState({ [e.target.name]: e.target.value });
  }

  handleChange(html) {
    this.setState({ body: html });
  }

  handleSubmit(e) {
    //get uid 
    var privateData = {
          body: this.state.body,
          title: this.state.title,
          curTime : new Date().toLocaleString()
        };

    var updates = {};
    updates[dbName + '/privates/' + this.state.key] = privateData;
    firebase.database().ref().update(updates);
    alert('finished create');
  }

  render() {
    const link_to_detail = '#/privates/' + this.state.title.replace(/\s/g, '-') + '/' + this.state.key;
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
                name="title"
                placeholder="Enter text"
                onChange={this.handleChangeTitle}
              />
              <FormControl.Feedback />
              <HelpBlock>Validation is based on string length.</HelpBlock>
            </FormGroup>

            <FormGroup controlId="formControlsTextarea"
            >
              <ControlLabel>Content</ControlLabel>
              <Editor onGetContent={this.handleChange} />

              <FormControl.Feedback />
            </FormGroup>
            <ButtonToolbar>
              <Button href={link_to_detail} bsClass='btn btn-default'>Back to detail</Button>
              <Button bsStyle="primary" onClick={this.handleSubmit}>Submit</Button>
            </ButtonToolbar>
        </form>
       </Row>
      </Grid>
    );
  }
}

export default withRouter(AdminEdit);
