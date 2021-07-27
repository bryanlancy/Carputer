import { Switch, Route } from 'react-router-dom'

import Navbar from './components/Navbar'
import MainDisplay from './components/MainDisplay'
import LEDControl from './components/LEDControl'

function App() {
	return (
		<div className="App">
			<Switch>
				<Route exact path="/">
					<MainDisplay />
				</Route>
				<Route path="/led_control">
					<LEDControl />
				</Route>
			</Switch>
			<Navbar />
		</div>
	)
}

export default App
