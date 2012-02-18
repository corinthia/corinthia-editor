#!/bin/bash
jsgrep -F '.createElement' | grep -vF 'DOM.createElement' | grep -vF 'DOM.js:'
jsgrep -F '.createTextNode' | grep -vF 'DOM.createTextNode' | grep -vF 'DOM.js:'
jsgrep -F '.createComment' | grep -vF 'DOM.createComment' | grep -vF 'DOM.js:'
jsgrep -F '.appendChild' | grep -vF 'DOM.appendChild' | grep -vF 'DOM.js:'
jsgrep -F '.insertBefore' | grep -vF 'DOM.insertBefore' | grep -vF 'DOM.js:'
jsgrep -F '.removeChild' | grep -vF 'DOM.removeChild' | grep -vF 'DOM.js:'
jsgrep -F '.cloneNode' | grep -vF 'DOM.cloneNode' | grep -vF 'DOM.js:'
