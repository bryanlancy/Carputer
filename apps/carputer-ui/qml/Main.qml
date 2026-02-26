import QtQuick 6.5
import QtQuick.Controls 6.5
import QtQuick.Window 6.5

ApplicationWindow {
    id: root
    visible: true
    width: Screen.width
    height: Screen.height
    color: "#101418"
    title: "Carputer Hub"
    flags: Qt.Window | Qt.FramelessWindowHint

    // One rectangle in each corner; size scales with screen (20% of smaller dimension, with margin)
    readonly property int margin: Math.max(8, Math.min(width, height) / 40)
    readonly property int boxSize: Math.max(40, (Math.min(width, height) - 2 * margin) / 5)

    Rectangle {
        id: topLeft
        x: root.margin
        y: root.margin
        width: root.boxSize
        height: root.boxSize
        radius: 8
        color: "#182024"
        border.color: "#24313a"
        border.width: 1
    }

    Rectangle {
        id: topRight
        x: root.width - root.margin - root.boxSize
        y: root.margin
        width: root.boxSize
        height: root.boxSize
        radius: 8
        color: "#182024"
        border.color: "#24313a"
        border.width: 1
    }

    Rectangle {
        id: bottomLeft
        x: root.margin
        y: root.height - root.margin - root.boxSize
        width: root.boxSize
        height: root.boxSize
        radius: 8
        color: "#182024"
        border.color: "#24313a"
        border.width: 1
    }

    Rectangle {
        id: bottomRight
        x: root.width - root.margin - root.boxSize
        y: root.height - root.margin - root.boxSize
        width: root.boxSize
        height: root.boxSize
        radius: 8
        color: "#182024"
        border.color: "#24313a"
        border.width: 1
    }
}
