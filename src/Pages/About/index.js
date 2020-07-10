import React, { Component } from 'react';
import { withRouter } from "react-router-dom";
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import firebase from 'firebase/app';
import 'firebase/database';
import { dbName } from '../../Utils/Variable.js';
import { about } from '../../Utils/FbData.js';
import Loading from '../../Components/Loading';
class About extends Component {

  constructor(props) {
    super(props);

    this.state = {
      about: about,
      loading: true
    }

    document.title = "nvhug | About";
  }

  componentDidMount() {
    var that = this;
    if(about === ""){
      firebase.database().ref(dbName + '/about').once('value').then(function(snapshot) {
        var value = snapshot.val() ? snapshot.val() : '';
        that.setState({about: value, loading: false});
      });
    }else {
      this.setState({loading: false})
    }
  }

  render() {
    const loading = this.state.loading ? <Loading /> : '';
    return (
    	<Grid>
        <Row className="show-grid">
          <Col xs={12} md={12}>
            <PageHeader>
              About
            </PageHeader>
            <ReactMarkdown source={this.state.about} />
          </Col>
        </Row>
        {loading}
      </Grid>
    );
  }
}

export default withRouter(About);
