import { DataType } from '../../utils/dataTypeExtractor'

export interface LegendItem {
	id: string
	type: DataType
	icon: string
	label: string
}

export const LEGEND_DATA: LegendItem[] = [
	{
		id: 'user',
		type: 'User',
		icon: '👤',
		label: 'User',
	},
	{
		id: 'datetime',
		type: 'Date/Time',
		icon: '🕐',
		label: 'Date/Time',
	},
	{
		id: 'device',
		type: 'Device',
		icon: '📱',
		label: 'Device',
	},
	{
		id: 'command',
		type: 'Command',
		icon: '⚡',
		label: 'Command',
	},
]

/**
 * Get legend item by data type
 */
export function getLegendItemByType(type: DataType): LegendItem | undefined {
	return LEGEND_DATA.find(item => item.type === type)
}

