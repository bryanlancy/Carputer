import { Switch, Route } from 'react-router-dom'

import { HomePage, LEDControlsPage, TelemetryPage, ToolsPage, GamesPage, HiddenPage } from './components/pages'
import Navbar from './components/Navbar'


function App() {
	return (
		<div className="App">
			<Switch>
				<Route exact path="/">
					<HomePage />
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
				<Route path="/games">
					<GamesPage />
				</Route>
				<Route path="/hidden">
					<HiddenPage />
				</Route>
			</Switch>
			<Navbar />

		</div>
	)
}

export default App
