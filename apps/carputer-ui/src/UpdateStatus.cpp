#include "UpdateStatus.h"

#include <QDir>
#include <QFile>
#include <QTextStream>

namespace {
constexpr auto STATUS_DIR = "/var/run/carputer";
constexpr auto STATUS_FILE = "/var/run/carputer/update-status";
}

UpdateStatus::UpdateStatus(QObject *parent)
    : QObject(parent),
      m_statusDir(QString::fromUtf8(STATUS_DIR)),
      m_statusFile(QString::fromUtf8(STATUS_FILE))
{
    if (QDir(m_statusDir).exists()) {
        m_watcher.addPath(m_statusDir);
    }

    connect(&m_watcher, &QFileSystemWatcher::directoryChanged,
            this, &UpdateStatus::handleDirectoryChanged);
    connect(&m_watcher, &QFileSystemWatcher::fileChanged,
            this, &UpdateStatus::handleFileChanged);

    refresh();
}

void UpdateStatus::handleDirectoryChanged(const QString &)
{
    refresh();
}

void UpdateStatus::handleFileChanged(const QString &)
{
    refresh();
}

void UpdateStatus::refresh()
{
    const bool exists = QFile::exists(m_statusFile);
    QString message;

    if (exists) {
        QFile file(m_statusFile);
        if (file.open(QIODevice::ReadOnly | QIODevice::Text)) {
            QTextStream stream(&file);
            message = stream.readAll().trimmed();
            if (message.isEmpty()) {
                message = QStringLiteral("Applying update…");
            }
        } else {
            message = QStringLiteral("Applying update…");
        }
    }

    watchFile(exists);

    if (m_active != exists || m_message != message) {
        m_active = exists;
        m_message = message;
        emit stateChanged();
    }
}

void UpdateStatus::watchFile(bool enable)
{
    if (enable && !m_fileWatched) {
        if (!m_watcher.files().contains(m_statusFile)) {
            m_watcher.addPath(m_statusFile);
        }
        m_fileWatched = true;
    } else if (!enable && m_fileWatched) {
        m_watcher.removePath(m_statusFile);
        m_fileWatched = false;
    }
}

