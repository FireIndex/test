import express from 'express'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { Readable } from 'stream'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
const __dirname = path.resolve()
const cache = new Map() // Cache to store fetched and modified data along with timestamps

async function fetchDataAndModify(id) {
  if (cache.has(id)) {
    const { timestamp, data } = cache.get(id)
    const currentTime = Date.now()
    const timeDifference = currentTime - timestamp

    if (timeDifference <= 20000) {
      console.log('💻: ' + id) // Serving from cache
      // Check if data is within the 20-second window
      return data
    }
  }

  try {
    const link = `http://honeywatch.net:80/play/live.php?mac=00:1A:79:A5:9F:91&stream=${id}&extension=m3u8&play_token=TExu3Dc07Q`
    const response = await fetch(link, { timeout: 5000 })
    const fetchedData = await response.text()

    const modifiedData =
      fetchedData.replace(/\/hls\//g, '//82.115.12.142:8080/hls/') +
      `#EXT-X-ENDLIST\n` +
      `#EXT-X-DISCONTINUITY\n` +
      `#EXT-X-KEY:METHOD=AES-128,URI="${process.env.SERVER_URL}/video/${id}",IV=0x00000000`
    cache.set(id, { timestamp: Date.now(), data: modifiedData })

    console.log('☁️: ' + id) // Serving from API
    return modifiedData
  } catch (error) {
    console.error('Error fetching or modifying data:', error)
    throw new Error('Error fetching or modifying video data')
  }
}

// Endpoint to serve the modified .m3u8 file for download
app.get('/m3u8/:id', async (req, res) => {
  try {
    const { id } = req.params
    const modifiedData = await fetchDataAndModify(id)

    // Create a Readable stream from the string
    const stringStream = Readable.from((modifiedData || '').toString())

    // res.set({
    //   'Content-Type': 'text/plain',
    // 'Content-Type': 'application/vnd.apple.mpegurl',
    // 'Content-Disposition': `attachment; filename=${uuidv4()}.m3u8`,
    // })
    res.set('Content-Type', 'text/plain')
    // res.set('Content-Disposition', `attachment; filename=${uuidv4()}.m3u8`)

    stringStream.pipe(res)
  } catch (error) {
    console.log('Error fetching or modifying data:', error)
    res.status(500).send('Error fetching video')
  }
})

// Endpoint to serve index.html file
app.get('/html/:id', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})
app.get('/player/:id', (req, res) => {
  res.sendFile(__dirname + '/p.html')
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
