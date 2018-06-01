import React, { Component } from 'react';
import { withRouter } from "react-router-dom";

class Footer extends Component {
  render() {
  	var currentYear = (new Date()).getFullYear();
  	const year = currentYear === 2018 ? "2018" : `2018-${currentYear}`;

    return (
      	<div className="footer">
		  <p>Copyright © {year} <i>Hung Nguyen</i>. Some rights reserved.</p>
		</div>
    );
  }
}

export default withRouter(Footer);
