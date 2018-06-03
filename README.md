# MP4 / QuickTime FastStart for node.js v8
This package is the mp4 / quicktime faststart library which works with node.js' s v8 engine.  
When you pipe this media which is not faststart to ffmpeg you can pipe it to ffmpeg using this library. 

## Install
```
npm install node-faststart
```

## Example
Make thumbnail from videos not faststarted
https://github.com/wintu/node-faststart/blob/master/example/thumbnail.js

## Methods
```
convert(inputMedia: Buffer, outputPassThrough: Boolean)
// return converted buffer or stream(passthrough)

isFaststart(inputMedia: Buffer)
// return boolean as faststart
```

## License
Released under the MIT license https://github.com/wintu/node-faststart/blob/master/LICENSE
