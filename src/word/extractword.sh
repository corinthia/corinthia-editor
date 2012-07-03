#!/bin/bash
FILENAME=$1

echo filename is $FILENAME

BASENAME=`echo $FILENAME | sed -e 's/\..*$//'`
echo basename is $BASENAME
rm -rf "$BASENAME"
mkdir "$BASENAME"
cd "$BASENAME"
unzip "../$FILENAME"
for i in word/*.xml; do
  xmllint -format "$i" > a
  mv -f a "$i"
done
