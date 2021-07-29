import { Fragment, useEffect, useMemo, useState } from 'react'
import socketIOClient from 'socket.io-client'

import Tile from './Tile'

import './LEDControls.css'

export default function LEDControlsPage() {

	//!! add light preview
	//!! dots for led, use patterns from

	const [res, setRes] = useState('')
	const [patternMain, setPatternMain] = useState('')
	const [patternOptions, setPatternOptions] = useState({})
	const [showOptions, setShowOptions] = useState(false)
	const ENDPOINT = 'http://localhost:5000'

	function updateLEDPattern(type, value) {
		if (type === 'main') setShowOptions(false)
		const socket = socketIOClient(ENDPOINT, { transports: ['websocket'] })
		socket.emit('LED_UPDATE', { type, value }, data => {
			socket.disconnect()
			setPatternMain(value)
		})
	}
	function updateShowOptions(e, options) {
		console.log(e)
		e.stopPropagation()
		if (options) {
			setPatternOptions(options)
			setShowOptions(true)
		}
	}
	useEffect(() => {
		const socket = socketIOClient(ENDPOINT, { transports: ['websocket'] })
		socket.on('LED_UPDATE', data => {
			setRes(data)
		})
		return () => socket.disconnect();
	}, [])


	const options = useMemo(() => {
		const sections = []
		for (const section in patternOptions) {
			if (Object.hasOwnProperty.call(patternOptions, section)) {
				const options = patternOptions[section];
				console.log(section)
				sections.push(
					<div className="led-controls__options-section">
						<h3>{section}</h3>
						{options.map(option => {
							return option
						})}
					</div>)

			}
		}
		return sections
	}, [patternOptions])

	const defaultSettingsClick = (e, options) => { updateShowOptions(e, options) }
	const controls = [
		// rpms > single:Fill-SingleColor, change:Fill-ColorChange, multi:Fill-MultiColor
		{
			key: "rpm",
			title: 'Rpms',
			img: `${require('../../../images/icons/rpms.jpg').default}`,
			options: {
				colors: [
					<label>Color 1 <input type="color"></input></label>,
					<label>Color 2 <input type="color"></input></label>,
					<label>Color 3 <input type="color"></input></label>,
					<label>Color 4 <input type="color"></input></label>,
				]
			},
			clickEvents: {
				tile: () => updateLEDPattern('main', 'rpm'),
				settings: defaultSettingsClick
			}
			,
			font: {
				fontFamily: 'Bamf',
				fontSize: '16px',
				fontDesc: {
					fontSize: '14px'
				}
			},
			desc: 'visualize the Vrooms'
		},
		{
			key: "kitt",
			title: 'Kitt',
			img: `${require('../../../images/icons/kitt.jpg').default}`,
			clickEvents: {
				tile: () => updateLEDPattern('main', 'kitt'),
				settings: defaultSettingsClick
			},
			desc: 'Classic Knight Rider',
			font: {
				fontFamily: 'Ruben'
			}

		},
		{
			key: "turnSignal",
			title: 'Turn Signal',
			img: `${require('../../../images/icons/turn-signal.jpeg').default}`,
			clickEvents: {
				tile: () => updateLEDPattern('main', 'turnSignal'),
				settings: defaultSettingsClick
			},
			font: {
				fontFamily: 'Axaxax'
			},
			desc: <Fragment>You know, like the <span style={{ fontFamily: "Las Enter Personal Use Only" }}>fancy</span> cars</Fragment>
		},
	]

	return (
		<div className="page">
			<div className="led-controls">
				<div className="page__title">
					<h1>LED Controls</h1>
				</div>
				<div className="led-controls__buttons">
					{
						controls.map(settings => {
							const { key } = settings
							return <Tile key={key} props={{ ...settings }} className={key === patternMain ? 'selected' : ''} />
						})
					}
				</div>

				<div className="led-controls__options" style={{ height: showOptions ? '25%' : '0', opacity: showOptions ? '100%' : '0' }}>
					<p>Options</p>
					<div className="led-controls__options-list">{options}</div>
					<p>{res}</p>
				</div>

			</div>
		</div >
	)
}
