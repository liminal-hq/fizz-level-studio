/// Kitchen Sink: generated from a Fizz script; edit the script, not this function.
fn kitchen_sink() -> LevelData {
    let mut b = Builder::new(80, 40, 4);
    b.liquid = FURNACE;
    b.run(&[(Seg::Flat, 10), (Seg::BeltR, 2), (Seg::BeltL, 2), (Seg::Up, 2), (Seg::Flat, 4), (Seg::Down, 2), (Seg::Pool, 3), (Seg::Up22, 2), (Seg::Flat, 4), (Seg::Down22, 2), (Seg::Gap, 2), (Seg::Spikes, 2), (Seg::Flat, 30)]);
    b.walls();
    b.fill(1, 20, 20, 30, FILL);
    b.plat(1, 3, 6);
    b.hover(2.0, 4.5, 8.0, 4.5, 0.3);
    b.room(1, 22, 5, 25);
    b.secret_room(6, 22, 9, 25);
    b.wall_behind(10, 19, 21, 29);
    b.mural(2, 8);
    b.ladder(4, 4, 9);
    b.stairs_right(30, 4, 3);
    b.stairs_left(40, 4, 3);
    b.vine_nook(10, 21, 24, 1, 3, 3);
    b.fill(3, 3, 1, 2, GATE);
    b.crys(5);
    b.item(ItemKind::Usb, 2, 2);
    b.row(ItemKind::KeyBlue, 1, 3, 3, 2);
    b.pogo_cache(8, 10, 3);
    b.ent(Kind::Gloop, 5.0);
    b.rider(Kind::Hopper, 9.0, 5.0);
    b.ent_dir(Kind::Mirror, 11.0, 6.0, 1.0);
    // Edits painted in the studio.
    b.fill(26, 26, 9, 9, PLAT);
    b.fill(28, 28, 9, 9, PLAT);
    b.fill(30, 30, 9, 9, PLAT);
    b.fill(12, 14, 8, 8, EMPTY);
    b.item(ItemKind::Cheezie, 26, 10);
    b.item(ItemKind::Cheezie, 28, 10);
    b.item(ItemKind::Cheezie, 30, 10);
    b.out(CAVES, (3.0, 4.0), Some(Arena { x0: 40.0, x1: 60.0, floor: 4.0 }))
}
