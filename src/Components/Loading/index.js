import React, { Component } from 'react';
import { Row, Col, Image } from 'react-bootstrap';

class Loading extends Component {

  render() {
    return (
    	<Row>
        <Col xs={12} md={4} mdOffset={4}>
           <Image src={require('../../Images/loading3.gif')} width="100%" /> 
        </Col>
      </Row>
    );
  }
}

export default Loading;
