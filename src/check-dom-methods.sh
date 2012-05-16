#!/bin/bash
jsgrep -F '.createElement' | grep -vF '// check-ok'
jsgrep -F '.createTextNode' | grep -vF '// check-ok'
jsgrep -F '.createComment' | grep -vF '// check-ok'
jsgrep -F '.appendChild' | grep -vF '// check-ok'
jsgrep -F '.insertBefore' | grep -vF '// check-ok'
jsgrep -F '.removeChild' | grep -vF '// check-ok'
jsgrep -F '.cloneNode' | grep -vF '// check-ok'
jsgrep -F '.nodeName' | grep -vE '(dtdsource/|tests/|treevis/)' | grep -vF '// check-ok'
jsgrep -F '.setAttribute' | grep -vE '(dtdsource/|treevis/|docx/)' | grep -vF '// check-ok'
jsgrep -F '.removeAttribute' | grep -vE '(dtdsource/|treevis/|docx/)' | grep -vF '// check-ok'
jsgrep -F '.setProperty' | grep -vE '(dtdsource/|treevis/)' | grep -vF '// check-ok'
jsgrep -F '.removeProperty' | grep -vE '(dtdsource/|treevis/)' | grep -vF '// check-ok'
jsgrep -E '\.style\[.* = ' | grep -vE '(treevis/|docx/)' | grep -vF '// check-ok'
jsgrep -E '\.style\..* = ' | grep -vE '(treevis/|docx/)' | grep -vF '// check-ok'
