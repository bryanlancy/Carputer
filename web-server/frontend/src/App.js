import { Switch, Route } from 'react-router-dom'

import Navbar from './components/Navbar'
import MainDisplay from './components/MainDisplay'

import { LEDControlsPage, TelemetryPage, ToolsPage } from './components/pages'


function App() {
	return (
		<div className="App">
			<Switch>
				<Route exact path="/">
					<MainDisplay />
				</Route>
				<Route path="/led_control">
					<LEDControlsPage />
				</Route>
				<Route path="/telemetry">
					<TelemetryPage />
				</Route>
				<Route path="/tools">
					<ToolsPage />
				</Route>
			</Switch>
			<Navbar />
		</div>
	)
}

export default App
