#!/bin/bash
rm -rf extracted
mkdir extracted
for i in *.docx; do
    basename=`echo $i | sed -e 's/\.docx//'`
    echo $basename
    mkdir extracted/$basename
    (cd extracted/$basename && unzip ../../$basename.docx);
done
