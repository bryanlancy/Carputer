import { NavLink } from 'react-router-dom'

import './MainDisplay.css'

export default function MainDisplay() {
	return (
		<div className="controls page">
			<div className="controls__grid">
				<NavLink to="/led_control">LED Controls</NavLink>
				<NavLink to="/telemtry">Telemetry</NavLink>
			</div>
		</div>
	)
}
