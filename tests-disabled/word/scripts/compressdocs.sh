#!/bin/bash
rm -rf compressed
mkdir compressed
for i in $(cd extracted; echo *); do
  echo $i
  (cd extracted/$i && zip -r ../../compressed/$i.docx .)
done
