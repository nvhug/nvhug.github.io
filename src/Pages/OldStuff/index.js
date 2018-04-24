import React, { Component } from 'react';
import { withRouter, Link } from "react-router-dom";
import { Grid, Row, Col, Table } from 'react-bootstrap';

class OldStuff extends Component {
	constructor(props) {
    super(props);
    this.state = {
      archives: []
    };
  }

  componentDidMount() {
    const data = {
                    "Items": [
                        {
                            "key": "1",
                            "name": "I start to implement nvhug.github.io",
                            "date": "2018/04/23"
                        },
                        {
                            "key": "2",
                            "name": "I try to implement page with react",
                            "date": "2018/04/24"
                        }
                    ]
                };
        this.setState({
          archives: data.Items
        });
  }


	handleOnClick = (event, key) => {
    // Path is itemId
    //event.preventDefault();
    console.log(key);
    this.props.history.push(`/archives/${key}`);
  };
  render() {
  	console.log('we');
  	const listItems = this.state.archives.map((archive) => {
      return (
        <tr>
        	<td>
						<Link to={`/archives/${archive.key}`}>
							{archive.name}
						</Link>
        	</td>
        </tr>
      );
    });

    return (
    	<Grid>
			  <Row className="show-grid">
			    <Col xs={6} md={3}>
			      sider bar
			    </Col>
			    <Col xs={12} md={9}>
			    	<Table>
						  <tbody>
						    { listItems }
						  </tbody>
						</Table>
			    </Col>
			  </Row>

  		</Grid>
    );
  }
}

export default withRouter(OldStuff);
