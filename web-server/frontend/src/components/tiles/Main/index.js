import { useEffect, useMemo, useState } from "react"
import { NavLink } from "react-router-dom"

import './TileMain.css'

export default function Tile({ props }) {
    const { to, className, label, bg } = props
    const { gradient, rot } = bg
    const [rotation, setRotation] = useState(0)
    const randomRotationSpeed = () => Math.floor((Math.random() * (60 - 25)) + 25)
    const [rotationSpeed, setRotationSpeed] = useState(randomRotationSpeed())


    useEffect(() => {
        const interval = setInterval(() => {
            const newRot = rotation + 1
            if (newRot > 360) {
                setRotationSpeed(randomRotationSpeed())
                setRotation(0)
            } else {
                setRotation(newRot);
            }
        }, rotationSpeed);
        return () => clearInterval(interval)
    }, [rotation]);


    console.log()
    const background = useMemo(() => {
        let str = ''
        for (let i = 0; i < gradient.length; i++) {
            str += ''
            if (str) str += ','
            const calcRotation = rotation + rot[i]
            str += `linear-gradient(${calcRotation < 360 ? calcRotation : calcRotation - 360}deg, ${gradient[i]})`
        }
        return str
    }, [rotation])

    return (
        <NavLink to={to} className="tile-main" style={{ background: background || '#fff' }}>
            <i className={className}></i>
            <p>{label}</p>
        </NavLink>
    )
}
