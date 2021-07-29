import { NavLink } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
	return (
		<div className="navbar">
			<NavLink to="/"><i className="fas fa-home-lg"></i></NavLink>
			<NavLink to="/settings"><i className="fas fa-cog"></i></NavLink>
		</div>
	)
}
