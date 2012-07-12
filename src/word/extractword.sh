#!/bin/bash
FILENAME=$1

if [ -z "$FILENAME" ]; then
  echo Usage: $0 filename
  exit 1
fi

if [ ! -f "$FILENAME" ]; then
  echo "$FILENAME: No such file or directory"
  exit 1
fi

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
