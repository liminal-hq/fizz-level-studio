# Provenance

This crate is a copy of `crates/wayland-toplevel-drag` from [liminal-hq/waypoint](https://github.com/liminal-hq/waypoint), taken at commit `a3c9894728da69a9b44e66310e66cde64c10ea60` (the same commit as `packages/chrome`).

## Changes from the source

- None to the sources, the build script or the C shim. It inherits this workspace's package fields (`edition`, `license`, `repository`).

## Why a copy

The crate is the Linux half of `plugins/window-tearoff`, which asks the compositor to move a real window with the pointer (`xdg-toplevel-drag-v1`). It is not published; when it is, delete this copy and depend on the release.
