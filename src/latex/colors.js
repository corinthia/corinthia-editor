var CSS_COLORS_BY_NAME = {
  maroon: { r: 128, g: 0,  b: 0 },
  red: { r: 255, g: 0,  b: 0 },
  orange: { r: 255, g: 165,  b: 0 },
  yellow: { r: 255, g: 255,  b: 0 },
  olive: { r: 128, g: 128,  b: 0 },
  purple: { r: 128, g: 0,  b: 128 },
  fuchsia: { r: 255, g: 0,  b: 255 },
  white: { r: 255, g: 255,  b: 255 },
  lime: { r: 0, g: 255,  b: 0 },
  green: { r: 0, g: 128,  b: 0 },
  navy: { r: 0, g: 0,  b: 128 },
  blue: { r: 0, g: 0,  b: 255 },
  aqua: { r: 0, g: 255,  b: 255 },
  teal: { r: 0, g: 128,  b: 128 },
  black: { r: 0, g: 0,  b: 0 },
  silver: { r: 192, g: 192,  b: 192 },
  gray: { r: 128, g: 128,  b: 128 },
};

var LATEX_COLORS_BY_NAME = {
  greenyellow: { r: 217, g: 255, b: 79 },
  yellow: { r: 255, g: 255, b: 0 },
  goldenrod: { r: 255, g: 230, b: 41 },
  dandelion: { r: 255, g: 181, b: 41 },
  apricot: { r: 255, g: 173, b: 122 },
  peach: { r: 255, g: 128, b: 77 },
  melon: { r: 255, g: 138, b: 128 },
  yelloworange: { r: 255, g: 148, b: 0 },
  orange: { r: 255, g: 99, b: 33 },
  burntorange: { r: 255, g: 125, b: 0 },
  bittersweet: { r: 194, g: 48, b: 0 },
  redorange: { r: 255, g: 59, b: 33 },
  mahogany: { r: 166, g: 25, b: 22 },
  maroon: { r: 173, g: 23, b: 55 },
  brickred: { r: 184, g: 20, b: 11 },
  red: { r: 255, g: 0, b: 0 },
  orangered: { r: 255, g: 0, b: 128 },
  rubinered: { r: 255, g: 0, b: 222 },
  wildstrawberry: { r: 255, g: 10, b: 156 },
  salmon: { r: 255, g: 120, b: 158 },
  carnationpink: { r: 255, g: 94, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  violetred: { r: 255, g: 48, b: 255 },
  rhodamine: { r: 255, g: 46, b: 255 },
  mulberry: { r: 165, g: 25, b: 250 },
  redviolet: { r: 157, g: 17, b: 168 },
  fuchsia: { r: 124, g: 21, b: 235 },
  lavender: { r: 255, g: 133, b: 255 },
  thistle: { r: 224, g: 105, b: 255 },
  orchid: { r: 173, g: 92, b: 255 },
  darkorchid: { r: 153, g: 51, b: 204 },
  purple: { r: 140, g: 36, b: 255 },
  plum: { r: 128, g: 0, b: 255 },
  violet: { r: 54, g: 31, b: 255 },
  royalpurple: { r: 64, g: 25, b: 255 },
  blueviolet: { r: 34, g: 22, b: 245 },
  periwinkle: { r: 110, g: 115, b: 255 },
  cadetblue: { r: 97, g: 110, b: 196 },
  cornflowerblue: { r: 89, g: 222, b: 255 },
  midnightblue: { r: 3, g: 126, b: 145 },
  navyblue: { r: 15, g: 117, b: 255 },
  royalblue: { r: 0, g: 128, b: 255 },
  blue: { r: 0, g: 0, b: 255 },
  cerulean: { r: 15, g: 227, b: 255 },
  cyan: { r: 0, g: 255, b: 255 },
  processblue: { r: 10, g: 255, b: 255 },
  skyblue: { r: 97, g: 255, b: 224 },
  turquoise: { r: 38, g: 255, b: 204 },
  tealblue: { r: 35, g: 250, b: 165 },
  aquamarine: { r: 46, g: 255, b: 179 },
  bluegreen: { r: 38, g: 255, b: 171 },
  emerald: { r: 0, g: 255, b: 128 },
  junglegreen: { r: 3, g: 255, b: 122 },
  seagreen: { r: 79, g: 255, b: 128 },
  green: { r: 0, g: 255, b: 0 },
  forestgreen: { r: 20, g: 224, b: 27 },
  pinegreen: { r: 15, g: 191, b: 78 },
  limegreen: { r: 128, g: 255, b: 0 },
  yellowgreen: { r: 143, g: 255, b: 66 },
  springgreen: { r: 189, g: 255, b: 61 },
  olivegreen: { r: 55, g: 153, b: 8 },
  rawsienna: { r: 140, g: 39, b: 0 },
  sepia: { r: 77, g: 13, b: 0 },
  brown: { r: 102, g: 19, b: 0 },
  tan: { r: 219, g: 148, b: 112 },
  gray: { r: 128, g: 128, b: 128 },
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
};

function inverseColorMap(map)
{
    var result = new Object();
    for (var name in map) {
        var col = map[name];
        result[colorName(col)] = name;
    }
    return result;
}

var CSS_COLORS_BY_RGB = inverseColorMap(CSS_COLORS_BY_NAME);
var LATEX_COLORS_BY_RGB = inverseColorMap(LATEX_COLORS_BY_NAME);

function colorName(col)
{
    return "RGB_"+col.r+"_"+col.g+"_"+col.b
}
