// The overworld builder the exporter writes against: a map, its points and its areas, with the helpers
// `build_overworld` uses inline. It belongs in levels.rs beside `build_overworld`.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

struct OverworldBuilder {
    map: TileMap,
    points: Vec<MapPoint>,
    areas: Vec<AreaRect>,
}

impl OverworldBuilder {
    fn new(w: i32, h: i32) -> Self {
        let mut map = TileMap::new(w, h, props());
        map.floor_solid = true;
        OverworldBuilder {
            map,
            points: Vec::new(),
            areas: Vec::new(),
        }
    }

    fn fill(&mut self, x0: i32, x1: i32, y0: i32, y1: i32, t: u8) -> &mut Self {
        for y in y0..=y1 {
            for x in x0..=x1 {
                self.map.set(x, y, t);
            }
        }
        self
    }

    /// A path runs x first and then y.
    fn path(&mut self, x0: i32, y0: i32, x1: i32, y1: i32) -> &mut Self {
        let (sx, sy) = ((x1 - x0).signum(), (y1 - y0).signum());
        if sx != 0 {
            let mut x = x0;
            while x != x1 + sx {
                self.map.set(x, y0, PATH);
                x += sx;
            }
        }
        if sy != 0 {
            let mut y = y0;
            while y != y1 + sy {
                self.map.set(x1, y, PATH);
                y += sy;
            }
        }
        self.map.set(x1, y1, PATH);
        self
    }

    /// Trees and rocks on free grass, by each area's rates, clear of every point and path.
    fn scatter(&mut self) -> &mut Self {
        let (w, h) = (self.map.w, self.map.h);
        let r = |x: i32, y: i32| hashf(x.wrapping_add(7919), y.wrapping_add(104_729));
        for x in 2..w - 2 {
            for y in 2..h - 2 {
                if self.map.get(x, y) != GRASS {
                    continue;
                }
                let mut near = self
                    .points
                    .iter()
                    .any(|p| (p.x - f64::from(x)).abs() < 3.0 && (p.y - f64::from(y)).abs() < 3.0);
                for dx in -1..=1 {
                    for dy in -1..=1 {
                        let t = if self.map.in_bounds(x + dx, y + dy) {
                            self.map.get(x + dx, y + dy)
                        } else {
                            RIVER
                        };
                        if t == PATH {
                            near = true;
                        }
                    }
                }
                if !near {
                    let theme = area_theme(area_at(&self.areas, x, y));
                    let q = r(x, y);
                    if q < theme.tree_rate {
                        self.map.set(x, y, TREE);
                    } else if q < theme.tree_rate + theme.rock_rate {
                        self.map.set(x, y, ROCK);
                    }
                }
            }
        }
        self
    }

    fn finish(self, start: (f64, f64)) -> MapData {
        MapData {
            map: self.map,
            points: self.points,
            areas: self.areas,
            start,
        }
    }
}
