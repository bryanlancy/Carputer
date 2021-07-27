import { useState, useEffect, useRef } from 'react'
import socketIOClient from 'socket.io-client'

import './LEDControl.css'

export default function LEDControl() {
	const [res, setRes] = useState('')
	const ENDPOINT = 'http://localhost:5000'

	function updateLEDPattern(main, sub) {
		const socket = socketIOClient(ENDPOINT, { transports: ['websocket'] })
		socket.emit('LED_UPDATE', { main, sub }, data => {
			console.log(data)
			socket.disconnect()
		})
	}

	return (
		<div className="led-controls page">
			<h1>LED Control</h1>
			<button onClick={() => updateLEDPattern('main', 'rpm')}>RPMs</button>
			<button onClick={() => updateLEDPattern('main', 'turn')}>Turn Signal</button>
			<button onClick={() => updateLEDPattern('main', 'kitt')}>Kitt</button>
		</div>
	)
}
