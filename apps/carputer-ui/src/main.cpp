#include <QtGui/QGuiApplication>
#include <QtQml/QQmlApplicationEngine>
#include <QtQml/QQmlContext>
#include <QtQuickControls2/QQuickStyle>

#include "NetworkStatus.h"
#include "UpdateStatus.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setOrganizationName("Carputer");
    app.setApplicationName("Carputer UI");

    QQuickStyle::setStyle(QStringLiteral("Basic"));

    NetworkStatus networkStatus;
    UpdateStatus updateStatus;

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("networkStatus"), &networkStatus);
    engine.rootContext()->setContextProperty(QStringLiteral("updateStatus"), &updateStatus);
    const QUrl url(QStringLiteral("qrc:/qt/qml/Carputer/Main.qml"));
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated, &app,
                     [url](QObject *obj, const QUrl &objUrl) {
                         if (!obj && url == objUrl)
                             QCoreApplication::exit(-1);
                     }, Qt::QueuedConnection);
    engine.load(url);

    return app.exec();
}

