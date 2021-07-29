import './BackgroundVideo.css'
export default function BackgroundVideo({ src }) {
    return (
        <video autoPlay muted loop className="background-video">
            <source src={require(src).default} type="video/mp4" />
        </video>
    )
}
