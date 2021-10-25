const _ = require('lodash');
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
const ffmpeg = require('fluent-ffmpeg');

const ext = process.platform === 'win32' ? '.exe' : '';
ffmpeg.setFfmpegPath(path.join(__dirname, 'libs', process.platform, process.arch, 'ffmpeg' + ext));
ffmpeg.setFfprobePath(path.join(__dirname, 'libs', process.platform, process.arch, 'ffprobe' + ext));

let selectedImagesDir = document.getElementById('selected-images-folder'),
    selectedVidDir = document.getElementById('selected-vid-folder'),
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

function createVidGridArrays(fileName) {

  if( selectedVidDir.value === "" ) return;

  spinner.style.display = 'block';

  let p = path.parse(fileName);

  let vidDir = selectedVidDir.value,
    destDir = p.dir,
    name = p.ext.indexOf('.') === -1 ? p.name + '.mp4' : p.base,
    rows = parseInt(document.getElementById('vid-rows').value),
    cols = parseInt(document.getElementById('vid-cols').value),
    compositeWidth = parseInt(document.getElementById('vid-max-width').value),
    gutter = parseInt(document.getElementById('vid-gutter').value);

  let wd = (compositeWidth/cols) - (gutter*2); // <-- not being used here

  let filteredTree = dirTree(vidDir, {extensions: /\.mp4/});

  let files = filteredTree.children;
  files = _.uniqBy(files, function (e) {
    return e.name;
  });
  let cnt = 0;
  if( files.length > 0 ) {
    let vidsPer = cols*rows;
    let totalCompositeVids = parseInt(files.length/vidsPer);
    let leftOver = files.length % vidsPer;

    while( files.length >= vidsPer ) {
      let subArr = files.splice(0,vidsPer);
      let fname = destDir + path.sep + p.name + `-${cnt}` + '.mp4';
      let callIt = files.length === 0 ? true : false;
      makeVidGrid({rows: rows, cols: cols, files: subArr, destDir: destDir, name: fname, callIt: callIt, wd: compositeWidth, pathInfo: p, cnt: cnt});
      cnt++;
    }
    if( leftOver > 0 ) {
      let fname = destDir + path.sep + p.name + `-${cnt}` + '.mp4';
      makeVidGrid({rows: rows, cols: cols, files: files, destDir: destDir, name: fname, leftOver: leftOver, callIt: true, wd: compositeWidth, pathInfo: p, cnt: cnt});
    }
  } else {
    spinner.style.display = 'none';
    alert('No mp4 video files found.');
  }

}

function makeVidGrid(obj) {

  let files = obj.files,
      rows = obj.rows,
      cols = obj.cols,
      destDir = obj.destDir,
      name = obj.name,
      callIt = obj.callIt,
      leftOver = obj.leftOver,
      pathInfo = obj.pathInfo,
      cnt = obj.cnt,
      wd = obj.wd;

  let proc = new ffmpeg();
  for( let f of files ) {
    proc.addInput(f.path);
  }
  let str = `-filter_complex `;
  let vidArrNum = 0;

  if( leftOver === undefined ) {
    for( let r = 1; r <= rows; r++ ) {
      for( let c = 1; c <= cols; c++ ) {
        str += c < cols ? `[${vidArrNum}:v]` : `[${vidArrNum}:v]hstack=${cols}[r${r}];[r${r}]scale=${wd}:-1[rs-${r}];`;
        vidArrNum++;
      }
    }
    for( let r = 1; r <= rows; r++ ) {
      str += r < rows ? `[rs-${r}]` : `[rs-${r}]vstack=${rows}[out]`;
    }
  } else {

    // must have less than the total per video grid
    rows = parseInt(leftOver / cols);
    let lastCols = leftOver % cols;

    for( let r = 1; r <= rows; r++ ) {
      for( let c = 1; c <= cols; c++ ) {
        str += c < cols ? `[${vidArrNum}:v]` : `[${vidArrNum}:v]hstack=${cols}[r${r}];[r${r}]scale=${wd}:-1[rs-${r}];`;
        vidArrNum++;
      }
    }
    // do last row
    for( let c = 1; c <= lastCols; c++ ) {
      str += c < lastCols ? `[${vidArrNum}:v]` : `[${vidArrNum}:v]hstack=${lastCols}[r${rows+1}];[r${rows+1}]scale=${wd}:-1[rs-${rows+1}];`;
      vidArrNum++;
    }

    for( let r = 1; r <= rows; r++ ) {
      str += `[rs-${r}]`;
    }
    str += `[rs-${rows+1}]vstack=${rows+1}[out]`;
  }

  proc.addOutputOption(str);
  proc.addOutputOption(`-map [out]`);
  proc.addOutputOption('-vcodec libx264');

  proc.on('start', function(ffmpegCommand){
    console.log(ffmpegCommand);
  })
    .on('progress', function(data){

    })
    .on('end', function(){
      makeVideoThumbnail({destDir: destDir, vidFile: name, pathInfo: pathInfo, cnt: cnt});
      if( callIt ) {
        spinner.style.display = 'none';
        shell.showItemInFolder(name);
      }
    })
    .on('error', function(err, stdout, stderr){
      spinner.style.display = 'none';
      console.log(err, stdout, stderr);
    })
    .output(name)
    .run();
}

function makeVideoThumbnail(obj) {

  let p = obj.pathInfo,
      destDir = obj.destDir,
      cnt = obj.cnt,
      proc = new ffmpeg(obj.vidFile);

  proc.addInputOptions(['-ss 00:00:01.00'])
    .addOutputOptions(['-vf scale=1280:-1:force_original_aspect_ratio=decrease', '-vframes 1'])
    .on('start', function(ffmpegCommand){
      console.log(ffmpegCommand);
    })
    .on('progress', function(data){
      console.log(data);
    })
    .on('end', function(){
      console.log('thumbnail created');
    })
    .on('error', function(err,stdout,stderr){
      console.log(err,stdout,stderr);
    })
    .output(destDir + path.sep + p.name + `-${cnt}.jpg`)
    .run();
  // ffmpeg -ss 00:00:01.00 -i input.mp4 -vf 'scale=320:320:force_original_aspect_ratio=decrease' -vframes 1 output.jpg
  // proc.set
}

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
    vidProcessBtn = document.getElementById('process-vid'),
    vidFolderBtn = document.getElementById('vid-folder'),
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

vidProcessBtn.addEventListener('click', ()=>{
  let docsPath = app.getPath('documents');
  let fileName = dialog.showSaveDialog(mainWindow, {
    title: 'Select export folder and filename',
    defaultPath: docsPath + '/composite.mp4'
  }).then(result => {
    if( !result.canceled ) {
      createVidGridArrays(result.filePath)
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

vidFolderBtn.addEventListener('click', ()=>{
  dialog.showOpenDialog( mainWindow, {
    title: 'Select Video Folder',
    buttonLabel: 'Set Folder',
    properties: ['openDirectory']
  }).then(result => {
    if( !result.canceled ) {
      selectedVidDir.value = result.filePaths[0];
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
