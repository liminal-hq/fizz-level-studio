// Sample Crater Fields draft used by the layout mockups. Data only.
(function () {
  var defs = {
    F: { bg: '#2b2540', glyph: '', ink: '#e0e0e0' },
    B: { bg: '#6a58a8', glyph: '', ink: '#e0e0e0' },
    P: { bg: 'linear-gradient(#ffaa40 0 30%, transparent 30%)', glyph: '', ink: '#e0e0e0' },
    C: { bg: '#7a4527', glyph: '~', ink: '#d9a27c' },
    S: { bg: 'transparent', glyph: '^', ink: '#f43f5e' },
    o: { bg: 'transparent', glyph: '@', ink: '#ffffff' },
    X: { bg: 'rgba(46,198,106,0.3)', glyph: '>', ink: '#2ec66a' },
    g: { bg: 'transparent', glyph: 'g', ink: '#f43f5e' },
    h: { bg: 'transparent', glyph: 'h', ink: '#f43f5e' },
    b: { bg: 'transparent', glyph: 'b', ink: '#f43f5e' },
    c: { bg: 'transparent', glyph: '•', ink: '#fbbf24' },
    s: { bg: 'transparent', glyph: 's', ink: '#22d3ee' }
  };
  function grid() {
    var W = 40, H = 16, g = [], x, y;
    for (y = 0; y < H; y++) { g.push([]); for (x = 0; x < W; x++) g[y].push('.'); }
    for (x = 0; x < W; x++) for (y = 12; y < H; y++) g[y][x] = 'F';
    for (x = 17; x <= 19; x++) for (y = 12; y < H; y++) g[y][x] = '.';
    for (x = 17; x <= 19; x++) g[15][x] = 'S';
    for (x = 26; x <= 30; x++) { g[12][x] = 'C'; g[13][x] = 'C'; }
    for (x = 12; x <= 14; x++) { g[8][x] = 'P'; g[7][x] = 'c'; }
    for (y = 9; y <= 11; y++) { g[y][22] = 'B'; g[y][23] = 'B'; }
    g[8][23] = 's'; g[11][33] = 'S'; g[11][34] = 'S';
    g[11][2] = 'o'; g[11][37] = 'X'; g[11][9] = 'g'; g[11][14] = 'h'; g[6][31] = 'b';
    for (x = 5; x <= 7; x++) g[10][x] = 'c';
    return g;
  }
  // opts: { ghosts: bool, x0, x1, y0, y1 } -> { cols, rows, cells }
  function cells(opts) {
    opts = opts || {};
    var g = grid(), ghost = {};
    if (opts.ghosts) {
      [[26, 9, 'P'], [28, 9, 'P'], [30, 9, 'P'], [26, 8, 'c'], [28, 8, 'c'], [30, 8, 'c']].forEach(function (q) { ghost[q[0] + ',' + q[1]] = q[2]; });
    }
    var x0 = opts.x0 || 0, x1 = opts.x1 === undefined ? 39 : opts.x1;
    var y0 = opts.y0 || 0, y1 = opts.y1 === undefined ? 15 : opts.y1;
    var out = [], x, y;
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        var gh = ghost[x + ',' + y];
        var d = defs[gh || g[y][x]];
        out.push({
          bg: d ? d.bg : 'transparent',
          glyph: d ? d.glyph : '',
          ink: d ? d.ink : '#fff',
          outline: gh ? '1px dashed #a78bfa' : 'none',
          opacity: gh ? 0.85 : 1
        });
      }
    }
    return { cols: x1 - x0 + 1, rows: y1 - y0 + 1, cells: out };
  }
  function script() {
    return [
      ['level "Crater Fields" 40x16 ground=12', ''], ['theme crater   area crater-fields', ''], ['start 2,11     exit 37,11', ''], ['', ''],
      ['terrain', ''], ['  flat 17, gap 3, flat 20', ''], ['  pool 5 at 26', ''], ['', ''],
      ['treats', ''], ['  cheezie x=5..7 y=10', ''], ['  cheezie x=12..14 y=7', ''], ['  soda    x=23 y=8', ''], ['', ''],
      ['enemies', ''], ['  gloop 9   hopper 14   bat 31,6', ''], ['', ''],
      ['blocks', ''], ['  block   x=22..23 y=9..11', ''], ['', ''],
      ['edits', ''], ['  paint spikes    x=33..34 y=11', ''],
      ['  paint one-way   x=26,28,30 y=9', '+'], ['  paint cheezie   x=26,28,30 y=8', '+']
    ];
  }
  window.FizzLevel = { cells: cells, script: script };
})();
