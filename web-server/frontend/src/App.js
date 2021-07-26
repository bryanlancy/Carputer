import { Switch, Route } from 'react-router-dom'
import LEDControl from './LEDControl'

function App() {
	return (
		<div className="App">
			<Switch>
				<Route path="/led_control">
					<LEDControl />
				</Route>
			</Switch>
		</div>
	)
}

export default App
