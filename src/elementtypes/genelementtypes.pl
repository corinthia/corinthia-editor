#!/usr/bin/perl

$filename = $ARGV[0];

#print "filename $filename\n";

@names = ();

open($fh,"<",$filename) or die "Can't open $filename";
while ($name = <$fh>) {
  $name =~ s/\n$//;
  push(@names,$name);
}
close($fh);

$lic = <<'END_LICENSE'
// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

END_LICENSE
;

print($lic);

print("// This file was automatically generated from $filename\n");
print("\n");
print("define(\"ElementTypes\",function(require,exports) {\n");
print("\n");
print("    exports.fromString = {\n");
$nextId = 1;
for $name (@names) {
  $upper = uc($name);
  $lower = lc($name);
  print("        \"$upper\": $nextId,\n");
  print("        \"$lower\": $nextId,\n");
  $nextId++;
}
print("    };\n");
print("\n");
$nextId = 1;
for $name (@names) {
  $temp = $name;
  $temp =~ s/#//;
  $upper = uc($temp);
  print("    exports.HTML_$upper = $nextId;\n");
  $nextId++;
}
print("    exports.HTML_COUNT = $nextId;\n");
print("\n");
print("});\n");
