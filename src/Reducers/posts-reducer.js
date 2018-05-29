import  { UPDATE_POST } from '../Actions/post-actions';

export default function postReducer(state = '', { type, payload }) {
	switch (type) {
		case UPDATE_POST:
			return payload.post;
		default: 
			return state;
	}
}