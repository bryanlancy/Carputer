#include <QtGui/QGuiApplication>
#include <QtGui/QWindow>
#include <QtGui/QBackingStore>
#include <QtGui/QPainter>
#include <QtGui/QFont>
#include <QtGui/QScreen>
#include <QDebug>
#include <QTimer>
#include <QShowEvent>
#include <QResizeEvent>
#include <QExposeEvent>
#include <QFile>
#include <QTextStream>
#include <QJsonObject>
#include <QJsonDocument>
#include <QDateTime>
#include <unistd.h>
#include <sys/types.h>

// #region agent log
static void debugLog(const QString& location, const QString& message, const QJsonObject& data = QJsonObject(), const QString& hypothesisId = "") {
    QJsonObject logEntry;
    logEntry["timestamp"] = QDateTime::currentMSecsSinceEpoch();
    logEntry["location"] = location;
    logEntry["message"] = message;
    logEntry["data"] = data;
    logEntry["sessionId"] = "debug-session";
    logEntry["runId"] = "run1";
    if (!hypothesisId.isEmpty()) {
        logEntry["hypothesisId"] = hypothesisId;
    }
    QString jsonStr = QJsonDocument(logEntry).toJson(QJsonDocument::Compact);

    // Write to file if path exists (development machine)
    QFile logFile("/home/bryanb/Documents/Programming/Carputer/.cursor/debug.log");
    if (logFile.open(QIODevice::WriteOnly | QIODevice::Append)) {
        QTextStream stream(&logFile);
        stream << jsonStr << "\n";
        logFile.close();
    }

    // Always write to stderr so it appears in session log on device
    QTextStream(stderr) << "[DEBUG] " << location << ": " << message;
    if (!data.isEmpty()) {
        QTextStream(stderr) << " " << jsonStr;
    }
    QTextStream(stderr) << "\n";
}
// #endregion

class HelloWorldWindow : public QWindow
{
    QBackingStore *m_backingStore;

public:
    HelloWorldWindow() : QWindow(), m_backingStore(nullptr)
    {
        // #region agent log
        debugLog("HelloWorldWindow::HelloWorldWindow", "Window constructor called", QJsonObject{{"width", 800}, {"height", 480}}, "A");
        // #endregion
        setTitle("Carputer UI");
        resize(800, 480);
        m_backingStore = new QBackingStore(this);
        // #region agent log
        debugLog("HelloWorldWindow::HelloWorldWindow", "Window resized, backing store created", QJsonObject{{"width", width()}, {"height", height()}, {"isExposed", isExposed()}, {"isVisible", isVisible()}}, "A");
        // #endregion
    }

    ~HelloWorldWindow()
    {
        delete m_backingStore;
    }

protected:
    void exposeEvent(QExposeEvent *event) override
    {
        Q_UNUSED(event);
        // #region agent log
        debugLog("HelloWorldWindow::exposeEvent", "exposeEvent called", QJsonObject{{"isExposed", isExposed()}, {"width", width()}, {"height", height()}, {"isVisible", isVisible()}, {"geometry", QString("%1,%2 %3x%4").arg(geometry().x()).arg(geometry().y()).arg(geometry().width()).arg(geometry().height())}}, "B");
        // #endregion
        if (isExposed()) {
            // #region agent log
            debugLog("HelloWorldWindow::exposeEvent", "Window is exposed, calling render()", QJsonObject(), "B");
            // #endregion
            render();
        } else {
            // #region agent log
            debugLog("HelloWorldWindow::exposeEvent", "Window NOT exposed, skipping render()", QJsonObject(), "B");
            // #endregion
        }
    }

    void showEvent(QShowEvent *event) override
    {
        Q_UNUSED(event);
        // #region agent log
        debugLog("HelloWorldWindow::showEvent", "showEvent called", QJsonObject{{"isExposed", isExposed()}, {"isVisible", isVisible()}}, "B");
        // #endregion
        QWindow::showEvent(event);
    }

    void resizeEvent(QResizeEvent *event) override
    {
        // #region agent log
        debugLog("HelloWorldWindow::resizeEvent", "resizeEvent called", QJsonObject{{"oldSize", QString("%1x%2").arg(event->oldSize().width()).arg(event->oldSize().height())}, {"newSize", QString("%1x%2").arg(event->size().width()).arg(event->size().height())}, {"isExposed", isExposed()}}, "B");
        // #endregion
        QWindow::resizeEvent(event);
        if (m_backingStore) {
            m_backingStore->resize(event->size());
        }
        if (isExposed()) {
            // #region agent log
            debugLog("HelloWorldWindow::resizeEvent", "Window exposed after resize, calling render()", QJsonObject(), "B");
            // #endregion
            render();
        }
    }

