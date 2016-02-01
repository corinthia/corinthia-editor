#!/bin/bash
(
prevdir=""
echo "[";
for dir in *; do
    if [ -d $dir ]; then
        if [ ! -z "$prevdir" ]; then
            echo ","
        fi
        echo "  { \"dir\": \"$dir\","
        echo "    \"files\": ["
        echo -n "      "
        prevfile=""
        for file in $(cd $dir && echo *-input.html); do
            if [ ! -z "$prevfile" ]; then
                echo ","
                echo -n "      "
            fi
            shortname=`echo $file | sed -e 's/-input.html//'`
            echo -n "\"$shortname\""
            prevfile="$file"
        done
        echo
        echo -n "    ] }"
        prevdir="$dir"
    fi
done
echo
echo "]"
) > index.json
