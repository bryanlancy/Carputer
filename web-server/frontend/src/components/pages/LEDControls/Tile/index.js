import './Tile.css'

export default function Tile({ props, className }) {
    const { img, clickEvents, title, desc, font, options } = props
    const { tile: tileClick, settings: settingsClick } = clickEvents
    const { fontFamily, fontSize, fontTitle, fontDesc } = font

    //! if desc is given, create info button
    //! on click, "Flip" card for desc

    function infoClick(e) {
        e.stopPropagation()
    }


    return (
        <div onClick={tileClick} className={`tile ${className}`}>
            <img src={img} alt={title} />
            <div className="tile__body" style={{ fontFamily, fontSize }}>
                <h3 style={{ fontFamily: fontTitle?.fontFamily, fontSize: fontTitle?.fontSize }}>{title}</h3>
                <p style={{ fontFamily: fontDesc?.fontFamily, fontSize: fontDesc?.fontSize }}>{desc}</p>
                <div className="tile__buttons">
                    {desc && <button onClick={infoClick}><i className="fas fa-info-circle"></i></button>}
                    {settingsClick && options && <button onClick={e => settingsClick(e, options)}><i className="fal fa-sliders-v"></i></button>}
                </div>
            </div>
        </div>
    )
}
