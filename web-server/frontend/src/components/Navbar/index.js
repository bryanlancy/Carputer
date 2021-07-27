import { NavLink } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
	return (
		<div className="navbar">
			<NavLink to="/">Home</NavLink>
			<NavLink to="/settings">Settings</NavLink>
		</div>
	)
}
