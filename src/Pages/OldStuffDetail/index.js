import React, { Component } from 'react';
import { withRouter } from "react-router-dom";

class OldStuffDetail extends Component {

	constructor(props) {
    super(props);
    const archiveId = props.match.params.archiveId;

    this.state = {
      archiveDetail: archiveId,
    };
  }
  
  render() {
    return (
      <p>{this.state.archiveDetail}</p>
    );
  }
}

export default withRouter(OldStuffDetail);
