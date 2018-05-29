import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Col, Grid, Row, FormGroup, ControlLabel, FormControl, Button } from 'react-bootstrap';
import firebase from 'firebase';

class Login extends Component {
	constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.state = {
    	username: '',
    	password: ''
    }
  }

  componentDidMount() {
  	//if user is logined redirect to admin page
    firebase.auth().onAuthStateChanged(function(user) {
		  if (user) {
		    window.location.replace("#/admin");
		  } 
		});
  }

  handleSubmit(e) {
  	var email = this.state.username;
  	var password = this.state.password;

  	//login with firebase
  	firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
      // Handle Errors here.
      var errorCode = error.code;
      var errorMessage = error.message;
      console.log(errorCode);
      console.log(errorMessage);
    });
  }

  handleChange(e) {
  	this.setState({ [e.target.name]: e.target.value });
  }

  render() {
  	
    return (
      <Grid>
        <Row className="show-grid">
        	<Col xs={12} md={4} mdOffset={4}>
	          <form>
	          		<FormGroup
				          controlId="formBasicText"
				        >
			          <ControlLabel>Username</ControlLabel>
			          <FormControl
			            type="text"
			            value={this.state.username}
			            placeholder="Enter text"
			            name="username"
			            onChange={this.handleChange}
			          />
			        </FormGroup>

		        	<FormGroup
			          controlId="formControlsPassword"
			        >
			        <ControlLabel>Password</ControlLabel>
			        	<FormControl
			            type="password"
			            value={this.state.password}
			            name="password"
			            onChange={this.handleChange}
			          />
			        </FormGroup>

	            <Button bsStyle="primary" onClick={this.handleSubmit}>Submit</Button>
	        	</form>
        	</Col>
       	</Row>
      </Grid>
    );
  }
}

export default withRouter(Login);
