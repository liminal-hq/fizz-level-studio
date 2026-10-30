/// Crater Fields: generated from a Fizz script; edit the script, not this function.
fn crater_fizz() -> LevelData {
    let mut b = Builder::new(192, 28, 4);
    b.run(&[(Seg::Flat, 14), (Seg::Up, 2), (Seg::Flat, 6), (Seg::Down, 2), (Seg::Flat, 5)]);
    b.run(&[(Seg::Pool, 4), (Seg::Flat, 8), (Seg::Up22, 2), (Seg::Flat, 10), (Seg::Gap, 3), (Seg::Flat, 9), (Seg::Down22, 2), (Seg::Flat, 6)]);
    b.run(&[(Seg::Spikes, 4), (Seg::Flat, 10), (Seg::Up, 3), (Seg::Flat, 8), (Seg::Down, 3)]);
    b.run(&[(Seg::Pool, 6), (Seg::Flat, 10), (Seg::Up22, 3), (Seg::Flat, 14), (Seg::Down, 3), (Seg::Flat, 12)]);
    b.run(&[(Seg::Spikes, 3), (Seg::Flat, 8), (Seg::Up, 2), (Seg::Flat, 22)]);
    b.walls();
    b.fill(49, 51, 10, 10, BLOCK);
    b.plat(107, 108, 5);
    b.plat(131, 134, 12);
    b.fill(171, 171, 6, 7, DOOR_R);
    b.fill(171, 171, 8, 27, BLOCK);
    b.fill(186, 186, 6, 7, EXIT);
    b.crys(10);
    b.crys(26);
    b.crys(60);
    b.crys(98);
    b.crys(118);
    b.crys(150);
    b.crys(178);
    b.row(ItemKind::Cheezie, 17, 4, 7, 1);
    b.row(ItemKind::Cheezie, 29, 4, 7, 1);
    b.item(ItemKind::Soda, 36, 5);
    b.row(ItemKind::Choc, 46, 3, 8, 3);
    b.item(ItemKind::Cookie, 50, 11);
    b.row(ItemKind::Cheezie, 105, 6, 8, 1);
    b.row(ItemKind::Cheezie, 72, 3, 5, 1);
    b.row(ItemKind::Choc, 94, 4, 8, 2);
    b.item(ItemKind::Soda, 125, 9);
    b.row(ItemKind::Cheezie, 128, 5, 8, 2);
    b.item(ItemKind::KeyRed, 132, 13);
    b.row(ItemKind::Choc, 146, 3, 5, 3);
    b.item(ItemKind::Cookie, 157, 7);
    b.row(ItemKind::Cheezie, 175, 4, 7, 2);
    b.pogo_cache(8, 10, 7);
    b.ent(Kind::Gloop, 35.0);
    b.ent(Kind::Gloop, 62.0);
    b.ent(Kind::Gloop, 85.0);
    b.ent(Kind::Hopper, 97.0);
    b.ent(Kind::Hopper, 148.0);
    b.ent(Kind::Marsh, 115.0);
    b.ent(Kind::Pod, 136.0);
    b.ent_at(Kind::Drone, 88.5, 7.5);
    b.ent_at(Kind::Drone, 165.5, 7.5);
    b.out(CRATER, (3.0, 4.0), None)
}
