.PHONY: help install build clean watch package test test-local

# Variables
EXTENSION_NAME := winccoa-dp-inspector
VERSION        := $(shell node -p "require('./package.json').version")
BIN_DIR        := bin
EXT_PUBLISHER  := winccoa-tools-pack
EXT_NAME       := winccoa-dp-inspector
EXT_ID         := $(EXT_PUBLISHER).$(EXT_NAME)
NPM            := npm
VSCE           := npx vsce

# Test workspace configuration
TEST_WORKSPACE ?= .
CODE_BIN       ?= code

# OS Detection
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    MKDIR       := mkdir
else
    DETECTED_OS := $(shell uname -s)
    MKDIR       := mkdir -p
endif

# Default target
help:
	@echo "Available targets:"
	@echo "  make install     - Install all dependencies (root + webview)"
	@echo "  make build       - Build extension and webview"
	@echo "  make clean       - Remove build artifacts"
	@echo "  make watch       - Watch mode for development"
	@echo "  make package     - Package extension as .vsix"
	@echo "  make test-local  - Build, package, install in VS Code and open workspace"
	@echo ""
	@echo "Options:"
	@echo "  TEST_WORKSPACE  - Folder/workspace to open after install (default: .)"
	@echo "  CODE_BIN        - VS Code binary (default: code, use 'code-insiders' for Insiders)"
	@echo "  Example: make test-local TEST_WORKSPACE=/path/to/project CODE_BIN=code-insiders"

# Install dependencies
install:
	@echo "Installing root dependencies..."
	$(NPM) install
	@echo "Installing webview dependencies..."
	cd webview && $(NPM) install
	@echo "Dependencies installed successfully!"

# Build everything
build:
	@echo "Building extension..."
	$(NPM) run compile
	@echo "Build completed successfully!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf webview/dist/
	rm -rf out/
	rm -rf bin/
	@echo "Clean completed!"

# Watch mode for development
watch:
	@echo "Starting watch mode..."
	$(NPM) run watch

# Package extension (production)
package: build
	@echo "Packaging production release..."
	@-$(MKDIR) $(BIN_DIR) 2>nul || echo "" >nul
	@echo "Updating version badge in README.md..."
	@node -e "const fs=require('fs'); let c=fs.readFileSync('README.md','utf8'); c=c.replace(/!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]*\)/,'![Version](https://img.shields.io/badge/version-$(VERSION)-blue.svg)'); fs.writeFileSync('README.md',c);"
	@$(VSCE) package -o $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Extension packaged to $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"

# Local test target - Build, package with local stamp, install in VS Code, open workspace
test-local: build
	@node scripts/test-local.js $(BIN_DIR) $(EXTENSION_NAME) $(VERSION) $(EXT_ID) $(CODE_BIN) $(TEST_WORKSPACE)
