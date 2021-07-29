import { NavLink } from 'react-router-dom'

import './MainDisplay.css'

export default function MainDisplay() {


	const icons = [
		{
			to: '/led_control',
			className: 'fas fa-lights-holiday',
			label: 'LED Control'
		},
		{
			to: '/telemetry',
			className: 'fad fa-chart-bar',
			label: 'Telemtry'
		},
		{
			to: '/tools',
			className: 'fad fa-toolbox',
			label: 'Tools'
		},
	]



	return (
		<div className="controls page">
			<div className="controls__grid">
				{icons.map(icon => {
					const { to, className, label } = icon
					return <NavLink to={to}><i className={className}></i><p>{label}</p></NavLink>
				})}
			</div>
		</div>
	)
}
