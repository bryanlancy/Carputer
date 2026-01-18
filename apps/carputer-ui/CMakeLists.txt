cmake_minimum_required(VERSION 3.21)
project(carputer-ui LANGUAGES CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Only need Qt6::Gui for QGuiApplication and QWindow
find_package(Qt6 REQUIRED COMPONENTS Gui)

qt_add_executable(carputer-ui
    src/main.cpp
)

target_link_libraries(carputer-ui
    PRIVATE
        Qt6::Gui
)

install(TARGETS carputer-ui DESTINATION bin)

