import React, { Component } from 'react';
import { withRouter, Link } from "react-router-dom";
import { Grid, Row, Col, Table, PageHeader } from 'react-bootstrap';
import firebase from 'firebase';

class OldStuff extends Component {
	constructor(props) {
    super(props);
    this.state = {
      archives: []
    };
  }

  componentDidMount() {
    var that = this;
    var archives_list = [];
    firebase.database().ref('/posts').once('value', function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        var childKey = childSnapshot.key;
        var childData = childSnapshot.val();

        archives_list.push({'key': childKey, 'title': childData.title, 'current_time': childData.curTime});
      });
      that.setState({archives: archives_list});
    });
  }


	handleOnClick = (event, key) => {
    // Path is itemId
    this.props.history.push(`/archives/${key}`);
  };
  render() {
  	const listItems = this.state.archives.map((archive) => {
      var title_link = archive.title.replace(/\s/g, '-');
      return (
        <tr>
        	<td width="77%">
						<Link to={{pathname: `/archives/${title_link}/${archive.key}`, state: archive.key}} >
							{archive.title}
						</Link>
        	</td>
          <td>
              {archive.current_time}
          </td>
        </tr>
      );
    });

    return (
    	<Grid>
          <PageHeader>
            Old Stuff
          </PageHeader>
			  <Row className="show-grid">
			    <Col xs={12} md={8} mdOffset={2}>
			      <Table condensed>
            <thead>
              <tr>
                <th>Title</th>
                <th></th>
               
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

export default withRouter(OldStuff);
