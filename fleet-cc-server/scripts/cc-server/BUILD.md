# Building CC-Server Setup Application

The `setup` application is a C++ program that provides an interactive terminal UI for managing the Fleet CC Server using the FTXUI library.

## Prerequisites

1. **C++ Compiler** (C++17 or later)
   - GCC 7+ or Clang 5+

2. **FTXUI Library**
   - Install via package manager or build from source
   - https://github.com/ArthurSonzogni/FTXUI

### Installing FTXUI

#### macOS (using Homebrew)
```bash
brew install ftxui
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install libftxui-dev
```

#### Build from Source
```bash
git clone https://github.com/ArthurSonzogni/FTXUI.git
cd FTXUI
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
```

## Building

The executable will be built in the parent `scripts/` directory as `setup`.

### Using CMake (Recommended)

```bash
cd scripts/cc-server
mkdir -p build
cd build
cmake ..
make
# Executable is now at: ../../scripts/setup
```

### Using Makefile

```bash
cd scripts/cc-server
make -f Makefile.carputer
# Executable is now at: ../setup
```

### Manual Build

```bash
cd scripts/cc-server
g++ -std=c++17 -O2 -o ../setup cc-server.cpp $(pkg-config --cflags --libs ftxui-component)
```

## Usage

The executable is located at `scripts/setup` (in the fleet-cc-server directory):

```bash
# From fleet-cc-server directory
./scripts/setup

# Or via dev.sh
./scripts/dev.sh setup

# Check mode (non-interactive)
./scripts/setup --check
```

## Features

- Modern terminal UI with FTXUI
- Arrow key navigation
- Properly centered text and borders
- All functionality from the bash script
- Better error handling

