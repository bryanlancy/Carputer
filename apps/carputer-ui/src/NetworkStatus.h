#pragma once

#include <QObject>
#include <QtNetwork/QNetworkConfigurationManager>

class NetworkStatus : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool online READ isOnline NOTIFY statusChanged)

public:
    explicit NetworkStatus(QObject *parent = nullptr);

    bool isOnline() const;

signals:
    void statusChanged();

private slots:
    void handleOnlineStateChanged(bool online);

private:
    QNetworkConfigurationManager m_manager;
    bool m_lastOnline = false;
};

