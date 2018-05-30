import React, { Component } from 'react';
import { withRouter, Link } from "react-router-dom";
import { Grid, Row, Button, PageHeader, Col, Table, Glyphicon } from 'react-bootstrap';
import firebase from 'firebase';
import { dbName } from '../../Utils/Variable.js';

class Admin extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleDelete = this.handleDelete.bind(this);

    this.state = {
      archives: []
    };
  }

  componentDidMount() {
    console.log('componentDidMount');
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) {
        window.location.replace("#/login");
      } else {
        console.log(user.email);
      }
    });


    var that = this;
    var archives_list = [];
    firebase.database().ref(dbName + '/posts').once('value', function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        var childKey = childSnapshot.key;
        var childData = childSnapshot.val();

        archives_list.push({'key': childKey, 'title': childData.title, 'current_time': childData.curTime});
      });
      that.setState({archives: archives_list});
    });
  }

  handleDelete(key) {
    firebase.database().ref(dbName + '/posts/' + key).remove();
    const arrayCopy = this.state.archives.filter((row) => row.key !== key);
    this.setState({archives: arrayCopy})
  }

  handleEdit() {

  }

  render() {
    //load title list
    const listItems = this.state.archives
    .sort((a, b) => a.current_time < b.current_time)
    .map((archive) => {
      return (
        <tr>
          <td width="80%">
              {archive.title}
          </td>
          <td>
            <Button bsStyle="warning" className="delete-btn" onClick={(e) => this.handleDelete(archive.key, e)}><Glyphicon glyph="remove" /> delete</Button>
          </td>
          <td>
            <Link to={`/admin-edit/${archive.key}`} >
              <Button bsStyle="primary" onClick={this.handleEdit}><Glyphicon glyph="edit" /> Edit</Button>
            </Link>
            
          </td>
        </tr>
      );
    });

    return (
      <Grid>
        <PageHeader>
          Admin list 
        </PageHeader>
        <Row className="show-grid">
          <Col xs={12} md={8} mdOffset={2}>
            <Table condensed>
            <thead>
              <tr>
                <th>Title</th>
                <th></th>
                <th><Button href="#/admin-create" bsClass='btn btn-default pull-right'>Create</Button></th>
              </tr>
            </thead>
              <tbody>
                {listItems}
              </tbody>
            </Table>
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default withRouter(Admin);
