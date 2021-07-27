const SerialPort = require('serialport')
//! Temp, may not work with multiple serial streams
let serial
SerialPort.list().then(ports => {
	console.log('ports: ', ports)
	ports.forEach(function (port) {
		const check = port.manufacturer.includes('Arduino')
		if (check) {
			console.log(port.path)
		}
	})
})
// const serial = new SerialPort('/dev/tty-usbserial1')

const express = require('express')
const http = require('http')
const socketIo = require('socket.io')

const port = process.env.PORT || 5000
const index = require('./routes/')

const app = express()
app.use(index)

const server = http.createServer(app)

const io = socketIo(server)

let interval

io.on('connection', socket => {
	console.log('New client connected')
	if (interval) {
		clearInterval(interval)
	}
	interval = setInterval(() => getApiAndEmit(socket), 1000)
	socket.on('disconnect', () => {
		console.log('Client disconnected')
		clearInterval(interval)
	})
	socket.on('LED_UPDATE', (data, cb) => {
		console.log('Update LED')
		console.log(data)

		cb('UPDATE LED')
	})
})

const getApiAndEmit = socket => {
	const response = new Date()
	// Emitting a new message. Will be consumed by the client
	socket.emit('FromAPI', response)
}

server.listen(port, () => console.log(`Listening on port ${port}`))
