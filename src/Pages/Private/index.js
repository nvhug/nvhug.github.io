import React, { Component } from 'react';
import { withRouter, Link } from "react-router-dom";
import { Grid, Row, Col, Table, PageHeader, FormGroup, FormControl } from 'react-bootstrap';
import firebase from 'firebase/app';
import { dbName } from '../../Utils/Variable.js';
import { privatesList, isLogin } from '../../Utils/FbData.js';
import Loading from '../../Components/Loading';
import moment from 'moment';

class Private extends Component {
	constructor(props) {
    super(props);

    this.state = {
      privates: privatesList,
      inputFilter: '',
      loading: true
    };

    document.title = "nvhug | For me";
  }

  componentDidMount() {
    isLogin();
  }
  componentWillMount() {
    //if data not loading before, get data from firebase
    if(this.state.privates.length === 0) {
      var that = this;
      var privates_list = [];
      firebase.database().ref(dbName +'/privates').once('value', function(snapshot) {
        
        snapshot.forEach(function(childSnapshot) {
          var childKey = childSnapshot.key;
          var childData = childSnapshot.val();
          var currentTime = moment(childData.curTime).format("YYYY/MM/DD");
          privates_list.push({'key': childKey, 'title': childData.title, 'current_time': currentTime});
        });
        that.setState({ privates: privates_list, loading: false });

      });

    }else {
      this.setState({ loading: false });
    }
  }

	handleOnClick = (event, key) => {
    // Path is itemId
    this.props.history.push(`/privates/${key}`);
  };

  handleChange = (e) => {
    this.setState({inputFilter: e.target.value})
  }
  render() {
    const loading = this.state.loading ? <Loading /> : '';
  	const listItems = this.state.privates
    .filter((archive) => 
      this.state.inputFilter ? archive.title.toLowerCase().search(this.state.inputFilter.toLowerCase()) >= 0 : true
    )
    .sort((a, b) => Date.parse(b.current_time) - Date.parse(a.current_time))
    .map((archive, i) => {
      var title_link = archive.title.replace(/\s/g, '-');
      var current_time = moment(archive.current_time).format("YYYY/MM/DD");
      return (
        <tr key={i}>
        	<td width="90%">
						<Link to={{pathname: `/privates/${title_link}/${archive.key}`, state: archive.key}} >
							{archive.title}
						</Link>
        	</td>
          <td>
              {current_time}
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
        {loading}
  		</Grid>
    );
  }
}

export default withRouter(Private);
