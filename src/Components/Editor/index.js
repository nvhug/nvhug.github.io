import React, { Component } from 'react';
import ReactQuill from 'react-quill';
import firebase from 'firebase/app';
import 'react-quill/dist/quill.snow.css';

/*
 * Event handler to be attached using Quill toolbar module (see line 73)
 * https://quilljs.com/docs/modules/toolbar/
 */
function insertStar() {
  const cursorPosition = this.quill.getSelection().index;
  this.quill.insertText(cursorPosition, "★");
  this.quill.setSelection(cursorPosition + 1);
}

/**
 * Step1. select local image
 *
 */
 function selectLocalImage() {
  const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.click();

    // Listen upload local image and save to server
    input.onchange = () => {
      const file = input.files[0];
      
      // file type is only image.
      if (/^image\//.test(file.type)) {
        const storageRef = firebase.storage().ref();
        storageRef.child('posts/'+ file.name).put(file).then((snapshot) => {
          console.log('Uploaded a blob or file!');
          storageRef.child('posts/'+ file.name).getDownloadURL()
          .then((url) => {
            console.log(url);
            const range = this.quill.getSelection();
            this.quill.insertEmbed(range.index, 'image', url);
          })
          .catch((error) => {
            // Handle any errors
          });
        });
      } else {
        console.warn('You could only upload images.');
      }
    };
}


/* 
 * Editor component with custom toolbar and content containers
 */
class Editor extends Component {
  constructor(props) {
    super(props);
    this.state = { content: "" };
    this.handleChange = this.handleChange.bind(this);
    this.selectLocalImage = this.selectLocalImage.bind(this);
  }

  handleChange(html) {
    this.props.onGetContent(html); 
  }

  selectLocalImage() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.click();

    // Listen upload local image and save to server
    input.onchange = () => {
      const file = input.files[0];
      
      // file type is only image.
      if (/^image\//.test(file.type)) {
        const storageRef = firebase.storage().ref();
        storageRef.child('posts/'+ file.name).put(file).then((snapshot) => {
          console.log('Uploaded a blob or file!');
          storageRef.child('posts/'+ file.name).getDownloadURL()
          .then((url) => {
            console.log(url);
            const range = this.reactQuillRef.getEditor().getSelection();
            this.reactQuillRef.getEditor().insertEmbed(range.index, 'image', url);
          })
          .catch((error) => {
            // Handle any errors
          });
        });
      } else {
        console.warn('You could only upload images.');
      }
    };
  }

  render() {
    return (
      <div className="text-editor">
        <ReactQuill
          onChange={this.handleChange}
          placeholder={this.props.placeholder}
          modules={Editor.modules}
          formats={Editor.formats}
          contentData={this.state}
          theme={"snow"} // pass false to use minimal theme
        />
      </div>
    );
  }
}

/* 
 * Quill modules to attach to editor
 * See https://quilljs.com/docs/modules/ for complete options
 */
Editor.modules = {
  toolbar: {
    container: 
    [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
     
      [{ 'align': [] }],
      ['link', 'image', 'video'],
      ['clean'],
      ['insertStar'],
    ],
    handlers: {
      insertStar: insertStar,
      image: selectLocalImage,
    }
  },


  clipboard: {
    matchVisual: false,
  }
};

/* 
 * Quill editor formats
 * See https://quilljs.com/docs/formats/
 */
Editor.formats = [
  'header',
  'bold', 'italic', 'underline', 'strike', 'blockquote','code-block','align','direction',
  'list', 'bullet', 'indent',
  'link', 'image', 'video',
  "font",
  "size",
  "color",
  "background"
];
  
export default Editor;