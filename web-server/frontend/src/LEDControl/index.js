import './LEDControl.css';

const SerialPort = require('serialport');
export default function LEDControl() {
	function updateLEDPattern() {
		// SerialPort.list((err, ports) => {
		// 	console.log(ports)
		// })
	}

	return (
		<div className="led-controls">
			<h1>LED Control</h1>
			<button onClick={() => updateLEDPattern('main', 'rpm')}>RPMs</button>
			<button onClick={() => updateLEDPattern('main', 'turn')}>Turn Signal</button>
			<button onClick={() => updateLEDPattern('main', 'kitt')}>Kitt</button>
		</div>
	)
}
