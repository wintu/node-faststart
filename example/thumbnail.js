const faststart = require('node-faststart')
const fs = require('fs')
const ffmpeg = require('fluent-ffmpeg')

;(async () => {
  const sampleBuffer = fs.readFileSync('./sample.mp4')
  const inputStream = faststart.convert(sampleBuffer, true)
  const result = await new Promise((resolve, reject) => {
    const bufs = []
    ffmpeg(inputStream)
      .outputOptions([
        '-ss 1',
        '-vframes 1'
      ])
      .format('image2')
      .on('error', err => console.log(err))
      .pipe()
      .on('data', chunk => bufs.push(chunk))
      .on('end', () => resolve(Buffer.concat(bufs)))
  })
  await fs.writeFileSync('./thumbnail.png', result)
})()
