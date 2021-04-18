const modulesQuill = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
     
      [{ 'align': [] }],
      ['link', 'image', 'video'],
      ['clean']                        
    ],
  }

  const formatsQuill = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote','code-block','align','direction',
    'list', 'bullet', 'indent',
    'link', 'image', 'video',
    "font",
    "size",
    "color",
    "background"
  ]

  export { modulesQuill, formatsQuill };