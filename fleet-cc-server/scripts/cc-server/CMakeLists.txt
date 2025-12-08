cmake_minimum_required(VERSION 3.20)
project(carputer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find FTXUI
find_package(PkgConfig REQUIRED)
pkg_check_modules(FTXUI REQUIRED ftxui)

# Add executable
add_executable(carputer cc-server.cpp)

# Link libraries
target_link_libraries(carputer ${FTXUI_LIBRARIES})
target_include_directories(carputer PRIVATE ${FTXUI_INCLUDE_DIRS})
target_compile_options(carputer PRIVATE ${FTXUI_CFLAGS_OTHER})

# Copy executable to scripts/ directory after build as 'setup'
add_custom_command(TARGET carputer POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    $<TARGET_FILE:carputer>
    ${CMAKE_CURRENT_SOURCE_DIR}/../setup
    COMMENT "Copying executable to scripts directory as 'setup'"
)

# Install
install(TARGETS carputer DESTINATION bin)

