cmake_minimum_required(VERSION 3.21)
project(carputer-ui LANGUAGES CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 REQUIRED COMPONENTS Gui Quick QuickControls2 Network)

qt_add_executable(carputer-ui
    src/main.cpp
    src/NetworkStatus.cpp
    src/UpdateStatus.cpp
)

target_link_libraries(carputer-ui
    PRIVATE
        Qt6::Gui
        Qt6::Quick
        Qt6::QuickControls2
        Qt6::Network
)

qt_add_qml_module(carputer-ui
    URI Carputer
    VERSION 1.0
    QML_FILES qml/Main.qml
)

install(TARGETS carputer-ui DESTINATION bin)

install(FILES qml/Main.qml DESTINATION share/carputer/ui)

