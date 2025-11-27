'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import styles from './page.module.scss'
import { getApiUrl } from '../utils/api'
import { useWebSocket, WebSocketMessage } from '../hooks/useWebSocket'

interface Device {
  id: number
  device_id: string
  hostname: string | null
  vin: string | null
  hardware_rev: string | null
  build_id: string | null
  current_version: string | null
  current_build_id: string | null
  current_ip: string | null
  uptime: number | string | null
  services_status: Record<string, boolean> | null
  status: string
  last_seen: string | null
  created_at: string
  updated_at: string
}

type SortField = 'status' | 'hostname' | 'device_id' | 'current_ip' | 'last_seen'
type SortDirection = 'asc' | 'desc'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'device_update' && message.device) {
      const device = message.device as Device

      // Update device in state
      setDevices((prevDevices) => {
        const deviceIndex = prevDevices.findIndex((d) => d.id === device.id)
        if (deviceIndex >= 0) {
          // Update existing device
          const updated = [...prevDevices]
          updated[deviceIndex] = device
          return updated
        } else {
          // Add new device
          return [...prevDevices, device]
        }
      })
    }
  }, [])

  // Subscribe to WebSocket updates
  const { connected } = useWebSocket(handleWebSocketMessage, ['devices'])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const apiUrl = getApiUrl()
        const response = await fetch(`${apiUrl}/api/devices`)
        if (response.ok) {
          const data = await response.json()
          setDevices(data)
        }
      } catch (error) {
        console.error('Failed to fetch devices:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
    // Only refresh periodically if realtime is not connected
    if (!connected) {
      const interval = setInterval(fetchDevices, 15000)
      return () => clearInterval(interval)
    }
  }, [connected])

  // Sort devices
  const sortedDevices = useMemo(() => {
    const sorted = [...devices]

    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'status':
          // Sort status with online first
          const statusOrder: Record<string, number> = { online: 0, offline: 1, stale: 2, maintenance: 3 }
          aValue = statusOrder[a.status] ?? 999
          bValue = statusOrder[b.status] ?? 999
          break
        case 'hostname':
          aValue = (a.hostname || a.device_id || '').toLowerCase()
          bValue = (b.hostname || b.device_id || '').toLowerCase()
          break
        case 'device_id':
          aValue = (a.device_id || '').toLowerCase()
          bValue = (b.device_id || '').toLowerCase()
          break
        case 'current_ip':
          aValue = a.current_ip || ''
          bValue = b.current_ip || ''
          break
        case 'last_seen':
          aValue = a.last_seen ? new Date(a.last_seen).getTime() : 0
          bValue = b.last_seen ? new Date(b.last_seen).getTime() : 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [devices, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getMdnsAddress = (device: Device): string => {
    if (device.hostname) {
      return `${device.hostname}.local`
    }
    return `${device.device_id}.local`
  }

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'online':
        return styles.statusOnline
      case 'offline':
        return styles.statusOffline
      case 'stale':
        return styles.statusStale
      case 'maintenance':
        return styles.statusMaintenance
      default:
        return styles.statusUnknown
    }
  }

  const formatUptime = (seconds: number | string | null): string => {
    if (!seconds) return 'N/A'
    const numSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds
    if (isNaN(numSeconds)) return 'N/A'
    const days = Math.floor(numSeconds / 86400)
    const hours = Math.floor((numSeconds % 86400) / 3600)
    const minutes = Math.floor((numSeconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading devices...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Devices</h1>
        <p>Manage and monitor fleet devices {connected && <span className={styles.realtimeIndicator}>(Live)</span>}</p>
      </header>

      <main className={styles.main}>
        {devices.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No devices registered yet.</p>
            <p>Devices will appear here after registration.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.devicesTable}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('status')} className={styles.sortable}>
                    Status
                    {sortField === 'status' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => handleSort('hostname')} className={styles.sortable}>
                    Device Name
                    {sortField === 'hostname' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => handleSort('device_id')} className={styles.sortable}>
                    Device ID
                    {sortField === 'device_id' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>mDNS Address</th>
                  <th onClick={() => handleSort('current_ip')} className={styles.sortable}>
                    IP Address
                    {sortField === 'current_ip' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>Version</th>
                  <th onClick={() => handleSort('last_seen')} className={styles.sortable}>
                    Last Seen
                    {sortField === 'last_seen' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>Uptime</th>
                </tr>
              </thead>
              <tbody>
                {sortedDevices.map((device) => (
                  <tr key={device.id} className={styles.deviceRow}>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className={styles.deviceName}>
                      {device.hostname || device.device_id}
                      {device.vin && (
                        <span className={styles.vin}>{device.vin}</span>
                      )}
                    </td>
                    <td className={styles.deviceId}>{device.device_id}</td>
                    <td className={styles.mdnsAddress}>{getMdnsAddress(device)}</td>
                    <td className={styles.ipAddress}>{device.current_ip || '—'}</td>
                    <td className={styles.version}>
                      {device.current_build_id || device.current_version || '—'}
                    </td>
                    <td className={styles.lastSeen}>
                      {device.last_seen
                        ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })
                        : 'Never'}
                    </td>
                    <td className={styles.uptime}>{formatUptime(device.uptime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

