#!/bin/bash
echo "Enter latex document:"
cat > document.tex
pdflatex document.tex || exit 1
pdflatex document.tex || exit 1
pdflatex document.tex || exit 1
open document.pdf
