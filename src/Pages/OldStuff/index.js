import React, { Component } from 'react';
import { withRouter, Link } from "react-router-dom";
import { Grid, Row, Col, Table, PageHeader, FormGroup, FormControl } from 'react-bootstrap';
import firebase from 'firebase';
import { dbName } from '../../Utils/Variable.js';
import { archivesList } from '../../Utils/FbData.js';
class OldStuff extends Component {
	constructor(props) {
    super(props);

    // this.handleChange = this.handleChange.bind(this);
    this.state = {
      archives: archivesList,
      inputFilter: ''
    };

    document.title = "nvhug | Old Stuff";
  }

  componentDidMount() {
    //if data not loading before, get data from firebase
    if(this.state.archives.length === 0) {
      var that = this;
      var archives_list = [];
      firebase.database().ref(dbName +'/posts').orderByChild('curTime').once('value', function(snapshot) {
        
        snapshot.forEach(function(childSnapshot) {
          var childKey = childSnapshot.key;
          var childData = childSnapshot.val();

          archives_list.push({'key': childKey, 'title': childData.title, 'current_time': childData.curTime});
        });
        that.setState({archives: archives_list});
      });
    }
  }


	handleOnClick = (event, key) => {
    // Path is itemId
    this.props.history.push(`/archives/${key}`);
  };

  handleChange = (e) => {
    this.setState({inputFilter: e.target.value})
  }
  render() {
  	const listItems = this.state.archives
    .filter((archive) => 
      this.state.inputFilter ? archive.title.toLowerCase().search(this.state.inputFilter.toLowerCase()) >= 0 : true
    )
    .sort((a, b) => a.current_time < b.current_time)
    .map((archive, i) => {
      var title_link = archive.title.replace(/\s/g, '-');
      return (
        <tr key={i}>
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
            <FormGroup
                  controlId="formBasicText"
                  className="pull-right search-form"
                >
                  <FormControl
                    type="text"
                    value={this.state.inputFilter}
                    placeholder="Search"
                    onChange={this.handleChange}
                  />
                </FormGroup>
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
