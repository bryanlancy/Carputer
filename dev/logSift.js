const { readdirSync, readFileSync } = require('fs')

function sortLogFolder(folder) {
	const logFolder = readdirSync(folder)
	let summary = {}
	const _HexToDecimal = (...values) => values.map(hex => parseInt(hex, 16)).join(' ')
	logFolder.forEach((file, i) => {
		const logFile = readFileSync(`./CANSniffer/CANLogs/${file}`, 'utf-8')
		const logArray = logFile.split(/\r\n/g)
		logArray.forEach((line, j) => {
			line = line.split(', ')
			if (line[0] && line[1]) {
				try {
					const id = line[0].split(' ')[1] //strip id label
					let entry = line[1].substr(line[1].indexOf(' ') + 1).split(' ') //strip data label, convert to array
					let len = entry.length
					//console.log(len)
					entry = _HexToDecimal(...entry)
					if (summary[id]) {
						if (summary[id].data[entry]) {
							summary[id].data[entry]++
						} else {
							summary[id].data.entries++
							summary[id].data[entry] = 1
						}
						summary[id].avgLeng = (summary[id].avgLeng + len) / 2
						summary[id].count++
					} else {
						let label
						switch (id) {
							case '153':
								label = `ID:${id} - Not Decoded`
								break
							case '260':
								label = `ID:${id} - Not Decoded`
								break
							case '280':
								label = `ID:${id} - Not Decoded`
								break
							case '316':
								label = `ID:${id} - Not Decoded`
								break
							case '329':
								label = `ID:${id} - Not Decoded`
								break
							case '370':
								label = `ID:${id} - Not Decoded`
								break
							case '440':
								label = `ID:${id} - Not Decoded`
								break
							case '545':
								label = `ID:${id} - Not Decoded`
								break
							case '5F0':
								label = `ID:${id} - Not Decoded`
								break
							case '43F':
								label = `ID:${id} - Not Decoded`
								break
							case 'A0':
								label = `ID:${id} - Not Decoded`
								break
							case '2A0':
								label = `ID:${id} - Not Decoded`
								break
							case 'A1':
								label = `ID:${id} - Not Decoded`
								break
							case '18F':
								label = `ID:${id} - Not Decoded`
								break
							case '1F0':
								label = `ID:${id} - Not Decoded`
								break
							case '5A0':
								label = `ID:${id} - Not Decoded`
								break
							case '1F1':
								label = `ID:${id} - Not Decoded`
								break
							case '5A1':
								label = `ID:${id} - Not Decoded`
								break
							default:
								label = 'Unknown Code'
								break
						}
						summary[id] = {
							id: id,
							label: label,
							count: 0,
							avgLeng: len,
							data: {
								entries: 0,
								[entry]: 0,
							},
						}
					}
				} catch (error) {
					throw new Error(`File: ${logFolder[i]}\nLine #${j + 1}\nLine: ${line}\n${error}`)
				}
			}
		})
	})

	return summary
}
const sum = sortLogFolder('./CANSniffer/CANLogs/')

for (const key in sum) {
	if (sum[key].label === 'Unknown Code') console.log(key)
	if (sum[key].label.indexOf('Not Decoded') >= 0) console.log(sum[key].label)
}
