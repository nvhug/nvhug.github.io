import React, { Component } from 'react';
import { withRouter, Link } from "react-router-dom";
import { Grid, Row, Col, Table, PageHeader, FormGroup, FormControl } from 'react-bootstrap';
import firebase from 'firebase/app';
import { dbName } from '../../Utils/Variable.js';
import { archivesList } from '../../Utils/FbData.js';
import Loading from '../../Components/Loading';
import moment from 'moment';

class OldStuff extends Component {
	constructor(props) {
    super(props);

    this.state = {
      archives: archivesList,
      inputFilter: '',
      loading: true
    };

    document.title = "nvhug | Old Stuff";
  }

  componentWillMount() {
    //if data not loading before, get data from firebase
    if(this.state.archives.length === 0) {
      var that = this;
      var archives_list = [];
      firebase.database().ref(dbName +'/posts').once('value', function(snapshot) {
        
        snapshot.forEach(function(childSnapshot) {
          var childKey = childSnapshot.key;
          var childData = childSnapshot.val();
          var currentTime = moment(childData.curTime).format("YYYY/MM/DD");
          archives_list.push({'key': childKey, 'title': childData.title, 'current_time': currentTime});
        });
        that.setState({ archives: archives_list, loading: false });

      });

    }else {
      this.setState({ loading: false });
    }
  }

	handleOnClick = (event, key) => {
    this.props.history.push(`/archives/${key}`);
  };

  handleChange = (e) => {
    this.setState({inputFilter: e.target.value})
  }
  render() {

    //function removeVietnameseTones(str) { const newStr = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); return newStr; }
   
    function getHighlightedText(text, highlight) {
        // Split text on highlight term, include term itself into parts, ignore case
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return <span>{parts.map(part => part.toLowerCase() === highlight.toLowerCase() ? <b className="highlight">{part}</b> : part)}</span>;
    }
    const loading = this.state.loading ? <Loading /> : '';
  	const listItems = this.state.archives
    .filter((archive) => 
      this.state.inputFilter ? archive.title.toLowerCase().search(this.state.inputFilter.toLowerCase()) >= 0 : true
    )
    .sort((a, b) => Date.parse(b.current_time) - Date.parse(a.current_time))
    .map((archive, i) => {
      var title_link = archive.title.replace(/\s/g, '-');
      var title = getHighlightedText(archive.title, this.state.inputFilter.toLowerCase());
      var current_time = moment(archive.current_time).format("YYYY/MM/DD");
      return (
        <tr key={i}>
        	<td width="90%">
						<Link className="wrap-highlight" to={{pathname: `/archives/${title_link}/${archive.key}`, state: archive.key}} >
							{title}
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

export default withRouter(OldStuff);
