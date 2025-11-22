#!/bin/bash

# Build all bundles with Vite

echo "Building main library..."
VITE_ENTRY=index vite build

echo "Building minimal bundle..."
VITE_ENTRY=minimal vite build

echo "Building newtracks bundle..."
VITE_ENTRY=newtracks vite build

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

echo "Building multi-clip bundle..."
VITE_ENTRY=multi-clip vite build

echo "Copying recording worklet..."
mkdir -p ../../ghpages/js/worklet
cp ../recording/dist/recording-processor.worklet.js ../../ghpages/js/worklet/

echo "All bundles built successfully!"
