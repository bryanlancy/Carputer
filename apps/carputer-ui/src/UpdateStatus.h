#pragma once

#include <QObject>
#include <QString>
#include <QFileSystemWatcher>

class UpdateStatus : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool active READ isActive NOTIFY stateChanged)
    Q_PROPERTY(QString message READ message NOTIFY stateChanged)

public:
    explicit UpdateStatus(QObject *parent = nullptr);

    bool isActive() const { return m_active; }
    QString message() const { return m_message; }

signals:
    void stateChanged();

private slots:
    void handleDirectoryChanged(const QString &path);
    void handleFileChanged(const QString &path);

private:
    void refresh();
    void watchFile(bool enable);

    QFileSystemWatcher m_watcher;
    QString m_statusDir;
    QString m_statusFile;
    bool m_active = false;
    QString m_message;
    bool m_fileWatched = false;
};

