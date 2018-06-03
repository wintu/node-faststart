const stream = require('stream')

const MAX_UINT32 = Math.pow(2, 32) - 1
const MAX_UINT64 = Math.pow(2, 52) - 1

const makeBoxArray = (buffer, offset) => {
  const boxes = []
  let bufOffset = 0
  while (bufOffset < buffer.length) {
    const buf = buffer.slice(bufOffset, buffer.length)
    let size = buf.readUInt32BE(0, true)
    const type = buf.toString('ascii', 4, 8)
    let skip = 8
    if (size === 1 && buf.byteLength === 16) {
      size = buf.readUInt32BE(8, true) * Math.pow(2, 32) + buf.readUInt32BE(12, true)
      if (size <= MAX_UINT64) {
        throw new Error('file size is too large.')
      }
      skip = 16
    }
    boxes.push({buf: buf.slice(0, size), offset: (bufOffset + offset), type, skip})
    bufOffset += size
  }
  return boxes
}

const boxesToBuffer = (boxes, length) => {
  const bufArray = boxes.map(box => box.buf)
  return Buffer.concat(bufArray, length)
}

const childrenToBuffer = (boxes, parentBox) => {
  const buf = new Buffer(parentBox.skip)
  if (parentBox.skip === 16) {
    buf.writeUInt32BE(1, 0, true)
    buf.writeUInt32BE(parentBox.buf.length >> 32, 8, true)
    buf.writeUInt32BE(parentBox.buf.length, 12, true)
  } else {
    buf.writeUInt32BE(parentBox.buf.length, 0, true)
  }
  buf.write(parentBox.type, 4, 4, 'ascii')
  const bufArray = boxes.map(box => box.buf)
  bufArray.unshift(buf)
  return Buffer.concat(bufArray, parentBox.buf.length)
}

const output = (buffer, outputPassThrough) => {
  if (!outputPassThrough) return buffer
  const inputStream = new stream.PassThrough()
  inputStream.end(buffer)
  return inputStream
}

module.exports = {
  convert (buffer, outputPassThrough = false) {
    if (this.isFaststart(buffer)) return output(buffer, outputPassThrough)
    let boxes = makeBoxArray(buffer, 0)
    let moovIdx = boxes.findIndex(box => box.type === 'moov')
    const tmpBuffer = boxesToBuffer([boxes[0], boxes[moovIdx]].concat(boxes.slice(1, moovIdx)), buffer.length)
    moovIdx = 1
    boxes = makeBoxArray(tmpBuffer, 0)
    const moovChildren = makeBoxArray(boxes[moovIdx].buf.slice(boxes[moovIdx].skip, boxes[moovIdx].buf.length), boxes[moovIdx].offset)
    moovChildren.forEach((box, idx) => {
      if (box.type === 'trak') {
        const trak = box
        const trakChildren = makeBoxArray(trak.buf.slice(trak.skip, trak.buf.length), trak.offset + trak.skip)
        const mdiaIdx = trakChildren.findIndex(box => box.type === 'mdia')
        const mdiaChildren = makeBoxArray(trakChildren[mdiaIdx].buf.slice(trakChildren[mdiaIdx].skip, trakChildren[mdiaIdx].buf.length), trakChildren[mdiaIdx].offset + trakChildren[mdiaIdx].skip)
        const minfIdx = mdiaChildren.findIndex(box => box.type === 'minf')
        const minfChildren = makeBoxArray(mdiaChildren[minfIdx].buf.slice(mdiaChildren[minfIdx].skip, mdiaChildren[minfIdx].buf.length), mdiaChildren[minfIdx].offset + mdiaChildren[minfIdx].skip)
        const stblIdx = minfChildren.findIndex(box => box.type === 'stbl')
        const stblChildren = makeBoxArray(minfChildren[stblIdx].buf.slice(minfChildren[stblIdx].skip, minfChildren[stblIdx].buf.length), minfChildren[stblIdx].offset + minfChildren[stblIdx].skip)
        const stcoIdx = stblChildren.findIndex(box => box.type === 'stco')
        const co64Idx = stblChildren.findIndex(box => box.type === 'co64')

        if (stcoIdx !== -1) {
          const count = stblChildren[stcoIdx].buf.readUInt32BE(12, true)
          for (let i = 0, pos = 16; i < count; i++, pos += 4) {
            const offset = stblChildren[stcoIdx].buf.readUInt32BE(pos, true) + boxes[moovIdx].buf.length
            if (offset > MAX_UINT32) {
              throw new Error('this file is inappropriate.')
            }
            stblChildren[stcoIdx].buf.writeUInt32BE(offset, pos, true)
          }
        } else if (co64Idx !== -1) {
          const count = stblChildren[co64Idx].buf.readUInt32BE(12, true)
          for (let i = 0, pos = 16; i < count; i++, pos += 8) {
            let hi = stblChildren[co64Idx].buf.readUInt32BE(pos, true)
            let lo = stblChildren[co64Idx].buf.readUInt32BE(pos + 4, true) + boxes[moovIdx].buf.length
            while (lo > MAX_UINT32) {
              lo -= MAX_UINT32 + 1
              hi += 1
            }
            stblChildren[co64Idx].buf.writeUInt32BE(hi, pos, true)
            stblChildren[co64Idx].buf.writeUInt32BE(lo, pos + 4, true)
          }
        } else {
          throw new Error('The file structure could not be read.')
        }
        minfChildren[stblIdx].buf = childrenToBuffer(stblChildren, minfChildren[stblIdx])
        mdiaChildren[minfIdx].buf = childrenToBuffer(minfChildren, mdiaChildren[minfIdx])
        trakChildren[mdiaIdx].buf = childrenToBuffer(mdiaChildren, trakChildren[mdiaIdx])
        box.buf = childrenToBuffer(trakChildren, box)
      }
    })
    boxes[moovIdx].buf = childrenToBuffer(moovChildren, boxes[moovIdx])
    return output(boxesToBuffer(boxes, buffer.length), outputPassThrough)
  },

  isFaststart (buffer) {
    const boxes = makeBoxArray(buffer, 0)
    return boxes.findIndex(box => box.type === 'moov') < boxes.findIndex(box => box.type === 'mdat')
  }
}
