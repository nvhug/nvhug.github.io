import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

import { combineReducers, createStore } from 'redux';
import { Provider } from 'react-redux';
import productsReducer from './Reducers/products-reducer';
import userReducer from './Reducers/user-reducer';
import postsReducer from './Reducers/posts-reducer';

const allReducer = combineReducers({
	products: productsReducer,
	user: userReducer,
	posts: postsReducer
});
// const action = {
// 	type: 'ChangeState',
// 	payload: {
// 		newState: 'NewState'
// 	}
// };


//store.dispatch(action);
const store = createStore(allReducer, 
	{
		products: [{name: 'iPhoneX'}],
		user: 'Nvhung',
		posts: [{title: 'iPhone 6', content: 'iPhone 6 xyz'}]
	},
	window.devToolsExtension && window.devToolsExtension()
);


ReactDOM.render(<Provider store={store}><App /></Provider>, document.getElementById('root'));
registerServiceWorker();
