use serde::{Deserialize, Serialize};

/// Selects how the browser is displayed for a single `create_browser` call.
///
/// - `Normal`: launch Chrome against whatever display the process already has.
/// - `Headless`: launch Chrome with `--headless=new` (no display needed).
/// - `Xvfb`: spawn an Xvfb + x11vnc pair so the session can be streamed via VNC.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DisplayMode {
    #[default]
    Headless,
    Xvfb,
    Normal,
}

impl DisplayMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            DisplayMode::Headless => "headless",
            DisplayMode::Xvfb => "xvfb",
            DisplayMode::Normal => "normal",
        }
    }
}

impl std::str::FromStr for DisplayMode {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "headless" => Ok(DisplayMode::Headless),
            "xvfb" => Ok(DisplayMode::Xvfb),
            "normal" => Ok(DisplayMode::Normal),
            other => Err(format!("invalid display mode: {other}")),
        }
    }
}
