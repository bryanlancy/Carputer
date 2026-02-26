#include <QtGui/QGuiApplication>
#include <QtGui/QWindow>
#include <QtGui/QBackingStore>
#include <QtGui/QPainter>
#include <QtGui/QFont>
#include <QtGui/QFontDatabase>
#include <QtGui/QScreen>
#include <QDebug>
#include <QTimer>
#include <QShowEvent>
#include <QResizeEvent>
#include <QExposeEvent>
#include <QFile>
#include <QFileInfo>
#include <QTextStream>
#include <QDir>
#include <QJsonObject>
#include <QJsonDocument>
#include <QDateTime>
#include <unistd.h>
#include <sys/types.h>

// Boot log: always append to a file on the device for SSH debugging (path from env or default).
static void bootLog(const char* location, const char* message, int w = -1, int h = -1, bool isExposed = false) {
    QString path = qEnvironmentVariable("CARPUTER_UI_LOG");
    if (path.isEmpty()) {
        QString home = qEnvironmentVariable("HOME", "/home/carputer");
        path = home + "/.local/share/carputer/logs/carputer-ui.log";
    }
    QDir::root().mkpath(QFileInfo(path).absolutePath());
    QFile f(path);
    if (!f.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text))
        return;
    QTextStream out(&f);
    QString line = QString("[%1] [carputer-ui] %2: %3")
        .arg(QDateTime::currentDateTimeUtc().toString(Qt::ISODate))
        .arg(location)
        .arg(message);
    if (w >= 0 && h >= 0)
        line += QString(" (window %1x%2)").arg(w).arg(h);
    if (isExposed)
        line += " [exposed]";
    out << line << "\n";
    f.close();
    fprintf(stderr, "[carputer-ui] %s: %s\n", location, message);
}

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
        setTitle("Carputer UI");
        // Size will be set from primary screen in main(); avoid fixed size to prevent overflow
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
        bootLog("render", "render() called", width(), height(), isExposed());
        if (!isExposed()) {
            bootLog("render", "SKIP (not exposed)", width(), height(), false);
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

        // "Hello World" in the center – load DejaVu from path so it renders as glyphs (not tofu) on linuxfb
        QFont font;
        const QStringList fontPaths = {
            QStringLiteral("/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
            QStringLiteral("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
        };
        for (const QString &path : fontPaths) {
            if (!QFile::exists(path))
                continue;
            const int fontId = QFontDatabase::addApplicationFont(path);
            if (fontId >= 0) {
                const QStringList families = QFontDatabase::applicationFontFamilies(fontId);
                if (!families.isEmpty()) {
                    font.setFamily(families.constFirst());
                    break;
                }
            }
        }
        if (font.family().isEmpty())
            font.setFamily(QStringLiteral("DejaVu Sans"));
        font.setPixelSize(qMax(24, qMin(width(), height()) / 15));
        font.setBold(true);
        painter.setFont(font);
        painter.setPen(Qt::white);
        painter.drawText(rect, Qt::AlignCenter, QStringLiteral("Hello World"));

        // Four white squares in the corners – compensate for screen aspect so they look square on screen
        const int margin = qMax(8, qMin(width(), height()) / 40);
        const int baseSize = qMax(40, (qMin(width(), height()) - 2 * margin) / 5);
        // On widescreen, pixels are typically wider than tall; use height as reference so box has correct aspect
        const int boxW = (width() >= height()) ? qMax(1, baseSize * height() / width()) : baseSize;
        const int boxH = (height() >= width()) ? qMax(1, baseSize * width() / height()) : baseSize;
        painter.setPen(Qt::NoPen);
        painter.setBrush(Qt::white);
        painter.drawRect(margin, margin, boxW, boxH);                                                                               // top-left
        painter.drawRect(width() - margin - boxW, margin, boxW, boxH);                                                             // top-right
        painter.drawRect(margin, height() - margin - boxH, boxW, boxH);                                                            // bottom-left
        painter.drawRect(width() - margin - boxW, height() - margin - boxH, boxW, boxH);                                            // bottom-right

        painter.end();
        m_backingStore->endPaint();
        m_backingStore->flush(rect);
        bootLog("render", "drew Hello World + 4 white squares", width(), height(), true);
    }
};

int main(int argc, char *argv[])
{
    bootLog("main", "carputer-ui starting (Qt C++ build)");
    QGuiApplication app(argc, argv);
    bootLog("main", "QGuiApplication created", -1, -1, false);
    app.setOrganizationName("Carputer");
    app.setApplicationName("Carputer UI");
    qSetMessagePattern("[%{type}] %{message}");

    QScreen *screen = app.primaryScreen();
    if (screen) {
        bootLog("main", qPrintable(QString("primaryScreen geometry %1x%2").arg(screen->geometry().width()).arg(screen->geometry().height())));
    } else {
        bootLog("main", "WARNING: primaryScreen is null");
    }

    HelloWorldWindow window;
    if (screen) {
        window.setGeometry(screen->geometry());
        bootLog("main", "window.setGeometry(screen)", screen->geometry().width(), screen->geometry().height(), false);
    }
    window.showFullScreen();
    bootLog("main", "showFullScreen() done", window.width(), window.height(), window.isExposed());

    // Force linuxfb to show our window: request update immediately and again after a short delay
    window.requestUpdate();
    QGuiApplication::processEvents();
    QTimer::singleShot(50, [&window]() {
        window.requestUpdate();
        QGuiApplication::processEvents();
    });
    QTimer::singleShot(200, [&window]() {
        window.requestUpdate();
        QGuiApplication::processEvents();
    });

    bootLog("main", "entering event loop");
    return app.exec();
}

