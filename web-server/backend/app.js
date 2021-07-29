const SerialPort = require('serialport')

const express = require('express')
const http = require('http')
const socketIo = require('socket.io')

const port = process.env.PORT || 5000
const index = require('./routes/')

let serial


async function setupPorts() {
	//! Temp, may not work with multiple serial streams
	const ports = await SerialPort.list()
	for (let i = 0; i < ports.length; i++) {
		const { manufacturer } = ports[i];
		//Check for devices with the string 'Arduino' in manufacturer property
		if (manufacturer ? manufacturer.includes('Arduino') : false) {
			console.log(`Arduino detected at port '${ports[i].path}'`)
			serial = new SerialPort(ports[i].path, { baudRate: 57600 }, err => {
				if (err) {
					console.log('Serial Connection Error: ', err)
					serial = null

				}
			})

		}
	}
	//! HARDCODED OFF FOR TESTING, should move to so is only turned on with socket connection
	if (serial) {
		console.log('Serial port: Succesfully connected.')
		console.log('Serial port: Setting up event handlers...')

		const Readline = SerialPort.parsers.Readline
		const parser = serial.pipe(new Readline())

		//? START OF LED SWITCH SERIAL EVENT HANDLERS
		parser.on('data', data => {
			try {
				const json = JSON.parse(data)
				console.log("json", json)

			} catch (error) {
				console.log("error converting to json")
			}
		})

		//? END OF SERIAL PORT EVENT HANDLERS
		console.log('Serial port: Event handlers added.')
	} else {
		console.log('Serial port: Not connected')
	}
}
function setupSockets(server) {
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

		//REQUIRES SERIAL COMMUNICATION
		const Readline = SerialPort.parsers.Readline
		const parser = serial.pipe(new Readline())
		socket.on('LED_UPDATE', (data, cb) => {
			let { type, value } = data
			if (serial) {
				switch (type) {
					case 'main':
						type = 'a'
						switch (value) {
							case 'rpm':
								value = 'a'
								break;
							case 'turnSignal':
								value = 'b'
								break;
							case 'kitt':
								value = 'c'
								break;

							default:
								break;
						}
						break;
					case 'sub':
						type = 'b'
						switch (value) {
							case 'rpmSingle':
								value = 'a'
								break;
							case 'rpmChange':
								value = 'b'
								break;
							case 'rpmMulti':
								value = 'b'
								break;
							default:
								break;
						}
						break;
					default:
						break;
				}

				const command = `${type}=${value}`
				serial.write(command);
				socket.emit('LED_UPDATE')
				cb('UPDATE LED')
			} else {
				cb('No serial connection.')
			}

		})
	})

	const getApiAndEmit = socket => {
		const response = new Date()
		// Emitting a new message. Will be consumed by the client
		socket.emit('FromAPI', response)
	}
}

async function setupServer() {
	const app = express()
	app.use(index)

	const server = http.createServer(app)

	await setupPorts()
	setupSockets(server)
	server.listen(port, () => console.log(`Listening on port ${port}`))
}

setupServer()




