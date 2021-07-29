import Widget from '../../Widget'
import Tile from '../../tiles/Main'
import BackgroundVideo from '../../BackgroundVideo'

import './MainDisplay.css'

export default function MainDisplay() {

	const icons = [
		{
			to: '/led_control',
			className: 'fas fa-lightbulb-on',
			label: 'LEDs',
			bg: {
				gradient: ['rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%', 'rgba(0, 255, 0, .8), rgba(0, 255, 0, 0) 70.71%', 'rgba(0, 0, 255, .8), rgba(0, 0, 255, 0) 70.71%'],
				rot: [217, 127, 336]

			}
		},
		{
			to: '/telemetry',
			className: 'fas fa-chart-bar',
			label: 'Telemetry',

			bg: {
				gradient: ['rgba(149,58,180,1) 0%, rgba(182,29,253,1) 50%, rgba(98,69,252,1) 100%'],
				rot: [159]

			}
		},
		{
			to: '/tools',
			className: 'fas fa-tools',
			label: 'Tools',
			bg: {
				gradient: ['rgba(198,65,65,1) 0%, rgba(235,83,37,1) 35%, rgba(225,179,29,1) 100%'],
				rot: [355]

			}
		},
		{
			to: '/games',
			className: 'far fa-game-console-handheld',
			label: 'Games',
			bg: {
				gradient: ['rgba(34,193,195,1) 0%, rgba(78,125,64,1) 89%'],
				rot: [159]

			}
		},
		{
			to: '/hidden',
			className: 'far fa-user-secret',
			label: 'H4X0R',
			bg: {
				gradient: ['rgba(33,0,0,1) 0%, rgba(67,15,15,1) 40%, rgba(106,8,8,1) 100%'],
				rot: [159]

			}

		},
	]

	return (
		<div className="main-controls page">

			<Widget />
			<div className="main-controls__grid">
				{icons.map(icon => {
					return <Tile key={`tile-${icon.label}`} props={icon} />
				})}
			</div>
			<Widget />
			<video autoPlay muted loop className="background-video">
				<source src={require('assets/videos/dancer.mp4').default} type="video/mp4" />
			</video>
			{/* <BackgroundVideo src='assets/videos/dancer.mp4' /> */}
		</div>
	)
}
