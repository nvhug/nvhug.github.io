export const UPDATE_POST = 'posts:updatePost';

export function updatePost(newPost) {
	return {
		type: UPDATE_POST,
		payload: {
			post: newPost
		}
	}
}