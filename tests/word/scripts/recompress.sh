#!/bin/bash
FILENAME=$1


echo FILENAME $FILENAME
rm -rf temp
mkdir temp
cd temp
unzip ../$FILENAME
rm ../$FILENAME
zip -r -9 ../$FILENAME .
cd ..
rm -rf temp

