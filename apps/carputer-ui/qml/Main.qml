import QtQuick 6.5
import QtQuick.Controls 6.5
import QtQuick.Layouts 6.5

ApplicationWindow {
    id: root
    visible: true
    width: 1280
    height: 720
    color: "#101418"
    title: "Carputer Hub"
    flags: Qt.Window | Qt.FramelessWindowHint

    property string hubVersion: "0.1.0"
    property string currentTime: Qt.formatTime(new Date(), "hh:mm:ss")

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: root.currentTime = Qt.formatTime(new Date(), "hh:mm:ss")
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        spacing: 24

        RowLayout {
            Layout.fillWidth: true
            spacing: 16

            Label {
                text: "Carputer Hub"
                font.pixelSize: 48
                font.bold: true
                color: "#f5f6f7"
            }

            Item { Layout.fillWidth: true }

            Label {
                text: currentTime
                font.pixelSize: 24
                color: "#9aa0a6"
            }

            Label {
                text: "v" + hubVersion
                font.pixelSize: 24
                color: "#9aa0a6"
            }

            Label {
                id: wifiStatusLabel
                text: networkStatus.online ? "Wi-Fi: Online" : "Wi-Fi: Offline"
                font.pixelSize: 24
                font.bold: true
                color: networkStatus.online ? "#4caf50" : "#ef5350"
                background: Rectangle {
                    radius: 12
                    color: networkStatus.online ? "#1b3c22" : "#3d1e24"
                }
                padding: 12
            }
        }

        Label {
            text: "Hello World"
            font.pixelSize: 72
            font.bold: true
            color: "#f8fbff"
            Layout.alignment: Qt.AlignHCenter
            opacity: 0.85
        }

        Text {
            text: "Select an applet to begin"
            color: "#c7cbd1"
            font.pixelSize: 24
            Layout.alignment: Qt.AlignHCenter
        }

        GridLayout {
            Layout.fillWidth: true
            columns: 3
            columnSpacing: 24
            rowSpacing: 24

            Pane {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                padding: 24
                background: Rectangle {
                    radius: 16
                    color: "#182024"
                    border.color: "#24313a"
                }
                contentItem: Column {
                    spacing: 12
                    anchors.fill: parent
                    Label {
                        text: "System Status"
                        font.pixelSize: 28
                        font.bold: true
                        color: "#f8fbff"
                    }
                    Label {
                        text: "View hardware health, uptime, and performance metrics."
                        wrapMode: Text.WordWrap
                        font.pixelSize: 20
                        color: "#aeb6bf"
                    }
                }
            }

            Pane {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                padding: 24
                background: Rectangle { radius: 16; color: "#182024"; border.color: "#24313a" }
                contentItem: Column {
                    spacing: 12
                    anchors.fill: parent
                    Label {
                        text: "Connected Devices"
                        font.pixelSize: 28
                        font.bold: true
                        color: "#f8fbff"
                    }
                    Label {
                        text: "Manage touch input, HID controllers, and CAN gateways."
                        wrapMode: Text.WordWrap
                        font.pixelSize: 20
                        color: "#aeb6bf"
                    }
                }
            }

            Pane {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                padding: 24
                background: Rectangle { radius: 16; color: "#182024"; border.color: "#24313a" }
                contentItem: Column {
                    spacing: 12
                    anchors.fill: parent
                    Label {
                        text: "Applets"
                        font.pixelSize: 28
                        font.bold: true
                        color: "#f8fbff"
                    }
                    Label {
                        text: "Launch installed experiences such as Media, Navigation, or Diagnostics."
                        wrapMode: Text.WordWrap
                        font.pixelSize: 20
                        color: "#aeb6bf"
                    }
                }
            }

            Pane {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                padding: 24
                background: Rectangle { radius: 16; color: "#182024"; border.color: "#24313a" }
                contentItem: Column {
                    spacing: 12
                    anchors.fill: parent
                    Label {
                        text: "Settings"
                        font.pixelSize: 28
                        font.bold: true
                        color: "#f8fbff"
                    }
                    Label {
                        text: "Configure network, display, and update preferences."
                        wrapMode: Text.WordWrap
                        font.pixelSize: 20
                        color: "#aeb6bf"
                    }
                }
            }

            Pane {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                padding: 24
                background: Rectangle { radius: 16; color: "#182024"; border.color: "#24313a" }
                contentItem: Column {
                    spacing: 12
                    anchors.fill: parent
                    Label {
                        text: "About"
                        font.pixelSize: 28
                        font.bold: true
                        color: "#f8fbff"
                    }
                    Label {
                        text: "Review software versions, licensing, and support information."
                        wrapMode: Text.WordWrap
                        font.pixelSize: 20
                        color: "#aeb6bf"
                    }
                }
            }

            Pane {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                padding: 24
                background: Rectangle { radius: 16; color: "#182024"; border.color: "#24313a" }
                contentItem: Column {
                    spacing: 12
                    anchors.fill: parent
                    Label {
                        text: "Power"
                        font.pixelSize: 28
                        font.bold: true
                        color: "#f8fbff"
                    }
                    Label {
                        text: "Suspend, reboot, or safely shut down the Carputer."
                        wrapMode: Text.WordWrap
                        font.pixelSize: 20
                        color: "#aeb6bf"
                    }
                }
            }
        }

        Item { Layout.fillHeight: true }
    }

    Popup {
        id: updatePopup
        modal: true
        focus: true
        anchors.centerIn: parent
        visible: updateStatus.active
        padding: 24
        background: Rectangle {
            radius: 16
            color: "#1b2a33"
            border.color: "#4caf50"
            border.width: 2
        }

        contentItem: ColumnLayout {
            spacing: 16
            Label {
                text: "Applying Update"
                font.pixelSize: 32
                font.bold: true
                color: "#f8fbff"
                Layout.alignment: Qt.AlignHCenter
            }
            Label {
                text: updateStatus.message.length > 0 ? updateStatus.message : "Please wait while the system applies updates."
                font.pixelSize: 20
                wrapMode: Text.WordWrap
                color: "#c7cbd1"
                Layout.preferredWidth: 320
                Layout.alignment: Qt.AlignHCenter
            }
            BusyIndicator {
                running: updateStatus.active
                Layout.alignment: Qt.AlignHCenter
            }
        }
    }
}
