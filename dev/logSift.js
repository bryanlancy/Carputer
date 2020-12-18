const fs = require('fs')
let logFile = fs.readFileSync('./CANSniffer/CANLogs/28-11-2020_201923.log', 'utf-8')
let s = {}
logFile = logFile.split(/\r\n/g)
logFile.forEach((x, i) => (logFile[i] = x.split(', ')))
logFile.forEach(x => {
	const id = x[0].slice(x[0].split(/ +/g)[0].length + 1)
	if (id) {
		let data = x[1].slice(x[1].split(/ +/g)[0].length + 1)
		if (s[id]) {
			s[id].data[data] ? s[id].data[data]++ : (s[id].data[data] = 1)
			s[id].count++
		} else {
			s[id] = {
				count: 0,
				data: {
					[data]: 0,
				},
			}
		}
	}
})

Object.keys(s).forEach(id => {
	let idSum = Object.keys(s[id].data)
	idSum.forEach((v, i, a) => {
		na = v.split(' ')
		na.forEach((v, i, a) => {
			a[i] = parseInt(v, 16)
		})
		a[i] = na
	})
	console.log(s[id)
	console.log(idSum)
})
//console.log(s)
