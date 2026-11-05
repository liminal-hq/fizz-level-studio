// Logging: one stream for native code and every webview, to stdout and a rotating file
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `tauri-plugin-log`'s own `plugin:log|log` command is what `src/services/logger.ts` forwards the
// webview's `console.*` calls into, so forwarded messages land in the same stdout stream and log
// file as native `log::info!()` calls. Studio code never logs a level's script text or Claude's
// messages (R-APP-08): a session's `Debug` output is already free of the text.

use log::LevelFilter;
use tauri::Runtime;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

/// The level floor for every log line, native and forwarded: verbose in a debug build, `Info` and
/// up in a release one.
pub fn level() -> LevelFilter {
    if cfg!(debug_assertions) {
        LevelFilter::Trace
    } else {
        LevelFilter::Info
    }
}

/// One log line: a local timestamp, the level, the target, and the message.
pub fn format_line(
    now: chrono::DateTime<chrono::Local>,
    level: log::Level,
    target: &str,
    message: &str,
) -> String {
    format!(
        "[{}][{}][{}] {}",
        now.format("%Y-%m-%d %H:%M:%S%.3f %:z"),
        level,
        target,
        message
    )
}

/// The log plugin, configured for the studio.
pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_log::Builder::default()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
        ])
        .level(level())
        // The debug-only MCP bridge's websocket internals are extremely chatty at `Trace` (every
        // handshake read and write poll) and drown out everything else.
        .level_for("tungstenite", LevelFilter::Warn)
        .level_for("tokio_tungstenite", LevelFilter::Warn)
        // The async runtime polls constantly; at `Trace` it buries everything else.
        .level_for("mio", LevelFilter::Warn)
        .max_file_size(2_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .format(|out, message, record| {
            out.finish(format_args!(
                "{}",
                format_line(
                    chrono::Local::now(),
                    record.level(),
                    record.target(),
                    &message.to_string()
                )
            ))
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn a_debug_build_is_verbose_and_a_release_build_is_not() {
        if cfg!(debug_assertions) {
            assert_eq!(level(), LevelFilter::Trace);
        } else {
            assert_eq!(level(), LevelFilter::Info);
        }
    }

    #[test]
    fn a_line_carries_the_time_level_target_and_message() {
        let now = chrono::Local
            .with_ymd_and_hms(2026, 11, 4, 18, 30, 5)
            .single()
            .expect("an unambiguous local time");
        let line = format_line(now, log::Level::Warn, "webview", "[main-1] hello");
        assert!(line.starts_with("[2026-11-04 18:30:05.000 "), "{line}");
        assert!(line.ends_with("][WARN][webview] [main-1] hello"), "{line}");
    }
}