    void render()
    {
        // #region agent log
        debugLog("HelloWorldWindow::render", "render() called", QJsonObject{{"isExposed", isExposed()}, {"width", width()}, {"height", height()}}, "C");
        // #endregion
        if (!isExposed()) {
            // #region agent log
            debugLog("HelloWorldWindow::render", "Window not exposed, returning early", QJsonObject(), "C");
            // #endregion
            return;
        }

        QRect rect(0, 0, width(), height());
        // #region agent log
        debugLog("HelloWorldWindow::render", "Before backing store beginPaint", QJsonObject{{"rect", QString("%1,%2 %3x%4").arg(rect.x()).arg(rect.y()).arg(rect.width()).arg(rect.height())}}, "C");
        // #endregion

        m_backingStore->beginPaint(rect);
        QPainter painter(m_backingStore->paintDevice());
        // #region agent log
        debugLog("HelloWorldWindow::render", "QPainter created", QJsonObject{{"painterActive", painter.isActive()}, {"device", painter.device() ? "valid" : "null"}}, "C");
        // #endregion

        if (!painter.isActive()) {
            // #region agent log
            debugLog("HelloWorldWindow::render", "ERROR: QPainter is not active!", QJsonObject{{"painterActive", false}}, "C");
            // #endregion
            m_backingStore->endPaint();
            return;
        }

        // Fill with black
        painter.fillRect(rect, Qt::black);
        // #region agent log
        debugLog("HelloWorldWindow::render", "Background filled", QJsonObject{{"rect", QString("%1,%2 %3x%4").arg(rect.x()).arg(rect.y()).arg(rect.width()).arg(rect.height())}}, "C");
        // #endregion

        // Set up font
        QFont font;
        font.setPixelSize(72);
        font.setBold(true);
        painter.setFont(font);
        painter.setPen(Qt::white);

        // Draw "Hello World" centered
        painter.drawText(rect, Qt::AlignCenter, "Hello World");
        // #region agent log
        debugLog("HelloWorldWindow::render", "Text drawn", QJsonObject{{"text", "Hello World"}}, "C");
        // #endregion

        painter.end();
        m_backingStore->endPaint();
        m_backingStore->flush(rect);
        // #region agent log
        debugLog("HelloWorldWindow::render", "Backing store flushed", QJsonObject(), "C");
        // #endregion

        qDebug() << "Rendered Hello World to window" << rect;
    }
};

int main(int argc, char *argv[])
{
    // #region agent log
    debugLog("main", "Application starting", QJsonObject{{"argc", argc}}, "A");
    // #endregion
    QGuiApplication app(argc, argv);
    // #region agent log
    debugLog("main", "QGuiApplication created", QJsonObject{{"platformName", app.platformName()}}, "A");
    // #endregion
    app.setOrganizationName("Carputer");
    app.setApplicationName("Carputer UI");

    // Enable Qt logging
    qSetMessagePattern("[%{type}] %{message}");

    qDebug() << "Creating Hello World window";
    qDebug() << "Platform:" << app.platformName();

    // Get screen info
    QScreen *screen = app.primaryScreen();
    // #region agent log
    debugLog("main", "Screen detection", QJsonObject{{"screenExists", screen != nullptr}}, "A");
    // #endregion
    if (screen) {
        // #region agent log
        debugLog("main", "Screen info", QJsonObject{{"geometry", QString("%1,%2 %3x%4").arg(screen->geometry().x()).arg(screen->geometry().y()).arg(screen->geometry().width()).arg(screen->geometry().height())}, {"size", QString("%1x%2").arg(screen->size().width()).arg(screen->size().height())}}, "A");
        // #endregion
        qDebug() << "Screen geometry:" << screen->geometry();
        qDebug() << "Screen size:" << screen->size();
    }

    // Create window
    HelloWorldWindow window;
    // #region agent log
    debugLog("main", "Window created", QJsonObject{{"geometry", QString("%1,%2 %3x%4").arg(window.geometry().x()).arg(window.geometry().y()).arg(window.geometry().width()).arg(window.geometry().height())}}, "A");
    // #endregion

    // Make fullscreen
    if (screen) {
        window.setGeometry(screen->geometry());
        // #region agent log
        debugLog("main", "Window geometry set to screen", QJsonObject{{"geometry", QString("%1,%2 %3x%4").arg(window.geometry().x()).arg(window.geometry().y()).arg(window.geometry().width()).arg(window.geometry().height())}}, "A");
        // #endregion
    }
    window.showFullScreen();
    // #region agent log
    debugLog("main", "showFullScreen() called", QJsonObject{{"isVisible", window.isVisible()}, {"isExposed", window.isExposed()}, {"geometry", QString("%1,%2 %3x%4").arg(window.geometry().x()).arg(window.geometry().y()).arg(window.geometry().width()).arg(window.geometry().height())}}, "A");
    // #endregion

    qDebug() << "Window created, geometry:" << window.geometry();
    qDebug() << "Window visible:" << window.isVisible();
    qDebug() << "Window exposed:" << window.isExposed();
    qDebug() << "Application starting event loop";

    // Force an initial render attempt after a short delay
    QTimer::singleShot(100, [&window]() {
        // #region agent log
        debugLog("main", "Delayed render attempt", QJsonObject{{"isVisible", window.isVisible()}, {"isExposed", window.isExposed()}, {"width", window.width()}, {"height", window.height()}}, "A");
        // #endregion
        if (window.isExposed()) {
            // #region agent log
            debugLog("main", "Window exposed in delayed callback, requesting update", QJsonObject(), "A");
            // #endregion
            window.requestUpdate();
        }
    });

    // #region agent log
    debugLog("main", "Entering event loop", QJsonObject(), "A");
    // #endregion
    return app.exec();
}

