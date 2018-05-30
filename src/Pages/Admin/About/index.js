import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, FormGroup, ControlLabel, FormControl, Button } from 'react-bootstrap';
import firebase from 'firebase';
import { dbName } from '../../../Utils/Variable.js';

class AdminAbout extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);

    this.state = {
      about: '',
    };

    //set data to state
    var that = this;
    firebase.database().ref(dbName + '/about').once('value').then(function(snapshot) {
      var about = snapshot.val() ? snapshot.val() : '';
      that.setState({
        about: about
      });
    });

  }

  componentDidMount() {
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) {
        window.location.replace("#/login");
      } else {
        console.log(user.email);
      }
    });
  }


  handleChange(e) {
    this.setState({ [e.target.name]: e.target.value });
  }

  handleSubmit(e) {

    var updates = {};
    updates[dbName + '/about'] = this.state.about;
    firebase.database().ref().update(updates);
    alert('finished update');
  }

  render() {
    return (
    	<Grid>
        <Row className="show-grid">
          <form>
            <FormGroup>
              <ControlLabel>Content</ControlLabel>
              <FormControl 
                componentClass="textarea" 
                value={this.state.about}
                rows="20"
                name="about"
                placeholder="Enter text"
                onChange={this.handleChange}
              />
              <FormControl.Feedback />
            </FormGroup>
            <Button bsStyle="primary" onClick={this.handleSubmit}>Submit</Button>
        </form>
       </Row>
      </Grid>
    );
  }
}

export default withRouter(AdminAbout);
