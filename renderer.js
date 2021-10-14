const electron = require('electron');
const { BrowserWindow } = require('@electron/remote')
const mainWindow = BrowserWindow.getFocusedWindow()
const {app, dialog, shell} = require('@electron/remote')
const $ = jQuery = require('jquery')
const appRootDir = require('app-root-dir').get()
const fs = require('fs-extra')
const gm = require('gm').subClass({imageMagick: true})
const dirTree = require("directory-tree")
const path = require('path')
const ipc = electron.ipcRenderer;

let selectedImagesDir = document.getElementById('selected-images-folder'),
    makeImgsBtn = document.getElementById('make-images'),
    functionPicker = document.getElementById('function-picker'),
    spinner = document.querySelector('.spinner-container'),
    imgBuilderObj = {};

functionPicker.addEventListener('change', function(e){
  let id = functionPicker.value;
  document.querySelectorAll('.function-wrapper').forEach( (wrapper)=>{
    if( wrapper.id === id ) {
      wrapper.style.display = 'block';
    } else {
      wrapper.style.display = 'none';
    }
  });
})

function createMontage(fileName) {

  if( selectedImagesDir.value === "" ) return;

  spinner.style.display = 'block';

  let p = path.parse(fileName);

  let imgDir = selectedImagesDir.value,
      destDir = p.dir,
      name = p.ext.indexOf('.') === -1 ? p.name + '.jpg' : p.base,
      rows = parseInt(document.getElementById('rows').value),
      cols = parseInt(document.getElementById('cols').value),
      compositeWidth = parseInt(document.getElementById('max-width').value),
      gutter = parseInt(document.getElementById('gutter').value);

  let wd = (compositeWidth/cols) - (gutter*2);
  let files = [];
  let filteredTree = dirTree(imgDir, {extensions: /\.(jpg|svg|jpeg|png|tiff)$/}, (item, filePath) => {
    files.push(filePath);
  });
  // console.log(files);
  if( files.length > 0 ) {
    let g = gm(files[0]);
    for( let i = 1; i < files.length; i++ ) {
      g.montage(files[i]);
    }
    g.tile(`${cols}x${rows}`)
      .geometry(`${wd}x+${gutter}+${gutter}`)
      .background('white')
      .write(`${destDir}/${name}`, function(err){

        spinner.style.display = 'none';

        if( err ) {
          console.log(err);
        } else {
          let firstFile = fileName.replace('.jpg', '-0.jpg');
          shell.showItemInFolder(firstFile);
          console.log("Written montage image.");
        }
      });
  }
}

let processBtn = document.getElementById('process'),
    imagesFolderBtn = document.getElementById('images-folder'),
    destFolderBtn = document.getElementById('dest-folder');

processBtn.addEventListener('click', ()=>{
  let docsPath = app.getPath('documents');
  let fileName = dialog.showSaveDialog(mainWindow, {
    title: 'Select export folder and filename',
    defaultPath: docsPath + '/composite.jpg'
  }).then(result => {
    if( !result.canceled ) {
      createMontage(result.filePath);
    }
  }).catch(err => {
    console.log(err)
  });
});

// image creator stuff //////////////////////////////////////////////////////////////////////////

function makeImages() {

  dialog.showOpenDialog( mainWindow, {
    title: 'Select Save Folder',
    buttonLabel: 'Set Folder',
    properties: ['openDirectory']
  }).then(result => {
    if( !result.canceled ) {
      makeThumb(result.filePaths[0]);
    }
  }).catch(err => {
    console.log(err)
  });

  function makeThumb(folder) {

    let p = path.parse(imgBuilderObj.overlayImg);
    let thumb = folder + path.sep + p.name + '-640' + p.ext;
    gm(imgBuilderObj.overlayImg)
      .out('-thumbnail', '640x640>')
      .out('-background', 'transparent')
      .out('-gravity', 'center')
      .out('-extent', '640x640')
      .write(thumb, function(err){
        if( !err ) {
          makeComposite({folder: folder, thumb: thumb, p: p})
        } else {
          console.log(err);
        }
      })
  }

  function makeComposite(obj) {
    let compositeFile = obj.folder + path.sep + obj.p.name + '-main' + obj.p.ext;
    gm(obj.thumb)
      .in(imgBuilderObj.bgImg)
      .gravity('Center')
      .out('-composite')
      .write(compositeFile, function(err) {
        if(!err) {
          console.log("Written composite image.");
          shell.showItemInFolder(compositeFile);
        } else {
          console.log(err);
        }
      });
  }
}

imagesFolderBtn.addEventListener('click', ()=>{
  dialog.showOpenDialog( mainWindow, {
    title: 'Select Images Folder',
    buttonLabel: 'Set Folder',
    properties: ['openDirectory']
  }).then(result => {
    if( !result.canceled ) {
      selectedImagesDir.value = result.filePaths[0];
    }
  }).catch(err => {
    console.log(err)
  });
});

makeImgsBtn.addEventListener('click', makeImages);

document.querySelectorAll('.img-btn').forEach( function(btn){
  let id = btn.id;
  btn.addEventListener('click', ()=>{
    dialog.showOpenDialog( mainWindow, {
      title: 'Select Images Folder',
      buttonLabel: 'Set Folder',
      properties: ['openFile']
    }).then(result => {
      if( !result.canceled ) {
        if( id === 'bg-img') {
          imgBuilderObj.bgImg = result.filePaths[0];
          document.getElementById('bg-img-shot').setAttribute('src', result.filePaths[0]);
        } else if(id === 'overlay-img' ) {
          imgBuilderObj.overlayImg = result.filePaths[0];
          document.getElementById('overlay-img-shot').setAttribute('src', result.filePaths[0]);
        }
        if( imgBuilderObj.bgImg !== undefined && imgBuilderObj.overlayImg !== undefined ) {
          makeImgsBtn.style.display = 'block';
        }
      }
    }).catch(err => {
      console.log(err)
    });
  });
});
