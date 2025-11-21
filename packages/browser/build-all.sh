#!/bin/bash

# Build all bundles with Vite

echo "Building main library..."
VITE_ENTRY=index vite build

echo "Building annotations bundle..."
VITE_ENTRY=annotations vite build

echo "Building stem-tracks bundle..."
VITE_ENTRY=stem-tracks vite build

echo "Building flexible-example bundle..."
VITE_ENTRY=flexible-example vite build

echo "Building effects bundle..."
VITE_ENTRY=effects vite build

echo "Building recording bundle..."
VITE_ENTRY=recording vite build

echo "All bundles built successfully!"
