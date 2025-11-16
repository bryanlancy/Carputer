#include "NetworkStatus.h"

NetworkStatus::NetworkStatus(QObject *parent)
    : QObject(parent)
{
    m_lastOnline = QNetworkConfigurationManager::isOnline();
    connect(&m_manager, &QNetworkConfigurationManager::onlineStateChanged,
            this, &NetworkStatus::handleOnlineStateChanged);
    m_manager.updateConfigurations();
}

bool NetworkStatus::isOnline() const
{
    return m_lastOnline;
}

void NetworkStatus::handleOnlineStateChanged(bool online)
{
    if (m_lastOnline == online) {
        return;
    }

    m_lastOnline = online;
    emit statusChanged();
}

